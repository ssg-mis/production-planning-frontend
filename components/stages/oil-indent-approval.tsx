'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  getProductStock,
  initializeDefaultStocks,
} from '@/lib/workflow-storage';
import TableSkeleton from '@/components/table-skeleton';


// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const formatNumber = (num: number | undefined) => {
  if (num === undefined || num === null) return '-';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
};

const normalizeProductKey = (productName: string, packingSize?: string): string => {
  if (!productName) return 'UNKNOWN';
  return `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const categorizeOilType = (productName: string): string => {
  if (!productName) return 'Other Oils';
  const n = productName.toLowerCase();
  if (n.includes('rice bran oil') || n.includes('rbo') || n.includes('rice bran')) return 'Rice Bran Oil';
  if (n.includes('soybean') || n.includes('soya') || n.includes('sbo')) return 'Soybean Oil';
  if (n.includes('palm') || n.includes('palmolein')) return 'Hari Krishna Palm Oil';
  if (n.includes('mustard') || n.includes('kachi ghani')) return 'Mustard Oil';
  if (n.includes('sunflower')) return 'Sunflower Oil';
  if (n.includes('groundnut')) return 'Groundnut Oil';
  return 'Other Oils';
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'rejected':  return 'bg-red-100 text-red-800';
    case 'submitted': return 'bg-blue-100 text-blue-800';
    default:          return 'bg-yellow-100 text-yellow-800';
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApprovalItem {
  id: string;           // production_id
  productName: string;
  packingSize?: string;
  packingType: string;
  partyName?: string;
  indentQuantity: number;
  totalWeightKg: number;
  approvedWeight?: number;
  status: string;
  remarks?: string;
  tankNo?: string;
  givenFromTankNo?: string;
  createdAt?: string;
}

interface ProductGroup {
  productKey: string;
  productName: string;
  packingSize?: string;
  packingType: string;
  totalQuantity: number;
  totalWeightKg: number;
  availableStock: number;
  shortage: number;
  status: string;
  items: ApprovalItem[];
}

interface OilTypeGroup {
  type: string;
  totalQuantity: number;
  totalWeightKg: number;
  products: ProductGroup[];
}

// ─── Component ───────────────────────────────────────────────────────────────

const OilIndentApproval = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Expand/collapse state
  const [expandedOilTypes, setExpandedOilTypes] = useState<Record<string, boolean>>({});

  // Approval form state
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [approvedQtyInput, setApprovedQtyInput] = useState<string>(''); // free-text state for the approved qty field
  const [formData, setFormData] = useState({ 
    action: 'approve', 
    remarks: '',
    givenFromTankNo: '' 
  });

  useEffect(() => {
    initializeDefaultStocks();
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint =
        activeTab === 'pending'
          ? `${API_BASE_URL}/indent-approval/pending`
          : `${API_BASE_URL}/indent-approval/history`;

      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.status === 'success') {
        const mapped: ApprovalItem[] = result.data.map((item: any) => {
          if (activeTab === 'history' && item.indentDetails) {
            const histQty = item.indentDetails.indent_quantity || '0';
            const histWeight = item.indentDetails.total_weight_kg || item.indentDetails.oil_required || '0';
            return {
              id: item.production_id,
              indentQuantity: parseFloat(histQty),
              productName: item.indentDetails.product_name,
              packingSize: item.indentDetails.packing_size,
              packingType: item.indentDetails.packing_type || item.packing_type,
              partyName: item.indentDetails.party_name || item.party_name,
              tankNo: item.indentDetails.tank_no || item.tank_no,
              totalWeightKg: parseFloat(histWeight),
              status: item.status || 'Submitted',
              approvedWeight: item.approved_qty ? parseFloat(item.approved_qty) : 0,
              remarks: item.remarks,
              createdAt: item.createdAt || item.indentDetails?.created_at,
            };
          }
          const pendingQty = item.indent_quantity || '0';
          const pendingWeight = item.total_weight_kg || item.oil_required || '0';
          return {
            id: item.production_id,
            indentQuantity: parseFloat(pendingQty),
            productName: item.product_name,
            packingSize: item.packing_size,
            packingType: item.packing_type,
            partyName: item.party_name,
            tankNo: item.tank_no,
            totalWeightKg: parseFloat(pendingWeight),
            status: item.status || 'Submitted',
            approvedWeight: 0,
            createdAt: item.createdAt || item.created_at,
          };
        });
        setApprovals(mapped);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Grouping ────────────────────────────────────────────────────────────────

  const groupByOilType = (list: ApprovalItem[]): OilTypeGroup[] => {
    const oilGroups: Record<string, OilTypeGroup> = {};

    list.forEach(item => {
      const oilType = categorizeOilType(item.productName);
      const productKey = normalizeProductKey(item.productName, item.packingSize);

      if (!oilGroups[oilType]) {
        oilGroups[oilType] = { type: oilType, totalQuantity: 0, totalWeightKg: 0, products: [] };
      }

      let productGroup = oilGroups[oilType].products.find(p => p.productKey === productKey);
      if (!productGroup) {
        const stock = getProductStock(productKey);
        productGroup = {
          productKey,
          productName: item.productName,
          packingSize: item.packingSize,
          packingType: item.packingType || '-',
          totalQuantity: 0,
          totalWeightKg: 0,
          availableStock: stock,
          shortage: 0,
          status: item.status,
          items: [],
        };
        oilGroups[oilType].products.push(productGroup);
      }

      productGroup.totalQuantity += item.indentQuantity;
      productGroup.totalWeightKg += item.totalWeightKg;
      productGroup.items.push(item);
      oilGroups[oilType].totalQuantity += item.indentQuantity;
      oilGroups[oilType].totalWeightKg += item.totalWeightKg;
    });

    // Calculate shortage per product
    Object.values(oilGroups).forEach(og =>
      og.products.forEach(pg => {
        pg.shortage = Math.max(0, pg.totalWeightKg - pg.availableStock);
      })
    );

    return Object.values(oilGroups);
  };

  const toggleOilType = (type: string) =>
    setExpandedOilTypes(prev => ({ ...prev, [type]: !prev[type] }));

  // ── Approval form helpers ────────────────────────────────────────────────────

  const handleProductSelect = (oilType: string) => {
    setSelectedProduct(oilType);
    const group = groupByOilType(approvals).find(g => g.type === oilType);
    if (group) {
      const allItems = group.products.flatMap(p => p.items);
      setSelectedItems(allItems.map(i => i.id));
      const quantities: Record<string, number> = {};
      allItems.forEach(i => { quantities[i.id] = i.indentQuantity; });
      setEditedQuantities(quantities);
      const total = allItems.reduce((s, i) => s + i.indentQuantity, 0);
      setApprovedQtyInput(String(total));
    }
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleApprovalSubmit = async () => {
    if (!selectedProduct || selectedItems.length === 0) {
      alert('Please select an oil type and at least one item');
      return;
    }
    if (formData.action === 'approve' && !formData.givenFromTankNo) {
      alert('Please select a tank in "Give from Tank No." field');
      return;
    }
    try {
      for (const productionId of selectedItems) {
        const item = approvals.find(a => a.id === productionId);
        if (!item) continue;

        const body = {
          productionId,
          approvedWeightKg: editedQuantities[productionId] ?? item.indentQuantity,
          status: formData.action === 'approve' ? 'Confirmed' : 'Rejected',
          remarks: formData.remarks,
          givenFromTankNo: formData.givenFromTankNo,
        };

        const res = await fetch(`${API_BASE_URL}/indent-approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to submit approval');
      }

      alert('Action processed successfully');
      setShowApprovalForm(false);
      setSelectedProduct('');
      setSelectedItems([]);
      fetchData();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to process action');
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const oilTypeGroups = groupByOilType(approvals);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Oil Indent Approval"
        description="Review and approve oil indents from packing department"
      />

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {(['pending', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-card-foreground border border-border'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8" />
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name / Oil Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Qty (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={6} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {oilTypeGroups.map((group, gi) => {
                  const isGroupExpanded = expandedOilTypes[group.type] || false;
                  return (
                    <Fragment key={gi}>
                      <tr
                        className="bg-card/50 hover:bg-card cursor-pointer transition-colors"
                        onClick={() => toggleOilType(group.type)}
                      >
                        <td className="px-4 py-3 text-left">
                          {isGroupExpanded
                            ? <ChevronDown className="h-5 w-5 text-primary" />
                            : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                        </td>
                        <td className="px-4 py-3 text-base font-bold text-primary">
                          {group.type}
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({group.products.length} Products)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-base font-bold text-foreground">
                          {formatNumber(group.totalWeightKg)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">-</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="outline">Submitted</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {activeTab === 'pending' && (
                            <Button 
                              size="sm" 
                              className="h-8 py-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProductSelect(group.type);
                                setShowApprovalForm(true);
                              }}
                            >
                              Process
                            </Button>
                          )}
                        </td>
                      </tr>

                      {/* Level 2 – Group Summary (Replaces intermediate product list) */}
                      {isGroupExpanded && (
                        <tr className="bg-card/5 font-sans">
                          <td colSpan={6} className="px-4 py-6 pl-12">
                            <div className="grid grid-cols-3 gap-6">
                              <div className="p-4 bg-muted/20 rounded-lg border border-border flex flex-col justify-center">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 text-center">Total Indent</span>
                                <p className="text-xl font-bold text-primary text-center">{formatNumber(group.totalWeightKg)} Kg</p>
                              </div>
                              
                              <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800 flex flex-col justify-center">
                                <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1 text-center">Approve Indent</span>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400 text-center">
                                  {formatNumber(group.products.reduce((sum, p) => sum + p.items.reduce((iSum, item) => iSum + (item.approvedWeight || 0), 0), 0))} Kg
                                </p>
                              </div>

                              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800 flex flex-col justify-center">
                                <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-1 text-center">Remaining Indent</span>
                                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400 text-center">
                                  {formatNumber(Math.max(0, group.totalWeightKg - group.products.reduce((sum, p) => sum + p.items.reduce((iSum, item) => iSum + (item.approvedWeight || 0), 0), 0)))} Kg
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {oilTypeGroups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No {activeTab === 'pending' ? 'pending' : 'history'} approvals
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </Card>

      {showApprovalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Indent Approval</h2>

              <div className="bg-muted/30 p-4 rounded-lg border border-border mb-6">
                <h3 className="text-lg font-bold text-primary">{selectedProduct}</h3>
                <p className="text-xs text-muted-foreground">Review and approve indents for the selected oil type.</p>
              </div>

              {selectedProduct && (() => {
                const group = oilTypeGroups.find(g => g.type === selectedProduct);
                if (!group) return null;

                const originalIndentTotal = selectedItems.reduce((s, id) => {
                  const item = group.products.flatMap(p => p.items).find(i => i.id === id);
                  return s + (item?.indentQuantity ?? 0);
                }, 0);

                const totalApprovedWeight = selectedItems.reduce((s, id) => {
                  const item = group.products.flatMap(p => p.items).find(i => i.id === id);
                  return s + (editedQuantities[id] ?? item?.indentQuantity ?? 0);
                }, 0);

                const totalAvailableStock = group.products.reduce((s, p) => s + p.availableStock, 0);

                return (
                  <>
                    <div className="flex justify-between items-end mb-3">
                      <div className="grid grid-cols-3 gap-6 flex-1">
                        <div>
                          <span className="text-xs text-muted-foreground uppercase font-semibold">Available Stock:</span>
                          <p className="font-bold text-lg text-foreground">{totalAvailableStock || 0} Kg</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground uppercase font-semibold">Total Indent:</span>
                          <p className="font-bold text-lg text-primary">{formatNumber(originalIndentTotal)} Kg</p>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground uppercase font-semibold">Receive Tank No:</span>
                            <div className="flex gap-1 mt-1">
                                {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.tankNo)).filter(Boolean))).map(t => (
                                    <Badge key={t} variant="outline" className="text-primary border-primary">T-{t}</Badge>
                                )) || <span className="text-muted-foreground">None</span>}
                            </div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border">
                        <p className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Item to be packed</p>
                        <div className="text-lg font-bold text-primary">
                            {Array.from(new Set(group.products.map(p => {
                                let oilClass = '';
                                const lowerName = p.productName.toLowerCase();
                                if (lowerName.includes('palm') || lowerName.includes('palmolein') || lowerName.includes('hk')) oilClass = 'HK';
                                else if (lowerName.includes('soybean') || lowerName.includes('soya') || lowerName.includes('sbo')) oilClass = 'Soya';
                                else if (lowerName.includes('rice bran oil') || lowerName.includes('rbo') || lowerName.includes('rice bran')) oilClass = 'RBO';
                                else if (lowerName.includes('mustard') || lowerName.includes('kachi ghani')) oilClass = 'Mustard';
                                else if (lowerName.includes('sunflower')) oilClass = 'Sunflower';
                                else if (lowerName.includes('groundnut')) oilClass = 'Groundnut';
                                else oilClass = p.productName;
                                
                                return `${oilClass} ${p.packingType || 'Tin'}`;
                            }))).join(', ')}
                        </div>
                    </div>



                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Action</label>
                          <select
                            value={formData.action}
                            onChange={e => setFormData({ ...formData, action: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                          >
                            <option value="approve">Approve</option>
                            <option value="reject">Reject</option>
                          </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Give from Tank No. {formData.action === 'approve' && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            <select
                                value={formData.givenFromTankNo}
                                onChange={e => setFormData({ ...formData, givenFromTankNo: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none ${
                                  formData.action === 'approve' && !formData.givenFromTankNo
                                    ? 'border-red-400 focus:ring-red-400/50'
                                    : 'border-border'
                                }`}
                            >
                                <option value="">-- Select Tank --</option>
                                <option value="1">Tank 1</option>
                                <option value="2">Tank 2</option>
                                <option value="3">Tank 3</option>
                            </select>
                            {formData.action === 'approve' && !formData.givenFromTankNo && (
                              <p className="text-xs text-red-500 mt-1">Tank selection is required for approval</p>
                            )}
                        </div>
                    </div>

                    {(() => {
                      const typedApproval = parseFloat(approvedQtyInput) || 0;
                      const remainingApprovalQty = Math.max(0, originalIndentTotal - typedApproval);
                      return (
                        <div className="mb-6 grid grid-cols-3 gap-4">
                          <div className="p-4 bg-muted/30 rounded-lg border border-border flex flex-col justify-center">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Indent Qty</span>
                            <p className="text-xl font-bold text-primary">{formatNumber(originalIndentTotal)} Kg</p>
                          </div>

                          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-300 flex flex-col justify-center">
                            <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-1">Remaining Approval Qty</span>
                            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{formatNumber(remainingApprovalQty)} Kg</p>
                          </div>

                          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 flex flex-col justify-center">
                            <span className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Total Approved Qty (Kg)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={approvedQtyInput}
                              onChange={(e) => setApprovedQtyInput(e.target.value)}
                              onBlur={(e) => {
                                const newTotal = parseFloat(e.target.value) || 0;
                                if (newTotal > originalIndentTotal) {
                                  alert(`Total approved qty cannot exceed total indent qty (${originalIndentTotal} Kg)`);
                                  setApprovedQtyInput(String(totalApprovedWeight));
                                  return;
                                }
                                if (selectedItems.length > 0) {
                                  const firstId = selectedItems[0];
                                  const currentSumWithoutFirst = selectedItems.slice(1).reduce((s, id) => {
                                    const it = group.products.flatMap(p => p.items).find(i => i.id === id);
                                    return s + (editedQuantities[id] ?? it?.indentQuantity ?? 0);
                                  }, 0);
                                  const firstItem = group.products.flatMap(p => p.items).find(i => i.id === firstId);
                                  const remainingForFirst = newTotal - currentSumWithoutFirst;
                                  if (firstItem && remainingForFirst > firstItem.indentQuantity) {
                                    alert('Cannot distribute total quantity without exceeding individual item indent limits.');
                                    setApprovedQtyInput(String(totalApprovedWeight));
                                    return;
                                  }
                                  setEditedQuantities(prev => ({ ...prev, [firstId]: Math.max(0, remainingForFirst) }));
                                }
                              }}
                              className="w-full px-3 py-2 text-xl font-black text-primary bg-background border-2 border-primary/30 rounded-lg focus:border-primary outline-none text-right mt-1"
                              placeholder="Enter qty"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                      <textarea
                        value={formData.remarks}
                        onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                        placeholder="Add approval or rejection remarks"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground h-20"
                      />
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApprovalForm(false);
                    setSelectedProduct('');
                    setSelectedItems([]);
                    setEditedQuantities({});
                    setFormData({ action: 'approve', remarks: '', givenFromTankNo: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApprovalSubmit}
                  className={formData.action === 'approve' ? 'bg-primary hover:bg-primary/90' : 'bg-red-600 hover:bg-red-700'}
                  disabled={!selectedProduct || selectedItems.length === 0 || (formData.action === 'approve' && !formData.givenFromTankNo)}
                >
                  {formData.action === 'approve' ? 'Approve & Send to Lab' : 'Reject Selected'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OilIndentApproval;

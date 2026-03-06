'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import TableSkeleton from '@/components/table-skeleton';


// ─── Types ────────────────────────────────────────────────────────────────────

interface RawMaterialReceiptItem {
  id: string; // Unique key for selection (issueId or production_id)
  production_id: string;
  issueId?: number;
  productName: string;
  packingSize: string;
  packingType: string;
  partyName: string;
  plannedQty: number; // Shows oilQty
  oilQty: number;
  totalWeightKg: number;
  tankNo: string;
  givenTankNo: string;
  status: string;
  bom: Array<{
    id: number;
    item_name: string;
    qty_required: number;
    qty_allocated: number;
  }>;
}

interface ProductGroup {
  productKey: string;
  productName: string;
  packingSize?: string;
  packingType: string;
  totalQuantity: number;
  totalWeightKg: number;
  items: RawMaterialReceiptItem[];
}

interface OilTypeGroup {
  type: string;
  totalQuantity: number;
  totalWeightKg: number;
  products: ProductGroup[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (n.includes('rice bran oil') || n.includes('rbo') || n.includes('rice bran') || n.includes('rice')) return 'Rice Bran Oil';
  if (n.includes('soybean') || n.includes('soya') || n.includes('sbo')) return 'Soybean Oil';
  if (n.includes('palm') || n.includes('palmolein')) return 'Palm Oil';
  if (n.includes('mustard') || n.includes('kachi ghani')) return 'Mustard Oil';
  if (n.includes('sunflower')) return 'Sunflower Oil';
  if (n.includes('groundnut')) return 'Groundnut Oil';
  return 'Other Oils';
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'received': return 'bg-green-100 text-green-800';
    case 'pending':  return 'bg-yellow-100 text-yellow-800';
    default:         return 'bg-gray-100 text-gray-800';
  }
};

const RawMaterialReceipt = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [receipts, setReceipts] = useState<RawMaterialReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [selectedOilType, setSelectedOilType] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [formDetailsExpanded, setFormDetailsExpanded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'pending'
        ? `${API_BASE_URL}/raw-material-receipt/pending`
        : `${API_BASE_URL}/raw-material-receipt/history`;
      
      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.status === 'success') {
        const mappedData = result.data.map((item: any) => {
          if (activeTab === 'history') {
             return {
                id: String(item.issue_id || item.production_id || Math.random()),
                production_id: item.production_id,
                issueId: item.issue_id,
                productName: item.indentDetails?.product_name || 'N/A',
                packingSize: item.indentDetails?.packing_size || '',
                packingType: item.indentDetails?.packing_type || '',
                partyName: item.indentDetails?.party_name || 'N/A',
                plannedQty: Number(item.oil_qty || 0),
                oilQty: Number(item.oil_qty || 0),
                totalWeightKg: Number(item.indentDetails?.total_weight_kg || 0),
                tankNo: item.indentDetails?.tank_no || '-',
                givenTankNo: item.indentDetails?.given_from_tank_no || '-',
                status: 'Received',
                bom: item.bom || []
             };
          }
          return {
            id: String(item.issue_id || item.id || item.production_id),
            production_id: item.production_id,
            issueId: item.issue_id,
            productName: item.product_name,
            packingSize: item.packing_size || '',
            packingType: item.packing_type || '',
            partyName: item.party_name,
            plannedQty: Number(item.oil_qty || 0),
            oilQty: Number(item.oil_qty || 0),
            totalWeightKg: Number(item.total_weight_kg || 0),
            tankNo: item.tank_no || '-',
            givenTankNo: item.given_from_tank_no || '-',
            status: 'Pending',
            bom: item.bom || []
          };
        });
        setReceipts(mappedData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const groupByOilType = (list: RawMaterialReceiptItem[]): OilTypeGroup[] => {
    const oilGroups: Record<string, OilTypeGroup> = {};

    list.forEach(item => {
      const oilType = categorizeOilType(item.productName);
      const productKey = normalizeProductKey(item.productName, item.packingSize);

      if (!oilGroups[oilType]) {
        oilGroups[oilType] = { type: oilType, totalQuantity: 0, totalWeightKg: 0, products: [] };
      }

      let productGroup = oilGroups[oilType].products.find(p => p.productKey === productKey);
      if (!productGroup) {
        productGroup = {
          productKey,
          productName: item.productName,
          packingSize: item.packingSize,
          packingType: item.packingType || '-',
          totalQuantity: 0,
          totalWeightKg: 0,
          items: [],
        };
        oilGroups[oilType].products.push(productGroup);
      }

      productGroup.totalQuantity += item.plannedQty;
      productGroup.totalWeightKg += item.totalWeightKg;
      productGroup.items.push(item);
      oilGroups[oilType].totalQuantity += item.plannedQty;
      oilGroups[oilType].totalWeightKg += item.totalWeightKg;
    });

    return Object.values(oilGroups);
  };

  const handleReceiptSubmit = async () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item');
      return;
    }

    try {
      for (const id of selectedItems) {
        const item = receipts.find(r => r.id === id);
        if (!item) continue;

        const response = await fetch(`${API_BASE_URL}/raw-material-receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productionId: item.production_id,
            issueId: item.issueId,
            oilQty: item.oilQty,
            remarks,
            receivedBy: 'Production Head'
          })
        });

        if (!response.ok) throw new Error(`Failed to process receipt for ${item.production_id}`);
      }

      alert('✅ Raw materials received successfully!');
      setShowForm(false);
      setSelectedItems([]);
      setRemarks('');
      setFormDetailsExpanded(false);
      fetchData();
    } catch (error) {
      console.error('Error submitting receipts:', error);
      alert('❌ Error processing material receipt');
    }
  };

  const oilTypeGroups = groupByOilType(receipts);

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Raw Material Receipt"
        description="Record receipt of issued raw materials in production"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground border border-border'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground border border-border'
          }`}
        >
          History
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type of Oil</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Item(s) to be packed</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Oil Qty (KG)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Given Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={7} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {oilTypeGroups.map((group, gIdx) => {
                const uniqueItemsPacked = Array.from(new Set(group.products.flatMap(p => {
                    const parts = p.productName.split(' ');
                    return parts.length >= 2 ? [parts[0], parts[1]] : [parts[0]];
                  }))).join(', ') || '-';

                return (
                  <tr key={gIdx} className="hover:bg-card/50 transition-colors">
                    <td className="px-4 py-3 text-base font-bold text-primary">
                      {group.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <Badge variant="outline" className="font-mono">{uniqueItemsPacked}</Badge>
                    </td>
                    <td className="px-4 py-3 text-base font-bold text-foreground font-mono">
                      {formatNumber(group.totalQuantity)} KG
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {group.products[0]?.items[0]?.givenTankNo || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {group.products[0]?.items[0]?.tankNo || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className={getStatusColor(activeTab === 'pending' ? 'Pending' : 'Received')}>
                        {activeTab === 'pending' ? 'Pending' : 'Received'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {activeTab === 'pending' && (
                        <Button 
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => {
                            setSelectedOilType(group.type);
                            const allIds = group.products.flatMap(p => p.items.map(i => i.id));
                            setSelectedItems(allIds);
                            setShowForm(true);
                          }}
                        >
                          Process
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {oilTypeGroups.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No {activeTab === 'pending' ? 'pending' : 'history'} receipts
                  </td>
                </tr>
              )}
            </tbody>
            )}
          </table>
        </div>
      </Card>

      {/* Process Receipt Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-background border-border shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-2">
              <h2 className="text-xl font-bold text-foreground">Process Material Receipt</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="space-y-6">
              {selectedOilType && (() => {
                const group = oilTypeGroups.find(g => g.type === selectedOilType);
                if (!group) return null;

                return (
                  <>
                    <div className="bg-muted/30 p-4 rounded-lg border border-border">
                        <h3 className="text-lg font-bold text-primary">{selectedOilType}</h3>
                        <p className="text-xs text-muted-foreground">Verify and receive raw materials in production floor.</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-foreground">Items & BOM Details</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormDetailsExpanded(!formDetailsExpanded)}
                          className="h-8 py-0 underline text-primary"
                        >
                          {formDetailsExpanded ? 'Hide Details' : 'Show Details'}
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {group.products.map((prod, pi) => {
                          const checkedItems = prod.items.filter(i => selectedItems.includes(i.id));
                          
                          // Consolidate BOM for display
                          const consolidatedBOM: Record<string, { required: number, allocated: number }> = {};
                          checkedItems.forEach(item => {
                             item.bom.forEach(b => {
                                if (!consolidatedBOM[b.item_name]) {
                                   consolidatedBOM[b.item_name] = { required: 0, allocated: 0 };
                                }
                                consolidatedBOM[b.item_name].required += Number(b.qty_required);
                                consolidatedBOM[b.item_name].allocated += Number(b.qty_allocated);
                             });
                          });

                          return (
                            <div key={pi} className="border border-border rounded-lg overflow-hidden flex flex-col">
                              <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">
                                  {prod.productName}{prod.packingSize ? ' ' + prod.packingSize : ''}
                                </span>
                                <div className="text-xs text-muted-foreground">
                                  Selected Oil Qty: <strong>{formatNumber(checkedItems.reduce((acc, c) => acc + c.oilQty, 0))}</strong>
                                </div>
                              </div>

                              {formDetailsExpanded && (
                                <table className="w-full text-sm border-b border-border">
                                  <thead className="bg-muted/20 border-b border-border">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">Select</th>
                                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Production ID</th>
                                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tank Info</th>
                                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Party Name</th>
                                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Oil Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border bg-background">
                                    {prod.items.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-muted/30">
                                        <td className="px-3 py-2">
                                          <input
                                            type="checkbox"
                                            checked={selectedItems.includes(item.id)}
                                            onChange={() => {
                                              setSelectedItems(prev => 
                                                prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                              );
                                            }}
                                            className="w-4 h-4 rounded border-primary text-primary"
                                          />
                                        </td>
                                        <td className="px-3 py-2 font-mono text-xs">{item.production_id}</td>
                                        <td className="px-4 py-2 text-xs">
                                          <div className="flex flex-col">
                                            <span>Tank: {item.tankNo}</span>
                                            <span className="text-orange-600">Given: {item.givenTankNo}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2">{item.partyName}</td>
                                        <td className="px-3 py-2 font-semibold text-primary">{formatNumber(item.oilQty)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {Object.keys(consolidatedBOM).length > 0 && checkedItems.length > 0 && (
                                <div className="p-3 bg-muted/10">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Consolidated BOM items to Receive</div>
                                  <table className="w-full text-sm bg-background rounded border border-border">
                                    <thead className="bg-muted/20">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Material</th>
                                        <th className="px-3 py-2 text-left">Qty Required</th>
                                        <th className="px-3 py-2 text-left">Qty Allocated</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {Object.entries(consolidatedBOM).map(([name, qtys], bi) => (
                                        <tr key={bi}>
                                          <td className="px-3 py-2 font-medium">{name}</td>
                                          <td className="px-3 py-2">{formatNumber(qtys.required)}</td>
                                          <td className="px-3 py-2 text-green-600 font-bold">{formatNumber(qtys.allocated)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                      <textarea
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Internal notes for this receipt"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground h-20"
                      />
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button 
                  onClick={handleReceiptSubmit} 
                  disabled={selectedItems.length === 0}
                >
                  Confirm Receipt
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RawMaterialReceipt;

'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
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
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Approval form state
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [formDetailsExpanded, setFormDetailsExpanded] = useState(true);
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

  const toggleProduct = (key: string) =>
    setExpandedProducts(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Approval form helpers ────────────────────────────────────────────────────

  // selectedProduct now stores the Oil Type string (e.g. "Rice Bran Oil")
  const handleProductSelect = (oilType: string) => {
    setSelectedProduct(oilType);
    setFormDetailsExpanded(false); // Reset expanded state on product change
    const group = groupByOilType(approvals).find(g => g.type === oilType);
    if (group) {
      const allItems = group.products.flatMap(p => p.items);
      setSelectedItems(allItems.map(i => i.id));
      const quantities: Record<string, number> = {};
      allItems.forEach(i => { quantities[i.id] = i.totalWeightKg; }); // Use weight in Kg by default
      setEditedQuantities(quantities);
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
    try {
      for (const productionId of selectedItems) {
        const item = approvals.find(a => a.id === productionId);
        if (!item) continue;

        const body = {
          productionId,
          approvedWeightKg: editedQuantities[productionId] || item.totalWeightKg,
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
  // Dropdown lists unique Oil Types (e.g. "Rice Bran Oil", "Palm Oil")
  const uniqueOilTypes = oilTypeGroups.map(g => g.type);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Oil Indent Approval"
        description="Review and approve oil indents from packing department"
      />

      {/* Tabs + Action Button */}
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

      {/* Main Table */}
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
                    {/* Level 1 – Oil Type */}
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

                    {/* Level 2 – Products */}
                    {isGroupExpanded && group.products.map((product, pi) => {
                      const isProductExpanded = expandedProducts[product.productKey] || false;
                      const displayName = `${product.productName}${product.packingSize ? ' ' + product.packingSize : ''}`;

                      return (
                        <Fragment key={pi}>
                          <tr
                            className="bg-background hover:bg-card/30 cursor-pointer transition-colors border-l-4 border-l-primary/20"
                            onClick={() => toggleProduct(product.productKey)}
                          >
                            <td className="px-4 py-3 text-left pl-8">
                              {isProductExpanded
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-foreground pl-4">
                              {displayName}
                              <span className="text-xs text-muted-foreground ml-2">
                                ({product.items.length} orders)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-foreground">
                              {formatNumber(product.totalWeightKg)}
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground">
                              {product.availableStock}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge className={getStatusColor(product.status)}>
                                {product.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm" />
                          </tr>

                          {/* Level 3 – Order Details */}
                          {isProductExpanded && (
                            <tr className="bg-card/10">
                              <td colSpan={6} className="px-4 py-2 pl-12">
                                <div className="rounded-md border border-border overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-card/50">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Timestamp</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Production ID</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Indent Qty (Kg)</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Packing Type</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Receive Tank No.</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                                        {product.items.some(i => i.remarks) && (
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Remarks</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50 bg-background">
                                      {product.items.map((order, oi) => (
                                        <tr key={oi} className="hover:bg-muted/30">
                                          <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs">{order.id}</td>
                                          <td className="px-3 py-2 font-semibold text-primary">{formatNumber(order.totalWeightKg)}</td>
                                          <td className="px-3 py-2">{order.packingType}</td>
                                          <td className="px-3 py-2">
                                            {order.tankNo ? (
                                                <Badge variant="secondary" className="bg-secondary/50">Tank {order.tankNo}</Badge>
                                            ) : '-'}
                                          </td>
                                          <td className="px-3 py-2">
                                            <Badge className={getStatusColor(order.status)}>
                                              {order.status}
                                            </Badge>
                                          </td>
                                          {product.items.some(i => i.remarks) && (
                                            <td className="px-3 py-2 text-muted-foreground">{order.remarks || '-'}</td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
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

      {/* Approval Form Modal */}
      {showApprovalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Indent Approval</h2>

              {/* Context Header */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border mb-6">
                <h3 className="text-lg font-bold text-primary">{selectedProduct}</h3>
                <p className="text-xs text-muted-foreground">Review and approve indents for the selected oil type.</p>
              </div>

              {/* Order Selection */}
              {selectedProduct && (() => {
                const group = oilTypeGroups.find(g => g.type === selectedProduct);
                if (!group) return null;

                const totalSelectedQty = selectedItems.reduce((s, id) => {
                  const item = group.products.flatMap(p => p.items).find(i => i.id === id);
                  return s + (editedQuantities[id] ?? item?.totalWeightKg ?? 0);
                }, 0);
                const totalAvailableStock = group.products.reduce((s, p) => s + p.availableStock, 0);
                const totalShortage = Math.max(0, totalSelectedQty - totalAvailableStock);
                const totalApprovedWeight = totalSelectedQty;

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
                          <p className="font-bold text-lg text-primary">{formatNumber(totalSelectedQty)} Kg</p>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormDetailsExpanded(!formDetailsExpanded)}
                        className="p-1 h-auto"
                      >
                        {formDetailsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </Button>
                    </div>

                    {/* Item to be packed section - Always Visible */}
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

                    {/* Items Table — grouped by product, collapsible */}
                    {formDetailsExpanded && (
                      <div className="mb-6 space-y-4 animate-in fade-in duration-300">
                        {group.products.map((prod, pi) => (
                          <div key={pi} className="border border-border rounded-lg overflow-hidden">
                            {/* Product sub-header */}
                            <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                {prod.productName}{prod.packingSize ? ' ' + prod.packingSize : ''}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Stock: {prod.availableStock}
                              </span>
                            </div>
                            <table className="w-full text-sm">
                              <thead className="bg-muted/20 border-b border-border">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Select</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Timestamp</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Production ID</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Packing Type</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Indent Qty (Kg)</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Approved Qty (Kg)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-background">
                                {prod.items.map((item: ApprovalItem, idx: number) => (
                                  <tr key={idx} className="hover:bg-muted/30">
                                    <td className="px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedItems.includes(item.id)}
                                        onChange={() => handleItemToggle(item.id)}
                                        className="w-4 h-4 rounded border-primary text-primary"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">
                                      {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{item.id}</td>
                                    <td className="px-3 py-2">{item.packingType}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{formatNumber(item.totalWeightKg)}</td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number"
                                        value={editedQuantities[item.id] ?? item.totalWeightKg}
                                        onChange={e => setEditedQuantities(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                        className="w-28 px-3 py-1.5 border border-primary/30 rounded bg-background text-foreground font-bold text-sm focus:border-primary outline-none transition-all"
                                        min="0"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action & Tank Section */}
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
                            <label className="block text-sm font-medium text-foreground mb-2">Give from Tank No.</label>
                            <select
                                value={formData.givenFromTankNo}
                                onChange={e => setFormData({ ...formData, givenFromTankNo: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                                <option value="">-- Select Tank --</option>
                                <option value="1">Tank 1</option>
                                <option value="2">Tank 2</option>
                                <option value="3">Tank 3</option>
                            </select>
                        </div>
                    </div>

                    {/* Total Approved Summary - Now an Input Box */}
                    <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between gap-4">
                        <label className="text-sm font-bold text-primary uppercase whitespace-nowrap">Total Approved Qty (Kg)</label>
                        <div className="relative flex-1 max-w-50">
                            <input
                                type="number"
                                value={totalApprovedWeight}
                                onChange={(e) => {
                                    const newTotal = Number(e.target.value);
                                    // Handle distributing the total back to items if needed, 
                                    // or just update a master total state. 
                                    // For now, let's just update the editedQuantities of the first item 
                                    // as a simple way to keep things in sync for submission.
                                    if (selectedItems.length > 0) {
                                        const firstId = selectedItems[0];
                                        const currentSumWithoutFirst = selectedItems.slice(1).reduce((s, id) => {
                                            const item = group.products.flatMap(p => p.items).find(i => i.id === id);
                                            return s + (editedQuantities[id] ?? item?.totalWeightKg ?? 0);
                                        }, 0);
                                        setEditedQuantities(prev => ({
                                            ...prev,
                                            [firstId]: Math.max(0, newTotal - currentSumWithoutFirst)
                                        }));
                                    }
                                }}
                                className="w-full px-4 py-2 text-xl font-black text-primary bg-background border-2 border-primary/30 rounded-lg focus:border-primary outline-none text-right"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary font-bold hidden">Kg</span>
                        </div>
                    </div>



                    {/* Remarks */}
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
                  disabled={!selectedProduct || selectedItems.length === 0}
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

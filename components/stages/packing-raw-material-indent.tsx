'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';


interface RawMaterialIndentItem {
  id: string; // production_id
  orderRef: string;
  productName: string;
  packingSize: string;
  packingType: string;
  partyName: string;
  plannedQty: number; // Retained for fallback
  actualDispatchQty: number;
  actualDispatchKg: number;
  balanceQty: number;
  balanceKg: number;
  tankNo?: string;
  givenFromTankNo?: string;
  status: string;
  bom: Array<{
    rmname: string;
    rmqty: string;
    rmunit: string;
    mainqty: string;
    mainuom: string;
  }>;
}

interface AggregatedProduct {
  id: string;
  productName: string;
  packingSize?: string;
  totalPlannedQty: number;
  totalActualDispatchQty: number;
  totalActualDispatchKg: number;
  totalBalanceQty: number;
  totalBalanceKg: number;
  shortage: number;
  availableStock: number;
  orders: RawMaterialIndentItem[];
  status: string;
}

interface OilTypeGroup {
  type: string;
  totalPlannedQty: number;
  totalActualDispatchQty: number;
  totalActualDispatchKg: number;
  totalBalanceQty: number;
  totalBalanceKg: number;
  products: AggregatedProduct[];
}

// Helper to format numbers
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const formatNumber = (num: number | undefined) => {
  if (num === undefined || num === null) return '-';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(num);
};

const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

const categorizeOilType = (productName: string): string => {
  const lowerName = productName.toLowerCase();
  if (lowerName.includes('rice bran oil') || lowerName.includes('rbo') || lowerName.includes('rice bran')) {
    return 'Rice Bran Oil';
  } else if (lowerName.includes('soybean') || lowerName.includes('soya') || lowerName.includes('sbo')) {
    return 'Soybean Oil';
  } else if (lowerName.includes('palm') || lowerName.includes('palmolein')) {
    return 'Palm Oil';
  } else if (lowerName.includes('mustard') || lowerName.includes('kachi ghani')) {
    return 'Mustard Oil';
  } else if (lowerName.includes('sunflower')) {
    return 'Sunflower Oil';
  } else if (lowerName.includes('groundnut')) {
    return 'Groundnut Oil';
  } else {
    return 'Other Oils';
  }
};

const PackingRawMaterialIndent = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [indents, setIndents] = useState<RawMaterialIndentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOilTypes, setExpandedOilTypes] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [showIndentForm, setShowIndentForm] = useState(false);
  const [formDetailsExpanded, setFormDetailsExpanded] = useState<boolean>(false);
  const [selectedOilType, setSelectedOilType] = useState<string>('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  
  // Custom manual tracking for allocate to qty edits mapped down to exactly: `[productName_itemName]: calculatedQty`
  const [bomAllocations, setBomAllocations] = useState<Record<string, number>>({});

  const fetchIndents = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'pending' 
        ? `${API_BASE_URL}/packing-raw-material/pending` 
        : `${API_BASE_URL}/packing-raw-material/history`;
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (activeTab === 'pending') {
        const mappedData = data.map((item: any) => ({
          id: item.production_id,
          orderRef: item.order_id || '-',
          productName: item.product_name,
          packingSize: item.packing_size || '',
          packingType: item.packing_type || '',
          partyName: item.party_name,
          plannedQty: Number(item.indent_quantity || 0),
          actualDispatchQty: Number(item.actual_dispatch_qty || item.indent_quantity || 0),
          actualDispatchKg: Number(item.actual_dispatch_kg || 0),
          balanceQty: Number(item.balance_qty || 0),
          balanceKg: (Number(item.indent_quantity) > 0) ? (Number(item.balance_qty || 0) * (Number(item.actual_dispatch_kg || 0) / Number(item.indent_quantity))) : 0,
          tankNo: item.tank_no || '-',
          givenFromTankNo: item.given_from_tank_no || '-',
          status: 'Pending',
          bom: Array.isArray(item.bom) ? item.bom : []
        }));
        setIndents(mappedData);
      } else {
        const mappedData = data.map((item: any) => ({
          id: item.production_id,
          orderRef: item.indentDetails?.order_id || '-',
          productName: item.indentDetails?.product_name || 'N/A',
          packingSize: item.indentDetails?.packing_size || '',
          packingType: item.indentDetails?.packing_type || '',
          partyName: item.indentDetails?.party_name || 'N/A',
          plannedQty: Number(item.indentDetails?.indent_quantity || 0),
          actualDispatchQty: Number(item.indentDetails?.actual_dispatch_qty || item.indentDetails?.indent_quantity || 0),
          actualDispatchKg: Number(item.indentDetails?.actual_dispatch_kg || 0),
          balanceQty: Number(item.indentDetails?.balance_qty || 0),
          balanceKg: (Number(item.indentDetails?.indent_quantity) > 0) ? (Number(item.indentDetails?.balance_qty || 0) * (Number(item.indentDetails?.actual_dispatch_kg || 0) / Number(item.indentDetails?.indent_quantity))) : 0,
          tankNo: item.indentDetails?.tank_no || '-',
          givenFromTankNo: item.indentDetails?.given_from_tank_no || '-',
          status: item.status,
          bom: item.bom_items.map((bi: any) => ({
            rmname: bi.item_name,
            rmqty: String(bi.qty_required),
            rmunit: '',
            mainqty: '1',
            mainuom: 'Box'
          }))
        }));
        setIndents(mappedData);
      }
    } catch (error) {
      console.error('Error fetching indents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIndents();
  }, [activeTab]);

  const groupIndents = (list: RawMaterialIndentItem[]): OilTypeGroup[] => {
    const groups: Record<string, OilTypeGroup> = {};

    list.forEach(item => {
      const oilType = categorizeOilType(item.productName);
      const productKey = normalizeProductKey(item.productName, item.packingSize);

      if (!groups[oilType]) {
        groups[oilType] = { type: oilType, totalPlannedQty: 0, totalActualDispatchQty: 0, totalActualDispatchKg: 0, totalBalanceQty: 0, totalBalanceKg: 0, products: [] };
      }

      let productGroup = groups[oilType].products.find(p => p.id === productKey);
      if (!productGroup) {
        productGroup = {
          id: productKey,
          productName: item.productName,
          packingSize: item.packingSize,
          totalPlannedQty: 0,
          totalActualDispatchQty: 0,
          totalActualDispatchKg: 0,
          totalBalanceQty: 0,
          totalBalanceKg: 0,
          shortage: 0,
          availableStock: 5000, // Placeholder
          orders: [],
          status: item.status
        };
        groups[oilType].products.push(productGroup);
      }

      groups[oilType].totalPlannedQty += item.plannedQty;
      groups[oilType].totalActualDispatchQty += item.actualDispatchQty;
      groups[oilType].totalActualDispatchKg += item.actualDispatchKg;
      groups[oilType].totalBalanceQty += item.balanceQty;
      groups[oilType].totalBalanceKg += item.balanceKg;
      productGroup.totalPlannedQty += item.plannedQty;
      productGroup.totalActualDispatchQty += item.actualDispatchQty;
      productGroup.totalActualDispatchKg += item.actualDispatchKg;
      productGroup.totalBalanceQty += item.balanceQty;
      productGroup.totalBalanceKg += item.balanceKg;
      productGroup.orders.push(item);
    });

    return Object.values(groups);
  };

  const toggleOilType = (type: string) => {
    setExpandedOilTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'allocated': return 'bg-blue-100 text-blue-800';
      case 'issued': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleOrderToggle = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSubmit = async () => {
    if (selectedOrders.length === 0) {
      alert('Please select at least one order');
      return;
    }

    try {
      const ordersToSubmit = indents.filter(i => selectedOrders.includes(i.id));
      
      for (const order of ordersToSubmit) {
        // Compute base order payload resolving explicit fraction mappings proportionally if an override exists.
        const payload = {
          productionId: order.id,
          bomItems: order.bom.map(b => {
            const effectiveQty = order.balanceQty < order.actualDispatchQty ? order.balanceQty : order.actualDispatchQty;
            const perUnit = parseFloat(b.rmqty?.replace(/,/g, '') || '0');
            const defaultTotalReq = isNaN(perUnit) ? 0 : perUnit * effectiveQty;

            // Compute local override ratio correctly against overall group requests.
            const groupKey = `${order.productName}_${b.rmname}`;
            const groupTotalRequested = ordersToSubmit.filter(i => i.productName === order.productName).reduce((ac, cu) => {
                 const cuEffective = cu.balanceQty < cu.actualDispatchQty ? cu.balanceQty : cu.actualDispatchQty;
                 const upu = parseFloat(cu.bom.find(cb => cb.rmname === b.rmname)?.rmqty?.replace(/,/g, '') || '0');
                 return ac + (isNaN(upu) ? 0 : upu * cuEffective);
            }, 0);

            // Fetch explicit split manual override (Or fallback directly to standard requirement loop)
            let finalAllocatedOut = defaultTotalReq;
            if (bomAllocations[groupKey] !== undefined && groupTotalRequested > 0) {
               // Assign percentage of the override linearly.
               finalAllocatedOut = (defaultTotalReq / groupTotalRequested) * bomAllocations[groupKey];
            }

            return {
              itemName: b.rmname,
              qtyRequired: defaultTotalReq,
              qtyAllocated: finalAllocatedOut
            };
          })
        };

        const response = await fetch(`${API_BASE_URL}/packing-raw-material`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Failed to process order ${order.id}`);
      }

      alert('✅ Packing indents created successfully!');
      setShowIndentForm(false);
      setSelectedOrders([]);
      fetchIndents();
    } catch (error) {
      console.error('Error submitting packing indents:', error);
      alert('❌ Error submitting packing indents');
    }
  };

  const grouped = groupIndents(indents);

  return (
    <div className="p-6 bg-background">
      <StageHeader title="Packing Raw Material Indent" description="Create BOM-based indents for packing materials required for production" />

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border'}`}>Pending</button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'history' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground border border-border'}`}>History</button>
        </div>

        {activeTab === 'pending' && grouped.length > 0 && (
          // Process button on rows instead of global
          <div className="text-sm text-muted-foreground mt-2">
            Click &quot;Process&quot; on any pending oil type to create a packing indent.
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type of Oil</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Item(s) to be packed</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Actual Dispatch Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Orders</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={6} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {grouped.map((group, gIdx) => {
                const uniqueItemsPacked = Array.from(new Set(group.products.flatMap(p => {
                  const parts = p.productName.split(' ');
                  return parts.length >= 2 ? [parts[0], parts[1]] : [parts[0]];
                }))).join(', ') || '-';

                return (
                  <Fragment key={gIdx}>
                    <tr className="bg-card hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-base text-foreground font-bold text-primary">
                        {group.type}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <Badge variant="outline" className="font-mono">{uniqueItemsPacked}</Badge>
                      </td>
                      <td className="px-4 py-3 text-base font-bold text-foreground font-mono">
                        {formatNumber(group.totalActualDispatchQty)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {group.products.reduce((acc, curr) => acc + curr.orders.length, 0)} Orders
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="outline">
                          {activeTab === 'pending' ? 'Pending' : 'Processed'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {activeTab === 'pending' && (
                          <Button 
                            onClick={() => {
                              setSelectedOilType(group.type);
                              const allOrders = group.products.flatMap(p => p.orders.map(o => o.id));
                              setSelectedOrders(allOrders);
                              setShowIndentForm(true);
                            }}
                            size="sm"
                            className="bg-primary hover:bg-primary/90"
                          >
                            Process
                          </Button>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {grouped.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No indents found.</td></tr>
              )}
            </tbody>
            )}
          </table>
        </div>
      </Card>

      {showIndentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 bg-background border-border shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-2">
              <h2 className="text-xl font-bold text-foreground">Create Packing Indent</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowIndentForm(false)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="space-y-6">
              {selectedOilType && (() => {
                const group = grouped.find(g => g.type === selectedOilType);
                if (!group) return null;

                return (
                  <>
                    {/* Context Header */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold text-primary">{selectedOilType}</h3>
                          <p className="text-xs text-muted-foreground">Select orders and allocate raw materials required for packing.</p>
                        </div>
                      </div>
                    </div>

                    {/* Item to be packed section - Always Visible */}
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                        <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Item(s) to be packed</p>
                        <div className="text-lg font-bold text-primary mb-4">
                            {Array.from(new Set(group.products.flatMap(p => {
                              const parts = p.productName.split(' ');
                              return parts.length >= 2 ? [parts[0], parts[1]] : [parts[0]];
                            }))).join(', ')}
                        </div>

                        {/* Tank Details Summary (Inline with Item to be packed) */}
                        <div className="grid grid-cols-4 gap-4 mt-2">
                          <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-lg">
                            <span className="text-xs text-blue-600/80 uppercase font-semibold">Total Actual Dispatch Qty:</span>
                            <p className="font-bold text-foreground text-sm">
                              {formatNumber(group.totalActualDispatchKg)} Kg
                            </p>
                          </div>
                          <div className="p-3 bg-orange-50/50 border border-orange-200/50 rounded-lg">
                            <span className="text-xs text-orange-600/80 uppercase font-semibold">Total Balance Qty:</span>
                            <p className="font-bold text-foreground text-sm">
                              {formatNumber(group.totalBalanceKg)} Kg
                            </p>
                          </div>
                          <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-lg">
                            <span className="text-xs text-blue-600/80 uppercase font-semibold">Receive Tank No:</span>
                            <p className="font-bold text-foreground text-sm">
                              {Array.from(new Set(group.products.flatMap(p => p.orders.map(o => o.tankNo)).filter(v => !!v && v !== '-'))).join(', ') || 'N/A'}
                            </p>
                          </div>
                          <div className="p-3 bg-green-50/50 border border-green-100/50 rounded-lg">
                            <span className="text-xs text-green-600/80 uppercase font-semibold">Give Tank No:</span>
                            <p className="font-bold text-foreground text-sm">
                              {Array.from(new Set(group.products.flatMap(p => p.orders.map(o => o.givenFromTankNo)).filter(v => !!v && v !== '-'))).join(', ') || 'N/A'}
                            </p>
                          </div>
                        </div>
                    </div>

                    {/* Order Details — grouped by product, collapsible */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-foreground">Order Details & BOM</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormDetailsExpanded(!formDetailsExpanded)}
                          className="h-8 py-0 underline text-primary"
                        >
                          {formDetailsExpanded ? 'Hide Details' : 'Show Details'}
                        </Button>
                      </div>
                      
                      {/* We extract the group expansion check to only wrap Orders, explicitly keeping the formDetailsExpanded away from BOM logic */}
                      <div className="space-y-4">
                        {group.products.map((prod, pi) => {
                          // Calculate combined values for this product block based on active checks
                          const checkedProductOrders = prod.orders.filter(o => selectedOrders.includes(o.id));
                          const combinedEffectiveQty = checkedProductOrders.reduce((acc, curr) => acc + (curr.balanceQty < curr.actualDispatchQty ? curr.balanceQty : curr.actualDispatchQty), 0);

                          // Resolve the universal BOM for this product out of the first available order mapping.
                          const productBOM = prod.orders[0]?.bom || [];

                          return (
                              <div key={pi} className="border border-border rounded-lg overflow-hidden flex flex-col">
                                <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                                  <span className="text-sm font-semibold text-foreground">
                                    {prod.productName}{prod.packingSize ? ' ' + prod.packingSize : ''}
                                  </span>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span>Selected Qty: <strong>{formatNumber(combinedEffectiveQty)}</strong></span>
                                      <span>({checkedProductOrders.length}/{prod.orders.length} orders)</span>
                                  </div>
                                </div>
                                
                                {/* Orders Inner Table (Collapsible) */}
                                {formDetailsExpanded && (
                                  <table className="w-full text-sm border-b border-border">
                                    <thead className="bg-muted/20 border-b border-border">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">Select</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Order Ref</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Actual Dispatch Qty</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground border-l border-border/40">Actual Dispatch Qty (Kg)</th>
                                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Packing Type</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border bg-background">
                                      {prod.orders.map((order, idx) => (
                                        <tr key={idx} className="hover:bg-muted/30">
                                          <td className="px-3 py-2">
                                            <input
                                              type="checkbox"
                                              checked={selectedOrders.includes(order.id)}
                                              onChange={() => handleOrderToggle(order.id)}
                                              className="w-4 h-4 rounded border-primary text-primary"
                                            />
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs">{order.orderRef}</td>
                                          <td className="px-3 py-2 font-semibold text-primary">{formatNumber(order.balanceQty < order.actualDispatchQty ? order.balanceQty : order.actualDispatchQty)}</td>
                                          <td className="px-3 py-2 border-l border-border/40 font-semibold text-orange-600/90">{formatNumber(order.actualDispatchKg)} Kg</td>
                                          <td className="px-3 py-2 text-muted-foreground">{order.packingType || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}

                                {/* Aggregated BOM Matrix directly underneath */}
                                {productBOM.length > 0 && checkedProductOrders.length > 0 && (
                                   <div className="p-3 bg-muted/10">
                                      <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        Bill of Materials (Allocating {combinedEffectiveQty} total)
                                      </div>
                                      <div className="rounded border border-border/60 overflow-hidden bg-background">
                                          <table className="w-full text-sm">
                                            <thead className="bg-muted/20">
                                              <tr>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Raw Material</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground border-l border-border/40">Qty Per Unit</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground border-l border-border/40">Required Qty</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground border-l border-border/40">Allocate to Qty</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Unit</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40">
                                              {productBOM.map((bItem, bIdx) => {
                                                const perUnit = parseFloat(bItem.rmqty?.replace(/,/g, '') || '0');
                                                const defaultTotalReq = isNaN(perUnit) ? 0 : perUnit * combinedEffectiveQty;
                                                const groupKey = `${prod.productName}_${bItem.rmname}`;
                                                
                                                // Initialize missing values locally (Default 0 if undefined on very first scan, but we default sync the `bomAllocations` when creating the input payload mostly)
                                                // Display the current override value, or perfectly proxy the calculated default.
                                                const currentVal = bomAllocations[groupKey] !== undefined ? bomAllocations[groupKey] : defaultTotalReq;

                                                return (
                                                  <tr key={bIdx} className="hover:bg-muted/5">
                                                    <td className="px-3 py-2 font-medium text-foreground">{bItem.rmname}</td>
                                                    <td className="px-3 py-2 border-l border-border/40 font-mono text-muted-foreground">
                                                       {isNaN(perUnit) ? '-' : formatNumber(perUnit)}
                                                    </td>
                                                    <td className="px-3 py-2 border-l border-border/40 font-mono text-muted-foreground">
                                                       {isNaN(perUnit) ? '-' : formatNumber(defaultTotalReq)}
                                                    </td>
                                                    <td className="px-3 py-2 border-l border-border/40 bg-blue-50/30">
                                                       <input 
                                                          type="number" 
                                                          value={currentVal || ''}
                                                          onChange={(e) => {
                                                             let numeric = parseFloat(e.target.value);
                                                             if(isNaN(numeric) || numeric < 0) numeric = 0;
                                                             setBomAllocations(prev => ({ ...prev, [groupKey]: numeric }));
                                                          }}
                                                          className="w-full px-2 py-1 text-sm border border-border/60 rounded bg-background font-mono shadow-inner outline-none focus:border-primary transition-colors"
                                                       />
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-muted-foreground">{bItem.rmunit}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                      </div>
                                   </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowIndentForm(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={selectedOrders.length === 0}>Create Indent</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PackingRawMaterialIndent;

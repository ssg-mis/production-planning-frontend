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
  totalReceivedQty?: number;
  totalReceivedKg?: number;
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
  skuBoms: Array<{ skuName: string; bom: Array<{ rmname: string; rmqty: string; rmunit: string; mainqty: string; mainuom: string }> }>;
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
  totalReceivedKg: number;
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
  totalReceivedKg: number;
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
          balanceKg: Number(item.balance_kg || 0),
          totalReceivedQty: Number(item.total_received_qty || 0),
          totalReceivedKg: Number(item.total_received_kg || 0),
          tankNo: item.tank_no || '-',
          givenFromTankNo: item.given_from_tank_no || '-',
          status: 'Pending',
          bom: Array.isArray(item.bom) ? item.bom : [],
          skuBoms: Array.isArray(item.sku_boms) ? item.sku_boms : [],
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
          balanceQty: Number(item.oil_qty || 0),
          balanceKg: Number(item.oil_qty || 0), // In history, we use oil_qty as the indented amount
          totalReceivedQty: Number(item.indentDetails?.total_received_qty || 0),
          totalReceivedKg: Number(item.indentDetails?.total_received_kg || 0),
          tankNo: item.indentDetails?.tank_no || '-',
          givenFromTankNo: item.indentDetails?.given_from_tank_no || '-',
          status: item.status,
          bom: item.bom_items.map((bi: any) => ({
            rmname: bi.item_name,
            rmqty: String(bi.qty_required),
            rmunit: '',
            mainqty: '1',
            mainuom: 'Box'
          })),
          skuBoms: [],
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
        groups[oilType] = { 
          type: oilType, 
          totalPlannedQty: 0, 
          totalActualDispatchQty: 0, 
          totalActualDispatchKg: 0, 
          totalBalanceQty: 0, 
          totalBalanceKg: 0, 
          totalReceivedKg: 0,
          products: [] 
        };
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
          totalReceivedKg: 0,
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
      groups[oilType].totalReceivedKg += (item.totalReceivedKg || 0);

      productGroup.totalPlannedQty += item.plannedQty;
      productGroup.totalActualDispatchQty += item.actualDispatchQty;
      productGroup.totalActualDispatchKg += item.actualDispatchKg;
      productGroup.totalBalanceQty += item.balanceQty;
      productGroup.totalBalanceKg += item.balanceKg;
      productGroup.totalReceivedKg += (item.totalReceivedKg || 0);
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
        // Total oil quantity (Kg) being indented in this transaction
      const totalOilQtyToIndent = ordersToSubmit.reduce((sum, o) => sum + o.balanceKg, 0);

      const payload = {
        productionId: order.id,
        oilQty: totalOilQtyToIndent, // Passing the total oil weight covered by this indent
        bomItems: order.bom.map(b => {
            const perUnit = parseFloat(b.rmqty?.replace(/,/g, '') || '0');
            const defaultTotalReq = isNaN(perUnit) ? 0 : perUnit * order.balanceQty;

            // Calculate final allocated by summing contributions from each SKU this order belongs to
            let finalAllocated = 0;
            let hasManualAllocation = false;

            const orderSkus = order.skuBoms || [];
            orderSkus.forEach(os => {
              const skuCount = orderSkus.length || 1;
              const splitKg = order.balanceKg / skuCount;
              
              // Find total weight of this SKU across all selected orders in the group
              const totalSkuKg = indents
                .filter(i => selectedOrders.includes(i.id))
                .reduce((sum, i) => {
                  const match = (i.skuBoms || []).find(s => s.skuName === os.skuName);
                  if (match) return sum + (i.balanceKg / (i.skuBoms?.length || 1));
                  return sum;
                }, 0);

              const groupKey = `SKU_${os.skuName}_${b.rmname}`;
              if (bomAllocations[groupKey] !== undefined) {
                hasManualAllocation = true;
                if (totalSkuKg > 0) {
                  // This order's contribution from this SKU's manual allocation (proportional)
                  finalAllocated += (splitKg / totalSkuKg) * bomAllocations[groupKey];
                }
              } else {
                // If no manual allocation for this SKU, add its default requirement
                finalAllocated += isNaN(perUnit) ? 0 : perUnit * splitKg;
              }
            });

            // If absolutely no manual allocations were found for ANY SKU of this order for this RM, 
            // fallback to the default total requirement (which should be the same as the sum of defaults)
            if (!hasManualAllocation) finalAllocated = defaultTotalReq;

            return {
              itemName: b.rmname,
              qtyRequired: defaultTotalReq,
              qtyAllocated: finalAllocated
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Received Qty (Kg)</th>
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
                        {activeTab === 'pending' ? formatNumber(group.totalReceivedKg) : formatNumber(group.totalBalanceKg)} Kg
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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border-b border-border bg-muted/10">
                          <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-lg">
                            <span className="text-xs text-blue-600/80 uppercase font-semibold">Total Received Qty (Kg):</span>
                            <p className="font-bold text-foreground text-sm">
                              {formatNumber(group.totalReceivedKg)} Kg
                            </p>
                          </div>
                          <div className="p-3 bg-orange-50/50 border border-orange-200/50 rounded-lg">
                            <span className="text-xs text-orange-600/80 uppercase font-semibold">Total Balance Qty (Kg):</span>
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

                    {/* Order Details — each order, each SKU individually */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-foreground">Order Details &amp; BOM</h3>
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
                        {(() => {
                          // Flatten all SKUs across the group's products
                          const skuMap: Record<string, { 
                            skuName: string; 
                            bom: any[]; 
                            orders: Array<{ order: RawMaterialIndentItem, splitKg: number }>;
                            totalSkuKg: number;
                          }> = {};

                          group.products.forEach(prod => {
                            const checkedOrders = prod.orders.filter(o => selectedOrders.includes(o.id));
                            checkedOrders.forEach(order => {
                              const skus = order.skuBoms || [];
                              const skuCount = skus.length || 1;
                              const splitKg = order.balanceKg / skuCount;

                              skus.forEach(sb => {
                                if (!skuMap[sb.skuName]) {
                                  skuMap[sb.skuName] = { 
                                    skuName: sb.skuName, 
                                    bom: sb.bom, 
                                    orders: [], 
                                    totalSkuKg: 0 
                                  };
                                }
                                skuMap[sb.skuName].orders.push({ order, splitKg });
                                skuMap[sb.skuName].totalSkuKg += splitKg;
                              });
                            });
                          });

                          return Object.values(skuMap).map((skuGroup, si) => {
                            const groupKeyPrefix = `SKU_${skuGroup.skuName}`;

                            return (
                              <div key={si} className="border border-border rounded-lg overflow-hidden bg-background shadow-sm">
                                {/* SKU Header */}
                                <div className="px-4 py-3 bg-primary/5 border-b border-border flex items-center justify-between">
                                  <div>
                                    <span className="text-sm font-bold text-primary">{skuGroup.skuName}</span>
                                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Individual SKU Section</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs text-muted-foreground">Total Received: </span>
                                    <span className="text-sm font-bold text-foreground">{formatNumber(skuGroup.totalSkuKg)} Kg</span>
                                  </div>
                                </div>

                                {/* Orders involved with this SKU (mini-table) */}
                                {formDetailsExpanded && (
                                  <div className="bg-muted/5 border-b border-border/40">
                                    <table className="w-full text-[11px]">
                                      <thead className="bg-muted/10 border-b border-border/20 text-muted-foreground">
                                        <tr>
                                          <th className="px-3 py-1 text-left font-medium">Order Ref</th>
                                          <th className="px-3 py-1 text-right font-medium">Split Kg</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/20">
                                        {skuGroup.orders.map((oItem, oi) => (
                                          <tr key={oi}>
                                            <td className="px-3 py-1 font-mono">{oItem.order.orderRef}</td>
                                            <td className="px-3 py-1 text-right font-semibold">{formatNumber(oItem.splitKg)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* BOM Table or No BOM Message */}
                                <div className="p-0">
                                  {!skuGroup.bom || skuGroup.bom.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-orange-600 bg-orange-50/30 font-medium">
                                      ⚠️ No Bill of Materials (BOM) items found for this SKU.
                                    </div>
                                  ) : (
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted/20">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Raw Material</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground border-l border-border/40">Qty Per Unit</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground border-l border-border/40">Required Qty</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground border-l border-border/40">Allocate Qty</th>
                                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-20">Unit</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/40">
                                        {skuGroup.bom.map((bItem: any, bIdx: number) => {
                                          const perUnit = parseFloat(bItem.rmqty?.replace(/,/g, '') || '0');
                                          const defaultTotalReq = isNaN(perUnit) ? 0 : perUnit * skuGroup.totalSkuKg;
                                          const groupKey = `${groupKeyPrefix}_${bItem.rmname}`;
                                          const currentVal = bomAllocations[groupKey] !== undefined ? bomAllocations[groupKey] : defaultTotalReq;
                                          return (
                                            <tr key={bIdx} className="hover:bg-muted/5 transition-colors">
                                              <td className="px-3 py-2 font-medium text-foreground">{bItem.rmname}</td>
                                              <td className="px-3 py-2 border-l border-border/40 font-mono text-muted-foreground text-xs">
                                                {isNaN(perUnit) ? '-' : formatNumber(perUnit)}
                                              </td>
                                              <td className="px-3 py-2 border-l border-border/40 font-mono text-muted-foreground text-xs">
                                                {isNaN(perUnit) ? '-' : formatNumber(defaultTotalReq)}
                                              </td>
                                              <td className="px-3 py-2 border-l border-border/40 bg-blue-50/20">
                                                <input
                                                  type="number"
                                                  value={currentVal || ''}
                                                  onChange={(e) => {
                                                    let numeric = parseFloat(e.target.value);
                                                    if (isNaN(numeric) || numeric < 0) numeric = 0;
                                                    setBomAllocations(prev => ({ ...prev, [groupKey]: numeric }));
                                                  }}
                                                  className="w-full px-2 py-1 text-sm border border-border/40 rounded bg-background font-mono shadow-inner outline-none focus:border-primary transition-all"
                                                />
                                              </td>
                                              <td className="px-3 py-2 text-xs text-muted-foreground">{bItem.rmunit}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
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

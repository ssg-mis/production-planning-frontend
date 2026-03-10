'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';
import { ChevronDown, ChevronRight, Plus, Loader2 } from 'lucide-react';

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
  if (n.includes('rice bran oil') || n.includes('rbo') || n.includes('rice bran')) return 'Rice Bran Oil';
  if (n.includes('soybean') || n.includes('soya') || n.includes('sbo')) return 'Soybean Oil';
  if (n.includes('palm') || n.includes('palmolein')) return 'Palm Oil';
  if (n.includes('mustard') || n.includes('kachi ghani')) return 'Mustard Oil';
  if (n.includes('sunflower')) return 'Sunflower Oil';
  if (n.includes('groundnut')) return 'Groundnut Oil';
  return 'Other Oils';
};

const categorizeItemToBePacked = (productName: string): string => {
  if (!productName) return '-';
  const n = categorizeOilType(productName);
  if (n === 'Soybean Oil') return 'SBO';
  if (n === 'Rice Bran Oil') return 'RBO';
  if (n === 'Palm Oil') return 'PALM';
  if (n === 'Mustard Oil') return 'MUSTARD';
  if (n === 'Sunflower Oil') return 'SUNFLOWER';
  if (n === 'Groundnut Oil') return 'GROUNDNUT';
  return '-';
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'received':  return 'bg-green-100 text-green-800';
    case 'pending':   return 'bg-yellow-100 text-yellow-800';
    case 'planned':   return 'bg-blue-100 text-blue-800';
    default:          return 'bg-gray-100 text-gray-800';
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface OilReceiptItem {
  id: number;
  production_id: string;
  status: string;
  received_qty?: number;
  received_by?: string;
  received_date?: string;
  remarks?: string;
  indentDetails: {
    product_name: string;
    packing_size: string;
    packing_type: string;
    party_name: string;
    indent_quantity: number;
    total_weight_kg: number;
    tank_no: string;
    actual_qty_kg?: number;
    approved_qty?: number;
    given_from_tank_no?: string;
    created_at: string;
  };
  lab_additives?: any[];
  dispatch_additives?: any[];
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
  tankNo?: string;
  actualQtyKg: number;
  approvedQtyKg: number;
  items: OilReceiptItem[];
}

interface OilTypeGroup {
  type: string;
  totalQuantity: number;
  totalWeightKg: number;
  actualQtyKg: number;
  approvedQtyKg: number;
  products: ProductGroup[];
}

const OilReceipt = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OilReceiptItem[]>([]);

  // Form state
  const [selectedOilType, setSelectedOilType] = useState<string>('');
  const [selectedProductionIds, setSelectedProductionIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    receivedBy: '',
    receivedDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });
  const [dispatchChemExpanded, setDispatchChemExpanded] = useState(false);
  const [labChemExpanded, setLabChemExpanded] = useState(false);
  const [chemResultsExpanded, setChemResultsExpanded] = useState(false);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'pending' ? '/oil-receipt/pending' : '/oil-receipt/history';
      const response = await fetch(`${API_BASE_URL}${endpoint}`);
      const data = await response.json();
      if (data.status === 'success') {
        const mapped = data.data.map((item: any) => {
          if (activeTab === 'pending') {
            return {
              id: item.id,
              production_id: item.production_id,
              status: 'Pending',
              indentDetails: {
                product_name: item.product_name,
                packing_size: item.packing_size,
                packing_type: item.packing_type,
                party_name: item.party_name,
                indent_quantity: parseFloat(item.indent_quantity),
                total_weight_kg: parseFloat(item.total_weight_kg || 0),
                tank_no: item.tank_no,
                actual_qty_kg: item.actual_qty_kg ? parseFloat(item.actual_qty_kg) : undefined,
                approved_qty: item.approved_qty ? parseFloat(item.approved_qty) : undefined,
                given_from_tank_no: item.given_from_tank_no,
                created_at: item.created_at,
              },
                lab_additives: item.lab_additives || [],
                dispatch_additives: item.dispatch_additives || [],
              };
            }
            return {
              ...item,
              lab_additives: item.indentDetails?.lab_additives || [],
              dispatch_additives: item.indentDetails?.dispatch_additives || [],
              indentDetails: {
                ...item.indentDetails,
                indent_quantity: parseFloat(item.indentDetails?.indent_quantity || 0),
                total_weight_kg: parseFloat(item.indentDetails?.total_weight_kg || 0),
                actual_qty_kg: item.indentDetails?.actual_qty_kg ? parseFloat(item.indentDetails.actual_qty_kg) : undefined,
                approved_qty: item.indentDetails?.approved_qty ? parseFloat(item.indentDetails.approved_qty) : undefined,
                given_from_tank_no: item.indentDetails?.given_from_tank_no,
              }
            };
          });
        setItems(mapped);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [activeTab]);

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groupByOilType = (list: OilReceiptItem[]): OilTypeGroup[] => {
    const oilGroups: Record<string, OilTypeGroup> = {};

    list.forEach(item => {
      const oilType = categorizeOilType(item.indentDetails.product_name);
      const productKey = normalizeProductKey(item.indentDetails.product_name, item.indentDetails.packing_size);

      if (!oilGroups[oilType]) {
        oilGroups[oilType] = { type: oilType, totalQuantity: 0, totalWeightKg: 0, actualQtyKg: 0, approvedQtyKg: 0, products: [] };
      }

      let productGroup = oilGroups[oilType].products.find(p => p.productKey === productKey);
      if (!productGroup) {
        productGroup = {
          productKey,
          productName: item.indentDetails.product_name,
          packingSize: item.indentDetails.packing_size,
          packingType: item.indentDetails.packing_type || '-',
          totalQuantity: 0,
          totalWeightKg: 0,
          availableStock: 0, // Simplified
          shortage: 0,
          status: item.status,
          tankNo: item.indentDetails.tank_no,
          actualQtyKg: 0,
          approvedQtyKg: 0,
          items: [],
        };
        oilGroups[oilType].products.push(productGroup);
      }

      const qty = activeTab === 'pending' ? item.indentDetails.indent_quantity : (item.received_qty || 0);
      const weight = item.indentDetails.total_weight_kg || 0;
      const actualQty = item.indentDetails.actual_qty_kg || 0;
      const appQty = item.indentDetails.approved_qty || 0;
      productGroup.totalQuantity += qty;
      productGroup.totalWeightKg += weight;
      productGroup.actualQtyKg += actualQty;
      productGroup.approvedQtyKg += appQty;
      productGroup.items.push(item);
      oilGroups[oilType].totalQuantity += qty;
      oilGroups[oilType].totalWeightKg += weight;
      oilGroups[oilType].actualQtyKg += actualQty;
      oilGroups[oilType].approvedQtyKg += appQty;

      if (!productGroup.tankNo && item.indentDetails.tank_no) {
        productGroup.tankNo = item.indentDetails.tank_no;
      }
    });

    Object.values(oilGroups).forEach(og =>
      og.products.forEach(pg => {
        pg.shortage = Math.max(0, pg.totalQuantity - pg.availableStock);
      })
    );

    return Object.values(oilGroups);
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const handleOilTypeSelect = (oilType: string) => {
    setSelectedOilType(oilType);
    const groups = groupByOilType(items);
    const group = groups.find(g => g.type === oilType);
    if (group) {
      const allIds = group.products.flatMap(p => p.items.map(i => i.production_id));
      setSelectedProductionIds(allIds);
    } else {
      setSelectedProductionIds([]);
    }
  };

  const handleItemToggle = (productionId: string) => {
    setSelectedProductionIds(prev => 
      prev.includes(productionId) 
        ? prev.filter(id => id !== productionId) 
        : [...prev, productionId]
    );
  };

  const handleReceiptSubmit = async () => {
    if (!selectedOilType || selectedProductionIds.length === 0) {
      alert('Please select an oil type and at least one item');
      return;
    }

    if (!formData.receivedBy) {
      alert('Please fill in received by field');
      return;
    }

    setLoading(true);
    try {
      for (const prodId of selectedProductionIds) {
        const item = items.find(i => i.production_id === prodId);
        if (!item) continue;

        await fetch(`${API_BASE_URL}/oil-receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productionId: prodId,
            // Use the actual dispatched qty from previous stage; fallback to approved_qty then indent_quantity
            receivedQty: item.indentDetails.actual_qty_kg || item.indentDetails.approved_qty || item.indentDetails.indent_quantity,
            receivedBy: formData.receivedBy,
            receivedDate: formData.receivedDate,
            remarks: formData.remarks,
          }),
        });
      }
      
      alert('Receipt confirmed successfully');
      setShowForm(false);
      setSelectedOilType('');
      setSelectedProductionIds([]);
      setDispatchChemExpanded(false);
      setFormData({
        receivedBy: '',
        receivedDate: new Date().toISOString().split('T')[0],
        remarks: '',
      });
      fetchReceipts();
    } catch (error) {
      console.error('Error submitting receipt:', error);
      alert('Failed to submit receipt');
    } finally {
      setLoading(false);
    }
  };

  const oilTypeGroups = groupByOilType(items);
  const uniqueOilTypes = oilTypeGroups.map(g => g.type);

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Oil Received (Packing Section)"
        description="Packaging head receives oil from plant person and confirms received quantity"
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
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'pending' && items.length > 0 && (
          <Button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Oil Receipt
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8" />
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name / Oil Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Item to be packed</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Indent Qty (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Approval Qty (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Dispatch (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Give Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Packing Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={12} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {oilTypeGroups.map((group, gi) => {
                  return (
                    <Fragment key={gi}>
                      <tr className="bg-card/50 hover:bg-card transition-colors">
                        <td className="px-4 py-3 text-sm" />
                        <td className="px-4 py-3 text-base font-bold text-primary">
                          {group.type}
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({group.products.length} Products)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          <Badge variant="outline" className="font-mono">{categorizeItemToBePacked(group.type)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-base font-bold text-foreground font-mono">
                          {formatNumber(group.totalWeightKg)}
                        </td>
                        <td className="px-4 py-3 text-base font-bold text-foreground font-mono">
                          {formatNumber(group.approvedQtyKg)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">-</td>
                        <td className="px-4 py-3 text-base font-bold text-foreground font-mono">
                          {formatNumber(group.actualQtyKg)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.indentDetails?.tank_no)).filter(v => v && v !== '-'))).join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground font-mono">
                          {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.indentDetails?.given_from_tank_no)).filter(v => v && v !== '-'))).join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.indentDetails?.packing_type)).filter(v => v && v !== '-'))).join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="outline">
                            {activeTab === 'pending' ? 'Pending' : 'Received'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {activeTab === 'pending' && (
                            <Button 
                              onClick={() => {
                                setSelectedOilType(group.type);
                                const allIds = group.products.flatMap(p => p.items.map(i => i.production_id));
                                setSelectedProductionIds(allIds);
                                setShowForm(true);
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
              </tbody>
            )}
          </table>
        </div>
        {!loading && oilTypeGroups.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} receipts
          </div>
        )}
      </Card>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowForm(false);
            setSelectedOilType('');
            setSelectedProductionIds([]);
            setDispatchChemExpanded(false);
          }}
        >
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Oil Receipt</h2>
              
              {selectedOilType && (() => {
                const group = oilTypeGroups.find(g => g.type === selectedOilType);
                if (!group) return null;

                return (
                  <>
                    {/* Context Header */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border mb-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold text-primary">{selectedOilType}</h3>
                          <p className="text-xs text-muted-foreground">Receive oil from plant person and confirm receipt.</p>
                        </div>
                      </div>
                    </div>

                    {/* Item to be packed section - Always Visible */}
                      <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
                        <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Item(s) to be packed</p>
                        <div className="text-lg font-bold text-primary">
                          {Array.from(new Set(group.products.flatMap(p => {
                            if (!p.productName) return [];
                            const parts = p.productName.split(' ');
                            return parts.length >= 2 ? [parts[0], parts[1]] : [parts[0]];
                          }))).join(', ')}
                        </div>
                      </div>

                      {/* Tank Summary Cards - RESTORED */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex flex-col justify-center">
                          <span className="text-xs text-blue-600 uppercase font-semibold">Receive Tank No:</span>
                          <p className="font-bold text-foreground">
                            {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.indentDetails?.tank_no)).filter(v => v && v !== '-'))).join(', ') || 'N/A'}
                          </p>
                        </div>
                        <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex flex-col justify-center">
                          <span className="text-xs text-green-600 uppercase font-semibold">Give Tank No:</span>
                          <p className="font-bold text-foreground">
                            {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.indentDetails?.given_from_tank_no)).filter(v => v && v !== '-'))).join(', ') || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Chemical Results (Combined) - Hidden by default */}
                      <div className="mb-6 border border-border rounded-lg overflow-hidden">
                        <button
                          type="button"
                          className="w-full px-4 py-3 bg-muted/30 flex items-center justify-between text-sm font-bold text-foreground hover:bg-muted/50 transition-colors"
                          onClick={() => setChemResultsExpanded(v => !v)}
                        >
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" />
                            Chemical Results (Lab & Dispatch)
                          </span>
                          {chemResultsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        
                        {chemResultsExpanded && (
                          <div className="p-4 space-y-6 bg-background">
                            {/* Lab Confirmation Results - DEDUPLICATED */}
                            {(() => {
                              const labChemItems = group.products.flatMap(p => 
                                p.items.flatMap((i: any) => (i.lab_additives && Array.isArray(i.lab_additives) ? i.lab_additives : []))
                              );
                              if (labChemItems.length === 0) return null;
                              
                              // Deduplicate by item name
                              const uniqueLabChems = Array.from(new Map(labChemItems.map(c => [c.item, c])).values());

                              return (
                                <div>
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Lab Confirmation Results</h4>
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/20 border-b border-border">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium">ITEM</th>
                                        <th className="px-3 py-2 text-left font-medium">STANDARD</th>
                                        <th className="px-3 py-2 text-left font-medium">RESULT</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {uniqueLabChems.map((chem: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-muted/10">
                                          <td className="px-3 py-2 font-semibold">{chem.item}</td>
                                          <td className="px-3 py-2 text-muted-foreground">{chem.standard}</td>
                                          <td className="px-3 py-2 font-medium text-primary">{chem.actual || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}

                            {/* Chemical Additives Planning - DEDUPLICATED */}
                            {(() => {
                              const dispatchChemItems = group.products.flatMap(p =>
                                p.items.flatMap((i: any) => (i.dispatch_additives && Array.isArray(i.dispatch_additives) ? i.dispatch_additives : []))
                              );
                              if (dispatchChemItems.length === 0) return null;
                              
                              // Deduplicate by item name
                              const uniqueDispatchChems = Array.from(new Map(dispatchChemItems.map(c => [c.item, c])).values());

                              return (
                                <div>
                                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Chemical Additives (from Actual Dispatch)</h4>
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted/20 border-b border-border">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium">ITEM</th>
                                        <th className="px-3 py-2 text-left font-medium">STANDARD WEIGHT</th>
                                        <th className="px-3 py-2 text-left font-medium">ACTUAL WEIGHT</th>
                                        <th className="px-3 py-2 text-left font-medium text-primary">FILL WEIGHT</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {uniqueDispatchChems.map((chem: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-muted/10">
                                          <td className="px-3 py-2 font-semibold">{chem.item}</td>
                                          <td className="px-3 py-2 text-muted-foreground">{chem.weight || chem.standard || '-'}</td>
                                          <td className="px-3 py-2">{chem.actualWeight || '-'}</td>
                                          <td className="px-3 py-2 font-medium text-primary">{chem.fillWeight || chem.actualWeight || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Summary card logic - CLEANED UP */}
                      {(() => {
                        const totalDispatchQty = group.products
                          .flatMap(p => p.items)
                          .filter(i => selectedProductionIds.includes(i.production_id))
                          .reduce((sum, i) => sum + (i.indentDetails.actual_qty_kg || i.indentDetails.approved_qty || i.indentDetails.indent_quantity || 0), 0);
                        return (
                          <div className="mb-6">
                            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Total Dispatch Qty (Kg)</span>
                              <p className="text-xl font-bold text-primary mt-1">{formatNumber(totalDispatchQty)}</p>
                              <p className="text-xs text-muted-foreground mt-1">(from Actual Dispatch stage)</p>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Received By <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.receivedBy}
                            onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                            placeholder="Name of Receiver"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Received Date</label>
                          <input
                            type="date"
                            value={formData.receivedDate}
                            onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                          />
                        </div>
                      </div>

                      <div className="mb-6">
                        <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                        <textarea
                          value={formData.remarks}
                          onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                          placeholder="Add any remarks or notes"
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
                      setShowForm(false);
                      setSelectedOilType('');
                      setSelectedProductionIds([]);
                      setChemResultsExpanded(false);
                      setFormData({
                        receivedBy: '',
                        receivedDate: new Date().toISOString().split('T')[0],
                        remarks: '',
                      });
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleReceiptSubmit}
                    className="bg-primary hover:bg-primary/90"
                    disabled={!selectedOilType || selectedProductionIds.length === 0 || !formData.receivedBy || loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

export default OilReceipt;

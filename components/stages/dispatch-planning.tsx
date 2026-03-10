'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import {

  getProductStock,
  initializeDefaultStocks,
} from '@/lib/workflow-storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const PALM_ADDITIVES = [
  { item: 'TBHQ', weight: '150 GM PER MT', vendor: 'HEERA & SONS', costExGst: '700/KG', costPerMt: 105, stdWtGm: 150, ratePerKg: 700 },
  { item: 'ANTIFOAMING', weight: '5 GM PER MT', vendor: 'ANGEL CHEMICAL', costExGst: '5300/KG', costPerMt: 26.5, stdWtGm: 5, ratePerKg: 5300 },
];

const RICE_ADDITIVES = [
  { item: 'TBHQ', weight: '150GM PER MT', vendor: 'HEERA & SONS', costExGst: '700/KG', costPerMt: 126, stdWtGm: 150, ratePerKg: 840 },
  { item: 'ANTIFOAMING', weight: '5 GM PER MT', vendor: 'ANGEL CHEMICAL', costExGst: '5300/KG', costPerMt: 26.5, stdWtGm: 5, ratePerKg: 5300 },
];

const SOYA_ADDITIVES = [
  { item: 'TBHQ', weight: '150 GM PER MT', vendor: 'HEERA & SONS', costExGst: '700/KG', costPerMt: 105, stdWtGm: 150, ratePerKg: 700 },
  { item: 'ANTIFOAMING', weight: '5 GM PER MT', vendor: 'ANGEL CHEMICAL', costExGst: '5300/KG', costPerMt: 26.5, stdWtGm: 5, ratePerKg: 5300 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    case 'planned':   return 'bg-blue-100 text-blue-800';
    case 'dispatched':return 'bg-green-100 text-green-800';
    case 'pending':   return 'bg-yellow-100 text-yellow-800';
    default:          return 'bg-gray-100 text-gray-800';
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DispatchItem {
  id: string;
  productName: string;
  packingSize?: string;
  packingType: string;
  partyName?: string;
  indentQuantity: number;
  totalWeightKg: number;
  tankNo?: string;
  status: string;
  remarks?: string;
  plannedDate?: string;
  createdAt?: string;
  additives?: any[];
  givenFromTankNo?: string;
  approvedQty?: number;
  approvalDate?: string;
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
  items: DispatchItem[];
}

interface OilTypeGroup {
  type: string;
  totalQuantity: number;
  totalWeightKg: number;
  products: ProductGroup[];
}

// ─── Component ───────────────────────────────────────────────────────────────

const DispatchPlanning = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Expand/collapse state
  const [expandedOilTypes, setExpandedOilTypes] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Form state
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [formDetailsExpanded, setFormDetailsExpanded] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actualQtyKg, setActualQtyKg] = useState('');
  const [additivesData, setAdditivesData] = useState<any[]>([]);
  const [labChemExpanded, setLabChemExpanded] = useState(false);

  useEffect(() => {
    initializeDefaultStocks();
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint =
        activeTab === 'pending'
          ? `${API_BASE_URL}/dispatch-planning-plant/pending`
          : `${API_BASE_URL}/dispatch-planning-plant/history`;

      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.status === 'success') {
        const mapped: DispatchItem[] = result.data.map((item: any) => {
          if (activeTab === 'history' && item.indentDetails) {
            return {
              id: item.production_id,
              indentQuantity: parseFloat(item.indentDetails.indent_quantity),
              totalWeightKg: parseFloat(item.indentDetails.total_weight_kg || 0),
              productName: item.indentDetails.product_name,
              packingSize: item.indentDetails.packing_size,
              packingType: item.indentDetails.packing_type,
              partyName: item.indentDetails.party_name,
              tankNo: item.indentDetails.tank_no,
              status: item.status,
              remarks: item.remarks,
              plannedDate: item.planned_date,
              createdAt: item.created_at,
              additives: item.additives,
              givenFromTankNo: item.indentDetails.given_from_tank_no,
              approvedQty: parseFloat(item.indentDetails.approved_qty || 0),
              approvalDate: item.indentDetails.approval_date,
            };
          }
          return {
            id: item.production_id,
            indentQuantity: parseFloat(item.indent_quantity),
            totalWeightKg: parseFloat(item.total_weight_kg || 0),
            productName: item.product_name,
            packingSize: item.packing_size,
            packingType: item.packing_type,
            partyName: item.party_name,
            tankNo: item.tank_no,
            status: 'Pending',
            createdAt: item.created_at,
            givenFromTankNo: item.given_from_tank_no,
            approvedQty: parseFloat(item.approved_qty || 0),
            approvalDate: item.approval_date,
            additives: item.lab_additives || [],
          };
        });
        setItems(mapped);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groupByOilType = (list: DispatchItem[]): OilTypeGroup[] => {
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
          tankNo: item.tankNo,
          items: [],
        };
        oilGroups[oilType].products.push(productGroup);
      }

      productGroup.totalQuantity += item.indentQuantity;
      productGroup.totalWeightKg += item.totalWeightKg;
      productGroup.items.push(item);
      oilGroups[oilType].totalQuantity += item.indentQuantity;
      oilGroups[oilType].totalWeightKg += item.totalWeightKg;

      // Ensure tankNo is captured if not already set
      if (!productGroup.tankNo && item.tankNo) {
        productGroup.tankNo = item.tankNo;
      }
    });

    Object.values(oilGroups).forEach(og =>
      og.products.forEach(pg => {
        pg.shortage = Math.max(0, pg.totalQuantity - pg.availableStock);
      })
    );

    return Object.values(oilGroups);
  };

  const toggleOilType = (type: string) =>
    setExpandedOilTypes(prev => ({ ...prev, [type]: !prev[type] }));

  const toggleProduct = (key: string) =>
    setExpandedProducts(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Form helpers ──────────────────────────────────────────────────────────

  const handleOilTypeSelect = (oilType: string) => {
    setSelectedProduct(oilType);
    const group = groupByOilType(items).find(g => g.type === oilType);
    if (group) {
      const allItems = group.products.flatMap(p => p.items);
      setSelectedItems(allItems.map(i => i.id));
    }
  };

  const handleItemToggle = (itemId: string) => {
    const newSelected = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];
    setSelectedItems(newSelected);
  };

  // Auto-calculate Actual Qty (MT) and Chemicals when selection changes
  useEffect(() => {
    if (!showForm || !selectedProduct) return;

    const group = oilTypeGroups.find(g => g.type === selectedProduct);
    if (!group) return;

    const totalKg = group.products.reduce((acc, p) => 
      acc + p.items.filter(i => selectedItems.includes(i.id)).reduce((sum, item) => sum + (item.approvedQty || item.totalWeightKg), 0), 0
    );
    setActualQtyKg(totalKg.toFixed(0));

    // Seed additives base
    let baseAdditives: any[] = [];
    if (selectedProduct === 'Soybean Oil') {
      baseAdditives = [...SOYA_ADDITIVES];
    } else if (selectedProduct === 'Rice Bran Oil') {
      baseAdditives = [...RICE_ADDITIVES];
    } else if (selectedProduct === 'Palm Oil') {
      baseAdditives = [...PALM_ADDITIVES];
    }
    
    // Auto-calculate actual weight matching to totalKg
    const mt = totalKg / 1000;
    const initialAdditives = baseAdditives.map(p => ({ 
      ...p, 
      actualWeight: (mt * p.stdWtGm).toFixed(1),
      fillWeight: (mt * p.stdWtGm).toFixed(1),
    }));
    
    setAdditivesData(initialAdditives);
    setLabChemExpanded(false);
  }, [selectedItems, selectedProduct, showForm]);

  // Handle actual quantity change for auto-calculation
  useEffect(() => {
    if (!showForm || !selectedProduct) return;
    
    const mt = (Number(actualQtyKg) || 0) / 1000;
    
    setAdditivesData(prev => prev.map(p => ({
      ...p,
      actualWeight: (mt * p.stdWtGm).toFixed(1),
      fillWeight: p.fillWeight !== undefined ? p.fillWeight : (mt * p.stdWtGm).toFixed(1),
    })));
  }, [actualQtyKg]);

  const resetForm = () => {
    setShowForm(false);
    setSelectedProduct('');
    setSelectedItems([]);
    setRemarks('');
    setActualQtyKg('');
    setAdditivesData([]);
    setLabChemExpanded(false);
  };

  const handleSubmit = async () => {
    if (!selectedProduct || selectedItems.length === 0) {
      alert('Please select an oil type and at least one item');
      return;
    }

    try {
      for (const productionId of selectedItems) {
        const item = items.find(i => i.id === productionId);
        if (!item) continue;

        const body = {
          productionId,
          remarks,
          additives: additivesData,
          actualQtyKg: actualQtyKg || null,
        };

        const res = await fetch(`${API_BASE_URL}/dispatch-planning-plant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to submit dispatch plan');
      }

      alert('Dispatch plan submitted successfully');
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit dispatch plan');
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const oilTypeGroups = groupByOilType(items);
  const uniqueOilTypes = oilTypeGroups.map(g => g.type);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Actual Dispatch"
        description="Plan additives and distribute oil to packing section by tank size (5 MT each lot)"
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Approval Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Given Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Receive Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Packing Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={10} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {oilTypeGroups.map((group, gi) => {
                return (
                  <Fragment key={gi}>
                    <tr
                      className="bg-card/50 hover:bg-card transition-colors"
                    >
                      <td className="px-4 py-3 text-sm" />
                      <td className="px-4 py-3 text-base font-bold text-primary">
                        {group.type}
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({group.products.length} Products)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-base font-bold text-foreground">
                        {formatNumber(group.totalWeightKg)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {Array.from(new Set(group.products.map(p => p.availableStock).filter(Boolean))).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-base font-bold text-foreground">
                        {formatNumber(group.products.reduce((acc, p) => acc + p.items.reduce((sum, item) => sum + (item.approvedQty || 0), 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.givenFromTankNo)).filter(v => v && v !== '-'))).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.tankNo)).filter(v => v && v !== '-'))).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {Array.from(new Set(group.products.map(p => p.packingType && p.packingType !== '-' ? p.packingType : p.items.find(i => i.packingType)?.packingType).filter(v => v && v !== '-'))).join(', ') || '-'}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {activeTab === 'pending' && (
                          <Button 
                            size="sm" 
                            className="h-8 py-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOilTypeSelect(group.type);
                              setShowForm(true);
                            }}
                          >
                            Process
                          </Button>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}

              {oilTypeGroups.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No {activeTab === 'pending' ? 'pending' : 'history'} dispatch plans
                  </td>
                </tr>
              )}
            </tbody>
            )}
          </table>
        </div>
      </Card>

      {/* Dispatch Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Actual Dispatch</h2>

              {/* Context Header */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-primary">{selectedProduct}</h3>
                    <p className="text-xs text-muted-foreground">Plan additives and distribute oil to packing section.</p>
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
              </div>

              {selectedProduct && (() => {
                const group = oilTypeGroups.find(g => g.type === selectedProduct);
                if (!group) return null;

                return (
                  <>
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

                    {/* Order Details — grouped by product, collapsible */}
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-bold text-foreground">Order Details</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormDetailsExpanded(!formDetailsExpanded)}
                          className="h-8 py-0 underline text-primary"
                        >
                          {formDetailsExpanded ? 'Hide Details' : 'Show Details'}
                        </Button>
                      </div>
                      
                      {formDetailsExpanded && (
                        <div className="space-y-3">
                          {group.products.map((prod, pi) => (
                            <div key={pi} className="border border-border rounded-lg overflow-hidden">
                              {/* Product sub-header */}
                              <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">
                                  {prod.productName}{prod.packingSize ? ' ' + prod.packingSize : ''}
                                </span>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>Stock: {prod.availableStock}</span>
                                  {prod.shortage > 0 && (
                                    <span className="text-red-600 font-semibold">Shortage: {formatNumber(prod.shortage)}</span>
                                  )}
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead className="bg-muted/20 border-b border-border">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Timestamp</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Select</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Production ID</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Indent Qty (Kg)</th>
                                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Receive Tank No.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-background">
                                  {prod.items.map((item: DispatchItem, idx: number) => (
                                    <tr key={idx} className="hover:bg-muted/30">
                                      <td className="px-3 py-2 text-xs text-muted-foreground">
                                        {(() => {
                                          const d = item.createdAt || item.plannedDate;
                                          return d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                                        })()}
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="checkbox"
                                          checked={selectedItems.includes(item.id)}
                                          onChange={() => handleItemToggle(item.id)}
                                          className="w-4 h-4 rounded border-primary text-primary"
                                        />
                                      </td>
                                      <td className="px-3 py-2 font-mono text-xs">{item.id}</td>
                                      <td className="px-3 py-2 font-semibold text-primary">{formatNumber(item.totalWeightKg)}</td>
                                      <td className="px-3 py-2">{item.tankNo || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tank Details Summary */}
                    <div className="mb-6 grid grid-cols-2 gap-4">
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <span className="text-xs text-blue-600 uppercase font-semibold">Receive Tank No:</span>
                        <p className="font-bold text-foreground">
                          {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.tankNo)).filter(Boolean))).join(', ') || 'N/A'}
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                        <span className="text-xs text-green-600 uppercase font-semibold">Give Tank No:</span>
                        <p className="font-bold text-foreground">
                          {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.givenFromTankNo)).filter(Boolean))).join(', ') || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Quantity Tracking — 3 cards */}
                    {(() => {
                      const plannedQty = group.products.reduce((acc, p) =>
                        acc + p.items.filter(i => selectedItems.includes(i.id)).reduce((sum, item) => sum + (item.approvedQty || item.totalWeightKg), 0), 0);
                      const enteredQty = parseFloat(actualQtyKg) || 0;
                      const remainingQty = Math.max(0, plannedQty - enteredQty);
                      return (
                        <div className="mb-6 grid grid-cols-3 gap-4">
                          {/* Planned Qty */}
                          <div className="p-4 bg-muted/20 border border-border rounded-lg">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Qty to be Dispatched (Kg)</label>
                            <p className="text-xl font-bold text-primary">{formatNumber(plannedQty)}</p>
                          </div>
                          {/* Remaining */}
                          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 rounded-lg">
                            <label className="block text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase mb-1">Remaining Dispatch Qty (Kg)</label>
                            <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{formatNumber(remainingQty)}</p>
                          </div>
                          {/* Actual Qty — text input */}
                          <div className="p-4 bg-muted/20 border border-border rounded-lg">
                            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">Actual Qty to be Dispatched (Kg)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={actualQtyKg}
                              onChange={(e) => {
                                const val = e.target.value;
                                // Allow free typing
                                setActualQtyKg(val);
                              }}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val > plannedQty) {
                                  alert(`Actual qty cannot exceed planned qty (${formatNumber(plannedQty)} Kg)`);
                                  setActualQtyKg(plannedQty.toFixed(0));
                                }
                              }}
                              placeholder="Enter actual Kg"
                              className="w-full bg-background border-border border rounded px-3 py-1 font-bold text-lg mt-1"
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Lab Confirmation Chemical Results (from previous stage) */}
                    {(() => {
                      const labChemItems = group.products.flatMap(p =>
                        p.items.flatMap(i => (i.additives && Array.isArray(i.additives) ? i.additives : []))
                      );
                      if (labChemItems.length === 0) return null;
                      return (
                        <div className="mb-6 border border-border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            className="w-full px-4 py-3 bg-muted/30 flex items-center justify-between text-sm font-bold text-foreground hover:bg-muted/50 transition-colors"
                            onClick={() => setLabChemExpanded(v => !v)}
                          >
                            <span className="flex items-center gap-2">
                              <Plus className="h-4 w-4 text-primary" />
                              Lab Confirmation Chemical Results
                            </span>
                            {labChemExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          {labChemExpanded && (
                            <table className="w-full text-sm">
                              <thead className="bg-muted/20 border-b border-border">
                                <tr>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">ITEM</th>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">STANDARD</th>
                                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">RESULT</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-background">
                                {labChemItems.map((chem: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-muted/20">
                                    <td className="px-4 py-2 font-semibold text-foreground text-xs">{chem.item}</td>
                                    <td className="px-4 py-2 text-muted-foreground text-xs">{chem.standard}</td>
                                    <td className="px-4 py-2 text-xs font-medium text-primary">{chem.actual || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })()}

                    {/* Chemical Additives Section */}
                    {(selectedProduct === 'Rice Bran Oil' || selectedProduct === 'Soybean Oil' || selectedProduct === 'Palm Oil') && (
                      <div className="mb-6">
                        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          Chemical Additives Planning
                        </h3>
                        <div className="border border-border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-4 py-2 text-left">ITEM</th>
                                <th className="px-4 py-2 text-left">STANDARD WEIGHT</th>
                                <th className="px-4 py-2 text-left">ACTUAL WEIGHT</th>
                                <th className="px-4 py-2 text-left">FILL WEIGHT</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-background">
                              {additivesData.map((add, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-3 font-semibold text-foreground text-xs">{add.item}</td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs">{add.weight}</td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="number"
                                      value={add.actualWeight || ''}
                                      disabled
                                      placeholder="gm"
                                      className="w-full bg-muted/40 border-border border rounded px-2 py-1 text-xs text-muted-foreground cursor-not-allowed"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="number"
                                      value={add.fillWeight !== undefined ? add.fillWeight : add.actualWeight || ''}
                                      onChange={(e) => {
                                        const newData = [...additivesData];
                                        newData[idx].fillWeight = e.target.value;
                                        setAdditivesData(newData);
                                      }}
                                      placeholder="gm"
                                      className="w-full bg-muted/20 border-border border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-primary outline-none"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}


                    {/* Remarks */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                      <textarea
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Add any remarks or notes"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground h-20"
                      />
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || selectedItems.length === 0}
                >
                  Submit Dispatch Plan
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DispatchPlanning;

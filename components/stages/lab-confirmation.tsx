'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import {

  getProductStock,
  initializeDefaultStocks,
  type LabConfirmationItem,
} from '@/lib/workflow-storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const SOYA_PARAMETERS = [
  { item: 'FFA', standard: '0.1 MAX' },
  { item: 'COLOUR 1" CELL', standard: '2 UNITS' },
  { item: '5.25" CELL', standard: '10 UNITS' },
  { item: 'M.I.V.', standard: '0.10 MAX' },
  { item: 'C.P.', standard: '0 °C' },
  { item: 'P.V.', standard: '2' },
  { item: 'I.V.', standard: '120 - 141' },
  { item: 'S.V.', standard: '189 - 195' },
  { item: 'USM', standard: '1.5 MAX' },
  { item: 'FLASH POINT', standard: '>250 °C' },
  { item: 'S.P. GRAVITY AT 30 °C', standard: '0.91 - 0.92' },
  { item: 'R.I. AT 40 °C', standard: '1.4649 - 1.4710' },
  { item: 'TBHQ', standard: '200 PPM' },
  { item: 'HELPHEN TEST', standard: 'NEGATIVE' },
  { item: 'P. CONTENT', standard: '0.02' },
  { item: 'ODOUR', standard: 'OK' },
  { item: 'C.O.T', standard: 'NEGATIVE' },
  { item: 'M.O.T', standard: 'NEGATIVE' },
  { item: 'VITAMIN', standard: '-' },
  { item: 'ANTI FOAMING', standard: '10 PPM MAX' },
  { item: 'STEARIC (18:0)', standard: '2 - 5.5' },
  { item: 'OLEIC (18:1)', standard: '17 - 30' },
  { item: 'LINOLEIC (C18:2)', standard: '48 - 59' },
  { item: 'LINOLENIC (C18:3)', standard: '4.5 - 11' },
  { item: 'ARGEMON OIL TEST', standard: 'NEG' },
];

const RBO_PARAMETERS = [
  { item: 'FFA', standard: '-' },
  { item: 'M.I.V', standard: '-' },
  { item: 'COLOUR', standard: '-' },
  { item: 'P.V.', standard: '-' },
  { item: 'I.V.', standard: '-' },
  { item: 'S.V.', standard: '-' },
  { item: 'U.S.M', standard: '-' },
  { item: 'ORYZANOL', standard: '-' },
  { item: 'FLASH POINT', standard: '-' },
  { item: 'SP. GRAVITY 30 °C', standard: '-' },
  { item: 'CLEARITY AT 25 °C', standard: '-' },
  { item: 'C.P.', standard: '-' },
  { item: 'T.B.H.Q', standard: '-' },
];

const PALM_PARAMETERS = [
  { item: 'APPEARANCE', standard: 'CLEAR' },
  { item: 'MIV', standard: '0.10 % MAX' },
  { item: 'FFA(AS PALMITIC)', standard: '0.10 % MAX' },
  { item: 'COLOUR 1" CELL(Y+5R)', standard: '10.0 MAX' },
  { item: '5.25" CELL', standard: '6.0 RED MAX' },
  { item: 'PV', standard: '1.0 MAX' },
  { item: 'IV', standard: '45-62' },
  { item: 'SV', standard: '195-205' },
  { item: 'USM', standard: '1.20 % MAX' },
  { item: 'CP', standard: '18.0 MAX' },
  { item: 'B. CAROTEIN', standard: '500-1200 mg/Kg' },
  { item: 'R.I. AT 40 °C', standard: '1.4550-1.4610' },
  { item: 'S.P. GRAVITY AT 40 °C', standard: '0.890-0.897' },
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
  if (n.includes('rice bran oil') || n.includes('rbo') || n.includes('rice bran')) return 'Rice Bran Oil';
  if (n.includes('soybean') || n.includes('soya') || n.includes('sbo')) return 'Soybean Oil';
  if (n.includes('palm') || n.includes('palmolein')) return 'Palm Oil';
  if (n.includes('mustard') || n.includes('kachi ghani')) return 'Mustard Oil';
  if (n.includes('sunflower')) return 'Sunflower Oil';
  if (n.includes('groundnut')) return 'Groundnut Oil';
  return 'Other Oils';
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return 'bg-blue-100 text-blue-800';
    case 'issued':    return 'bg-green-100 text-green-800';
    case 'pending':   return 'bg-yellow-100 text-yellow-800';
    default:          return 'bg-gray-100 text-gray-800';
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmItem {
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
  labDate?: string;
  qaStatus?: string;
  approvalDate?: string;
  givenFromTankNo?: string;
  approvedQty?: number;
}

interface ProductGroup {
  productKey: string;
  productName: string;
  packingSize?: string;
  packingType: string;
  totalQuantity: number;
  totalWeightKg: number;
  availableStock: number;
  approvedQty: number;
  status: string;
  tankNo?: string;
  givenFromTankNo?: string;
  items: ConfirmItem[];
}

interface OilTypeGroup {
  type: string;
  totalQuantity: number;
  totalWeightKg: number;
  availableStock: number;
  approvedQty: number;
  products: ProductGroup[];
}

// ─── Component ───────────────────────────────────────────────────────────────

const LabConfirmation = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [confirmations, setConfirmations] = useState<ConfirmItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Expand/collapse state
  const [expandedOilTypes, setExpandedOilTypes] = useState<Record<string, boolean>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Form state — selectedProduct stores the Oil Type string
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [formDetailsExpanded, setFormDetailsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    approvedQuantity: '',
    giveFromTankNo: '',
    remarks: '',
  });
  const [additivesData, setAdditivesData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (!showForm || !selectedProduct) return;

    if (selectedProduct === 'Soybean Oil') {
      setAdditivesData(SOYA_PARAMETERS.map(p => ({ ...p, actual: '' })));
    } else if (selectedProduct === 'Rice Bran Oil') {
      setAdditivesData(RBO_PARAMETERS.map(p => ({ ...p, actual: '' })));
    } else if (selectedProduct === 'Palm Oil') {
      setAdditivesData(PALM_PARAMETERS.map(p => ({ ...p, actual: '' })));
    } else {
      setAdditivesData([]);
    }
  }, [selectedProduct, showForm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint =
        activeTab === 'pending'
          ? `${API_BASE_URL}/lab-confirmation/pending`
          : `${API_BASE_URL}/lab-confirmation/history`;

      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.status === 'success') {
        const mapped: ConfirmItem[] = result.data.map((item: any) => {
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
              labDate: item.lab_date,
              qaStatus: item.status === 'Confirmed' ? 'Pass' : 'Fail',
              approvalDate: item.indentDetails.approval_date,
              givenFromTankNo: item.indentDetails.given_from_tank_no,
              approvedQty: parseFloat(item.indentDetails.approved_qty || item.issued_quantity || 0),
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
            approvalDate: item.approval_date,
            givenFromTankNo: item.given_from_tank_no,
            approvedQty: parseFloat(item.approved_qty || 0),
          };
        });
        setConfirmations(mapped);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groupByOilType = (list: ConfirmItem[]): OilTypeGroup[] => {
    const oilGroups: Record<string, OilTypeGroup> = {};

    list.forEach(item => {
      const oilType = categorizeOilType(item.productName);
      const productKey = normalizeProductKey(item.productName, item.packingSize);

      if (!oilGroups[oilType]) {
        oilGroups[oilType] = { type: oilType, totalQuantity: 0, totalWeightKg: 0, availableStock: 0, approvedQty: 0, products: [] };
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
          approvedQty: 0,
          status: item.status,
          tankNo: item.tankNo,
          givenFromTankNo: item.givenFromTankNo,
          items: [],
        };
        oilGroups[oilType].products.push(productGroup);
      }

      const pGroup = oilGroups[oilType].products.find(p => p.productKey === productKey)!;
      pGroup.totalQuantity += item.indentQuantity;
      pGroup.totalWeightKg += item.totalWeightKg;
      pGroup.approvedQty += item.approvedQty || 0;
      pGroup.items.push(item);
      oilGroups[oilType].totalQuantity += item.indentQuantity;
      oilGroups[oilType].totalWeightKg += item.totalWeightKg;
      oilGroups[oilType].approvedQty += item.approvedQty || 0;
    });

    return Object.values(oilGroups);
  };

  const toggleOilType = (type: string) =>
    setExpandedOilTypes(prev => ({ ...prev, [type]: !prev[type] }));

  const toggleProduct = (key: string) =>
    setExpandedProducts(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Form helpers ──────────────────────────────────────────────────────────

  const handleOilTypeSelect = (oilType: string) => {
    setSelectedProduct(oilType);
    const group = groupByOilType(confirmations).find(g => g.type === oilType);
    if (group) {
      const allItems = group.products.flatMap(p => p.items);
      setSelectedItems(allItems.map(i => i.id));
      const totalKg = allItems.reduce((s, i) => s + (i.totalWeightKg || 0), 0);
      setFormData(prev => ({ ...prev, approvedQuantity: totalKg.toString() }));
    }
  };

  const handleItemToggle = (itemId: string) => {
    const newSelected = selectedItems.includes(itemId)
      ? selectedItems.filter(id => id !== itemId)
      : [...selectedItems, itemId];
    setSelectedItems(newSelected);

    const totalKg = confirmations
      .filter(c => newSelected.includes(c.id))
      .reduce((s, c) => s + (c.totalWeightKg || 0), 0);
    setFormData(prev => ({ ...prev, approvedQuantity: totalKg.toString() }));
  };


  const resetForm = () => {
    setShowForm(false);
    setSelectedProduct('');
    setSelectedItems([]);
    setFormData({
      approvedQuantity: '',
      giveFromTankNo: '',
      remarks: '',
    });
    setAdditivesData([]);
  };

  const handleConfirmSubmit = async () => {
    if (!selectedProduct || selectedItems.length === 0) {
      alert('Please select an oil type and at least one item');
      return;
    }

    try {
      for (const productionId of selectedItems) {
        const item = confirmations.find(c => c.id === productionId);
        if (!item) continue;

        const body = {
          productionId,
          status: 'Confirmed',
          remarks: formData.remarks,
          testParams: {
            approvedQuantity: formData.approvedQuantity,
            giveFromTankNo: formData.giveFromTankNo,
            qaStatus: 'Pass', // default to Pass if approving
            additives: additivesData,
          },
        };

        const res = await fetch(`${API_BASE_URL}/lab-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to submit lab confirmation');
      }

      alert('Lab confirmation submitted successfully');
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit lab confirmation');
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const oilTypeGroups = groupByOilType(confirmations);
  const uniqueOilTypes = oilTypeGroups.map(g => g.type);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Lab Confirmation"
        description="Verify lab parameters and sample results"
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Approval Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Given Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={8} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {oilTypeGroups.map((group, gi) => {
                  const isGroupExpanded = expandedOilTypes[group.type] || false;
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
                        <td className="px-4 py-3 text-base font-bold text-foreground">
                          {formatNumber(group.approvedQty)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.tankNo)).filter(v => v && v !== '-'))).join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {Array.from(new Set(group.products.flatMap(p => p.items.map(i => i.givenFromTankNo)).filter(v => v && v !== '-'))).join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="outline">Pending</Badge>
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
                              Lab Report
                            </Button>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}

                {oilTypeGroups.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No {activeTab === 'pending' ? 'pending' : 'history'} confirmations
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </Card>

      {/* Lab Confirmation Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Quality Approval & Oil Issue</h2>

              {/* Context Header */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-primary">{selectedProduct}</h3>
                    <p className="text-xs text-muted-foreground">Process lab confirmation and oil issue for the selected oil type.</p>
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
                const group = groupByOilType(confirmations).find(g => g.type === selectedProduct);
                if (!group) return null;

                const totalSelectedQty = confirmations
                  .filter(c => selectedItems.includes(c.id))
                  .reduce((s, c) => s + c.indentQuantity, 0);

                const productDisplayNames = group.products.map(p => 
                  `${p.productName}${p.packingSize ? ' ' + p.packingSize : ''}`
                ).join(', ');

                return (
                  <>
                    {/* Item to be packed section - Always Visible */}
                    <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
                        <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Item(s) to be packed</p>
                        <div className="text-lg font-bold text-primary">
                            {Array.from(new Set(group.products.flatMap(p => {
                              const parts = p.productName.split(' ');
                              return parts.length >= 2 ? [parts[0], parts[1]] : [parts[0]];
                            }))).join(', ')}
                        </div>
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

                    {/* Order Details — grouped by product, collapsible */}
                    {formDetailsExpanded && (
                      <div className="mb-6 space-y-3 animate-in fade-in duration-300">
                        {group.products.map((prod, pi) => (
                          <div key={pi} className="border border-border rounded-lg overflow-hidden">
                            {/* Product sub-header */}
                            <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                {prod.productName}{prod.packingSize ? ' ' + prod.packingSize : ''}
                              </span>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Stock: {prod.availableStock}</span>
                              </div>
                            </div>
                            <table className="w-full text-sm">
                              <thead className="bg-muted/20 border-b border-border">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Select</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Timestamp</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Production ID</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Indent Qty (Kg)</th>
                                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tank No.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-background">
                                {prod.items.map((item: ConfirmItem, idx: number) => (
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
                                      {item.approvalDate ? new Date(item.approvalDate).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{item.id}</td>
                                    <td className="px-3 py-2">{formatNumber(item.totalWeightKg)}</td>
                                    <td className="px-3 py-2">{item.tankNo || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Chemical Additives Section */}
                    {(selectedProduct === 'Rice Bran Oil' || selectedProduct === 'Soybean Oil' || selectedProduct === 'Palm Oil') && (
                      <div className="mb-6 animate-in fade-in duration-300 delay-100">
                        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          Chemical Additives Planning
                        </h3>
                        <div className="border border-border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/30">
                              <tr>
                                <th className="px-4 py-2 text-left">ITEM</th>
                                <th className="px-4 py-2 text-left">STANDARD</th>
                                <th className="px-4 py-2 text-left">RESULTS</th>
                                <th className="px-4 py-2 text-left w-24">UPLOAD</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-background">
                              {additivesData.map((add, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-3 font-semibold text-foreground text-xs">{add.item}</td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs">{add.standard}</td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={add.actual}
                                      onChange={(e) => {
                                        const newData = [...additivesData];
                                        newData[idx].actual = e.target.value;
                                        setAdditivesData(newData);
                                      }}
                                      placeholder="Result"
                                      className="w-full bg-muted/20 border-border border rounded px-2 py-1 text-xs"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-xs w-24">
                                    <input type="file" accept="image/*" className="w-full text-xs" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Approved Quantity */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-foreground mb-2">Approved Quantity (Kg)</label>
                      <input
                        type="number"
                        value={formData.approvedQuantity}
                        onChange={e => setFormData({ ...formData, approvedQuantity: e.target.value })}
                        disabled
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background font-bold text-primary opacity-70 cursor-not-allowed"
                      />
                    </div>

                    {/* Remarks */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                      <textarea
                        value={formData.remarks}
                        onChange={e => setFormData({ ...formData, remarks: e.target.value })}
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
                  onClick={handleConfirmSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || selectedItems.length === 0}
                >
                  Issue Approved Batch
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LabConfirmation;

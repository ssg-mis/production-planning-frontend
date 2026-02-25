'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';


// ─── Types ────────────────────────────────────────────────────────────────────

interface BOMConsumption {
  material: string;
  planned: number;
  actual: number;
  diff: number;
  returned: number;
  damaged: number;
  damageReason: string;
}

interface ProductionEntryItem {
  id: string; // production_id
  productName: string;
  packingSize: string;
  packingType: string;
  partyName: string;
  plannedQty: number;
  totalWeightKg: number;
  tankNo: string;
  givenTankNo: string;
  status: string;
  processedDate?: string;
  actualQty?: number;
  remarks?: string;
  bom: Array<{
    id: number;
    item_name: string;
    qty_required: number;
    qty_allocated: number;
  }>;
  bomConsumption?: BOMConsumption[];
}

interface ProductGroup {
  productKey: string;
  productName: string;
  packingSize?: string;
  packingType: string;
  totalQuantity: number;
  totalWeightKg: number;
  items: ProductionEntryItem[];
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
    case 'completed': return 'bg-green-100 text-green-800';
    case 'pending':   return 'bg-yellow-100 text-yellow-800';
    default:          return 'bg-gray-100 text-gray-800';
  }
};

const ProductionEntry = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [entries, setEntries] = useState<ProductionEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [selectedOilType, setSelectedOilType] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [formDetailsExpanded, setFormDetailsExpanded] = useState(false);
  
  // Per-production ID actual quantities
  const [actualQtys, setActualQtys] = useState<Record<string, string>>({});
  // Per-production ID BOM consumptions
  const [bomConsumptions, setBomConsumptions] = useState<Record<string, BOMConsumption[]>>({});

  // Aggregated data for the modal
  const [aggregatedQtys, setAggregatedQtys] = useState<Record<string, string>>({});
  const [aggregatedBom, setAggregatedBom] = useState<Record<string, BOMConsumption[]>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'pending'
        ? `${API_BASE_URL}/production-entry/pending`
        : `${API_BASE_URL}/production-entry/history`;
      
      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.status === 'success') {
        const mappedData = result.data.map((item: any) => {
          if (activeTab === 'history') {
             return {
                id: item.production_id,
                productName: item.indentDetails?.product_name || 'N/A',
                packingSize: item.indentDetails?.packing_size || '',
                packingType: item.indentDetails?.packing_type || '',
                partyName: item.indentDetails?.party_name || 'N/A',
                plannedQty: Number(item.indentDetails?.indent_quantity || 0),
                totalWeightKg: Number(item.indentDetails?.total_weight_kg || 0),
                tankNo: item.indentDetails?.tank_no || '-',
                givenTankNo: item.indentDetails?.given_from_tank_no || '-',
                status: 'Completed',
                processedDate: item.processed_date,
                actualQty: Number(item.actual_qty || 0),
                remarks: item.remarks,
                bom: item.bom || [],
                bomConsumption: item.bom_consumption || []
             };
          }
          return {
            id: item.production_id,
            productName: item.product_name,
            packingSize: item.packing_size || '',
            packingType: item.packing_type || '',
            partyName: item.party_name,
            plannedQty: Number(item.indent_quantity || 0),
            totalWeightKg: Number(item.total_weight_kg || 0),
            tankNo: item.tank_no || '-',
            givenTankNo: item.given_from_tank_no || '-',
            status: 'Pending',
            bom: item.bom || []
          };
        });
        setEntries(mappedData);
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

  const groupByOilType = (list: ProductionEntryItem[]): OilTypeGroup[] => {
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

  const handleProductionSubmit = async () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one item');
      return;
    }

    try {
      // Find the group and products to distribute values
      const group = oilTypeGroups.find(g => g.type === selectedOilType);
      if (!group) return;

      for (const prod of group.products) {
        const productItems = prod.items.filter(i => selectedItems.includes(i.id));
        if (productItems.length === 0) continue;

        const totalPlanned = productItems.reduce((acc, i) => acc + i.plannedQty, 0);
        const totalActualProduced = Number(aggregatedQtys[prod.productKey] || 0);
        const totalBOM = aggregatedBom[prod.productKey] || [];

        for (const item of productItems) {
          const ratio = totalPlanned > 0 ? item.plannedQty / totalPlanned : 1 / productItems.length;
          
          // Distribute actual qty produced
          const itemActualQty = Number((totalActualProduced * ratio).toFixed(2));
          
          // Distribute BOM consumption
          const itemBOM = totalBOM.map(b => ({
            ...b,
            planned: Number((b.planned * ratio).toFixed(2)),
            actual: Number((b.actual * ratio).toFixed(2)),
            diff: Number((b.diff * ratio).toFixed(2)),
            damaged: Number((b.damaged * ratio).toFixed(2)),
          }));

          const response = await fetch(`${API_BASE_URL}/production-entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productionId: item.id,
              actualQty: itemActualQty,
              remarks,
              processedBy: 'Production Head',
              bomConsumption: itemBOM
            })
          });

          if (!response.ok) throw new Error(`Failed to process production entry for ${item.id}`);
        }
      }

      alert('✅ Production entries saved successfully!');
      setShowForm(false);
      setSelectedItems([]);
      setRemarks('');
      setAggregatedQtys({});
      setAggregatedBom({});
      setFormDetailsExpanded(false);
      fetchData();
    } catch (error) {
      console.error('Error submitting production entries:', error);
      alert('❌ Error processing production entries');
    }
  };

  const oilTypeGroups = groupByOilType(entries);

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Production Start & Closing Entry"
        description="Track production output and material consumption"
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
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Issue Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Given Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Tank No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                {activeTab === 'history' && <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actual Qty</th>}
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Action</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={activeTab === 'history' ? 8 : 7} rows={5} />
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
                        {formatNumber(group.totalQuantity)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {group.products[0]?.items[0]?.givenTankNo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {group.products[0]?.items[0]?.tankNo || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(activeTab === 'pending' ? 'Pending' : 'Completed')}>
                          {activeTab === 'pending' ? 'Pending' : 'Completed'}
                        </Badge>
                      </td>
                      {activeTab === 'history' && (
                        <td className="px-4 py-3 text-base font-bold text-green-600 font-mono">
                           {formatNumber(group.products.reduce((acc, p) => acc + p.items.reduce((acc2, i) => acc2 + (i.actualQty || 0), 0), 0))}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">
                        {activeTab === 'pending' && (
                          <Button 
                            size="sm"
                            className="bg-primary hover:bg-primary/90"
                            onClick={() => {
                              setSelectedOilType(group.type);
                              const allIds = group.products.flatMap(p => p.items.map(i => i.id));
                              setSelectedItems(allIds);
                              
                              // Initialize aggregated quantities and BOM consumptions
                              const initialAggQtys: Record<string, string> = {};
                              const initialAggBOMs: Record<string, BOMConsumption[]> = {};

                              group.products.forEach(p => {
                                  initialAggQtys[p.productKey] = p.items.reduce((acc, i) => acc + i.plannedQty, 0).toString();
                                  
                                  // Aggregate BOM by material name
                                  const bomMap: Record<string, BOMConsumption> = {};
                                  p.items.forEach(item => {
                                      item.bom.forEach(b => {
                                          if (!bomMap[b.item_name]) {
                                              bomMap[b.item_name] = {
                                                  material: b.item_name,
                                                  planned: 0,
                                                  actual: 0,
                                                  diff: 0,
                                                  returned: 0,
                                                  damaged: 0,
                                                  damageReason: ''
                                              };
                                          }
                                          bomMap[b.item_name].planned += Number(b.qty_allocated);
                                          bomMap[b.item_name].actual += Number(b.qty_allocated);
                                      });
                                  });
                                  initialAggBOMs[p.productKey] = Object.values(bomMap);
                              });

                              setAggregatedQtys(initialAggQtys);
                              setAggregatedBom(initialAggBOMs);
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
                    <td colSpan={activeTab === 'history' ? 8 : 7} className="p-8 text-center text-muted-foreground">
                      No {activeTab === 'pending' ? 'pending' : 'history'} production entries
                    </td>
                  </tr>
                )}
              </tbody>
            )}
          </table>
        </div>
      </Card>

      {/* Process Production Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-5xl max-h-[95vh] overflow-y-auto p-6 bg-background border-border shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-2">
              <h2 className="text-xl font-bold text-foreground">Process Production Start & Closing Entry</h2>
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
                        <p className="text-xs text-muted-foreground">Track production output and verify BOM consumption details.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-foreground">Production Details</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFormDetailsExpanded(!formDetailsExpanded)}
                          className="h-8 py-0 underline text-primary"
                        >
                          {formDetailsExpanded ? 'Hide Individual Details' : 'Show Individual Details'}
                        </Button>
                      </div>

                      {group.products.map((prod, pi) => {
                        const checkedItems = prod.items.filter(i => selectedItems.includes(i.id));
                        if (checkedItems.length === 0) return null;

                        return (
                          <div key={pi} className="border border-border rounded-lg overflow-hidden flex flex-col">
                            <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground">
                                {prod.productName}{prod.packingSize ? ' ' + prod.packingSize : ''}
                              </span>
                              <div className="flex items-center gap-6">
                                <div className="text-xs">
                                  <span className="text-muted-foreground mr-1">Received Qty:</span>
                                  <strong className="text-foreground">{formatNumber(prod.items.reduce((acc, c) => acc + c.plannedQty, 0))}</strong>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-muted-foreground">Actual Qty Produced:</label>
                                  <input
                                    type="number"
                                    value={aggregatedQtys[prod.productKey] || ''}
                                    onChange={(e) => setAggregatedQtys(prev => ({ ...prev, [prod.productKey]: e.target.value }))}
                                    className="w-24 px-2 py-0.5 text-sm border border-border rounded bg-background font-bold"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="p-4 space-y-4">
                              {/* Always Visible Aggregated BOM Table */}
                              <div className="mt-2 text-xs font-semibold text-muted-foreground uppercase">BOM Consumption & Variance / Wastage</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs bg-background border border-border">
                                    <thead className="bg-muted/20 border-b">
                                        <tr>
                                            <th className="px-2 py-1 text-left">Material</th>
                                            <th className="px-2 py-1 text-left">Planned</th>
                                            <th className="px-2 py-1 text-left w-24">Actual</th>
                                            <th className="px-2 py-1 text-left">Variance / Wastage</th>
                                            <th className="px-2 py-1 text-left w-20">Damaged</th>
                                            <th className="px-2 py-1 text-left">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(aggregatedBom[prod.productKey] || []).map((bom, bIdx) => {
                                            return (
                                                <tr key={bIdx}>
                                                    <td className="px-2 py-1 font-medium">{bom.material}</td>
                                                    <td className="px-2 py-1">{formatNumber(bom.planned)}</td>
                                                    <td className="px-2 py-1">
                                                        <input
                                                            type="number"
                                                            value={bom.actual}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value);
                                                                const updated = [...(aggregatedBom[prod.productKey] || [])];
                                                                updated[bIdx].actual = val;
                                                                updated[bIdx].diff = updated[bIdx].planned - val;
                                                                setAggregatedBom(prev => ({ ...prev, [prod.productKey]: updated }));
                                                            }}
                                                            className="w-full px-1 py-0.5 border border-border rounded"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <input
                                                            type="number"
                                                            value={bom.diff}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value);
                                                                const updated = [...(aggregatedBom[prod.productKey] || [])];
                                                                updated[bIdx].diff = val;
                                                                setAggregatedBom(prev => ({ ...prev, [prod.productKey]: updated }));
                                                            }}
                                                            className={`w-full px-1 py-0.5 border border-border rounded font-bold ${bom.diff === 0 ? 'text-green-600' : 'text-orange-600'}`}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <input
                                                            type="number"
                                                            value={bom.damaged}
                                                            onChange={(e) => {
                                                                const updated = [...(aggregatedBom[prod.productKey] || [])];
                                                                updated[bIdx].damaged = Number(e.target.value);
                                                                setAggregatedBom(prev => ({ ...prev, [prod.productKey]: updated }));
                                                            }}
                                                            className="w-full px-1 py-0.5 border border-border rounded"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <input
                                                            type="text"
                                                            value={bom.damageReason}
                                                            onChange={(e) => {
                                                                const updated = [...(aggregatedBom[prod.productKey] || [])];
                                                                updated[bIdx].damageReason = e.target.value;
                                                                setAggregatedBom(prev => ({ ...prev, [prod.productKey]: updated }));
                                                            }}
                                                            className="w-full px-1 py-0.5 border border-border rounded"
                                                            placeholder="Remarks"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                              </div>

                              {/* Click Show Details to see Production ID / Tank Info */}
                              {formDetailsExpanded && (
                                <div className="bg-muted/20 p-3 rounded-lg border border-border mt-2">
                                  <div className="text-xs font-bold mb-2 uppercase text-muted-foreground">Individual Production Details</div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {checkedItems.map((item, idx) => (
                                      <div key={idx} className="bg-background p-2 rounded border border-border">
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-bold">{item.id}</span>
                                          <span className="text-[10px] text-muted-foreground">Planned: {formatNumber(item.plannedQty)}</span>
                                        </div>
                                        <div className="text-[11px] font-semibold truncate mb-1">{item.partyName}</div>
                                        <div className="text-[10px] text-muted-foreground">Tank: {item.givenTankNo} → {item.tankNo}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                      <textarea
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="General remarks for this production run"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground h-20"
                      />
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button 
                  onClick={handleProductionSubmit} 
                  disabled={selectedItems.length === 0}
                >
                  Close Production Entry
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProductionEntry;

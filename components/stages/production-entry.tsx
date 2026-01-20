'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getProductionEntries,
  moveToStockIn,
  getProductStock,
  initializeDefaultStocks,
  type ProductionEntryItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedProduction {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalPlannedQty: number;
  totalActualQty: number;
  availableStock: number;
  shortage: number;
  status: string;
  productions: ProductionEntryItem[];
  partyDetails: Array<{
    orderRef: string;
    partyName: string;
    quantity: number;
    packingType: string;
  }>;
  bomConsumption: Array<{
    material: string;
    planned: number;
    actual: number;
    diff: number;
    returned: number;
    damaged: number;
    damageReason: string;
  }>;
}

const ProductionEntry = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [productions, setProductions] = useState<ProductionEntryItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showProductionForm, setShowProductionForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [actualQty, setActualQty] = useState<string>('');
  const [bomData, setBomData] = useState<Array<{
    material: string;
    planned: number;
    actual: number;
    diff: number;
    returned: number;
    damaged: number;
    damageReason: string;
  }>>([]);

  useEffect(() => {
    initializeDefaultStocks();
    const savedProductions = getProductionEntries();
    setProductions(savedProductions);
  }, []);

  // Aggregate productions by product
  const aggregateProductions = (productionsList: ProductionEntryItem[]): AggregatedProduction[] => {
    const aggregated: { [key: string]: AggregatedProduction } = {};

    productionsList.forEach(production => {
      const productKey = normalizeProductKey(production.productName, production.packingSize);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: production.productName,
          packingSize: production.packingSize,
          totalPlannedQty: 0,
          totalActualQty: 0,
          availableStock: stock,
          shortage: 0,
          status: production.status,
          productions: [],
          partyDetails: [],
          bomConsumption: []
        };
      }

      aggregated[productKey].totalPlannedQty += production.plannedQty;
      aggregated[productKey].totalActualQty += production.actualQty;
      aggregated[productKey].productions.push(production);

      // Add party details
      if (production.orderRef && production.partyName) {
        aggregated[productKey].partyDetails.push({
          orderRef: production.orderRef,
          partyName: production.partyName,
          quantity: production.plannedQty,
          packingType: production.packingType || '-'
        });
      }

      // Consolidate BOM consumption
      if (production.bomConsumption) {
        production.bomConsumption.forEach(bom => {
          const existingBom = aggregated[productKey].bomConsumption.find(b => b.material === bom.material);
          if (existingBom) {
            existingBom.planned += bom.planned;
            existingBom.actual += bom.actual;
            existingBom.diff += bom.diff;
            existingBom.returned += bom.returned;
            existingBom.damaged += bom.damaged;
          } else {
            aggregated[productKey].bomConsumption.push({ ...bom });
          }
        });
      }
    });

    // Calculate shortage
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalPlannedQty - agg.availableStock);
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleProductionSubmit = () => {
    if (!selectedProduct || !actualQty) {
      alert('Please select a product and enter actual quantity');
      return;
    }

    // Get all productions for the selected product
    const selectedProductions = productions.filter(production => 
      normalizeProductKey(production.productName, production.packingSize) === selectedProduct
    );

    // Process each production - update actual qty, BOM consumption and move to Stock In
    selectedProductions.forEach(production => {
      const updatedProduction: ProductionEntryItem = {
        ...production,
        actualQty: Number(actualQty),
        bomConsumption: bomData, // Use the edited BOM data
        status: 'Completed',
      };
      moveToStockIn(updatedProduction);
    });

    // Update local state to remove processed items
    const remainingProductions = productions.filter(production => 
      normalizeProductKey(production.productName, production.packingSize) !== selectedProduct
    );
    setProductions(remainingProductions);

    // Reset form
    setShowProductionForm(false);
    setSelectedProduct('');
    setActualQty('');
    setBomData([]);
  };

  const pendingProductions = productions.filter((p) => p.status === 'Pending');
  const historyProductions = productions.filter((p) => p.status !== 'Pending');
  const displayProductions = activeTab === 'pending' ? pendingProductions : historyProductions;
  const aggregatedProductions = aggregateProductions(displayProductions);

  const uniqueProducts = aggregateProductions(pendingProductions).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Production Start & Closing Entry"
        description="Track production output and material consumption"
      />

      {/* Tabs and Action Button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
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

        {activeTab === 'pending' && pendingProductions.length > 0 && (
          <Button 
            onClick={() => setShowProductionForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Production Entry
          </Button>
        )}
      </div>

      {/* Aggregated Production Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Planned Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actual Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">BOM Items</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedProductions.map((aggregate) => {
                const isExpanded = expandedProduct === aggregate.productKey;
                
                return (
                  <>
                    <tr 
                      key={aggregate.productKey} 
                      className="hover:bg-card/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedProduct(isExpanded ? null : aggregate.productKey)}
                    >
                      <td className="px-4 py-3 text-sm">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">
                        {`${aggregate.productName}${aggregate.packingSize ? ' ' + aggregate.packingSize : ''}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-semibold">
                        {aggregate.totalPlannedQty}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">
                        {aggregate.totalActualQty || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {aggregate.availableStock}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {aggregate.partyDetails?.length || 0} {aggregate.partyDetails?.length === 1 ? 'order' : 'orders'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                      </td>
                    </tr>
                    
                    {/* Expanded Party Details */}
{isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">
                              Party Details: ({aggregate.partyDetails.length} {aggregate.partyDetails.length === 1 ? 'order' : 'orders'})
                            </h4>
                            <table className="w-full bg-background/50 rounded-lg overflow-hidden">
                              <thead className="bg-background">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Order Ref</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Party Name</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Quantity</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Packing Type</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.partyDetails.map((party, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{party.orderRef}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{party.partyName}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{party.quantity}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{party.packingType}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        {aggregatedProductions.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} production entries
          </div>
        )}
      </Card>

      {/* Process Production Entry Form Modal */}
      {showProductionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Production Entry</h2>
              
              {/* Product Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    // Auto-fill planned quantity and initialize BOM data
                    const agg = aggregateProductions(pendingProductions).find(p => p.productKey === e.target.value);
                    if (agg) {
                      setActualQty(agg.totalPlannedQty.toString());
                      // Initialize BOM data for editing
                      setBomData(agg.bomConsumption.map(bom => ({ ...bom })));
                    }
                  }}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="">-- Select Product --</option>
                  {uniqueProducts.map(product => (
                    <option key={product.key} value={product.key}>{product.name}</option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-card rounded-lg border border-border">
                    <div>
                      <span className="text-xs text-muted-foreground">Planned Qty:</span>
                      <p className="font-semibold text-foreground text-lg">
                        {aggregateProductions(pendingProductions).find(p => p.productKey === selectedProduct)?.totalPlannedQty || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Available Stock:</span>
                      <p className="font-semibold text-foreground text-lg">
                        {aggregateProductions(pendingProductions).find(p => p.productKey === selectedProduct)?.availableStock || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">BOM Items:</span>
                      <p className="font-semibold text-foreground text-lg">
                        {aggregateProductions(pendingProductions).find(p => p.productKey === selectedProduct)?.bomConsumption.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Actual Quantity Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Actual Quantity Produced <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={actualQty}
                      onChange={(e) => setActualQty(e.target.value)}
                      placeholder="Enter actual quantity produced"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    />
                  </div>

                  {/* BOM Consumption Details */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-foreground mb-3">BOM Consumption & Variance Tracking</h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-card border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Material Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Planned Qty</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Actual Consumed QTY</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Variance</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Damaged</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Damage Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {bomData.map((bom, idx) => {
                            const variance = bom.planned - bom.actual;
                            return (
                              <tr key={idx} className="hover:bg-card/50">
                                <td className="px-4 py-3 text-foreground font-medium">{bom.material}</td>
                                <td className="px-4 py-3 text-foreground">{bom.planned.toFixed(2)}</td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={bom.actual}
                                    onChange={(e) => {
                                      const newBomData = [...bomData];
                                      newBomData[idx].actual = Number(e.target.value);
                                      newBomData[idx].diff = newBomData[idx].planned - Number(e.target.value);
                                      setBomData(newBomData);
                                    }}
                                    className="w-full px-2 py-1 border border-border rounded bg-background text-foreground"
                                  />
                                </td>
                                <td className={`px-4 py-3 font-semibold ${variance === 0 ? 'text-green-600' : variance > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                  {variance.toFixed(2)}
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={bom.damaged}
                                    onChange={(e) => {
                                      const newBomData = [...bomData];
                                      newBomData[idx].damaged = Number(e.target.value);
                                      setBomData(newBomData);
                                    }}
                                    className="w-full px-2 py-1 border border-border rounded bg-background text-foreground"
                                    placeholder="Damaged qty"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="text"
                                    value={bom.damageReason}
                                    onChange={(e) => {
                                      const newBomData = [...bomData];
                                      newBomData[idx].damageReason = e.target.value;
                                      setBomData(newBomData);
                                    }}
                                    className="w-full px-2 py-1 border border-border rounded bg-background text-foreground"
                                    placeholder="Enter remarks"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowProductionForm(false);
                    setSelectedProduct('');
                    setActualQty('');
                    setBomData([]);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleProductionSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || !actualQty}
                >
                  Close Production & Submit
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

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getDispatchPlans, 
  moveToOilReceipt, 
  getProductStock,
  initializeDefaultStocks,
  type DispatchPlanItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedPlan {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalQuantity: number;
  availableStock: number;
  shortage: number;
  totalLots: number;
  status: string;
  plans: DispatchPlanItem[];
}

const DispatchPlanning = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [plans, setPlans] = useState<DispatchPlanItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    initializeDefaultStocks();
    const savedPlans = getDispatchPlans();
    const validPlans = savedPlans.filter((p) => p && p.lots && Array.isArray(p.lots));
    setPlans(validPlans);
  }, []);

  // Aggregate plans by product
  const aggregatePlans = (plansList: DispatchPlanItem[]): AggregatedPlan[] => {
    const aggregated: { [key: string]: AggregatedPlan } = {};

    plansList.forEach(plan => {
      const productKey = normalizeProductKey(plan.productName, plan.packingSize);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: plan.productName,
          packingSize: plan.packingSize,
          totalQuantity: 0,
          availableStock: stock,
          shortage: 0,
          totalLots: 0,
          status: plan.status,
          plans: []
        };
      }

      aggregated[productKey].totalQuantity += plan.totalQty;
      aggregated[productKey].totalLots += (plan.lots?.length || 0);
      aggregated[productKey].plans.push(plan);
    });

    // Calculate shortage
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalQuantity - agg.availableStock);
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'planned':
        return 'bg-blue-100 text-blue-800';
      case 'processed':
        return 'bg-purple-100 text-purple-800';
      case 'received':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleDispatch = () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    // Get all plans for the selected product
    const selectedPlans = plans.filter(plan => 
      normalizeProductKey(plan.productName, plan.packingSize) === selectedProduct
    );

    // Move each plan to Oil Receipt
    selectedPlans.forEach(plan => {
      moveToOilReceipt(plan);
    });

    // Update local state to remove processed items
    const remainingPlans = plans.filter(plan => 
      normalizeProductKey(plan.productName, plan.packingSize) !== selectedProduct
    );
    setPlans(remainingPlans);

    // Reset form
    setShowDispatchForm(false);
    setSelectedProduct('');
  };

  const pendingPlans = plans.filter((p) => p.status === 'Planned');
  const historyPlans = plans.filter((p) => p.status !== 'Planned');
  const displayPlans = activeTab === 'pending' ? pendingPlans : historyPlans;
  const aggregatedPlans = aggregatePlans(displayPlans);

  const uniqueProducts = aggregatePlans(pendingPlans).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Dispatch Planning (Plant Person)"
        description="Plan additives and distribute oil to packing section by tank size (5 MT each lot)"
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

        {activeTab === 'pending' && pendingPlans.length > 0 && (
          <Button 
            onClick={() => setShowDispatchForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Dispatch
          </Button>
        )}
      </div>

      {/* Aggregated Dispatch Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Qty (MT)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Shortage</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Lots</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedPlans.map((aggregate) => {
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
                        {aggregate.totalQuantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {aggregate.availableStock}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${aggregate.shortage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {aggregate.shortage > 0 ? aggregate.shortage : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {aggregate.totalLots} lots of 5 MT each
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                      </td>
                    </tr>
                    
                    {/* Expanded Party Details */}
                    {isExpanded && aggregate.plans.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">
                              Order Details: ({aggregate.plans.length} {aggregate.plans.length === 1 ? 'order' : 'orders'})
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
                                {aggregate.plans.map((plan: any, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{plan.orderRef || plan.id}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{plan.partyName || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{plan.totalQty}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{plan.packingType || '-'}</td>
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
        {aggregatedPlans.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} dispatch plans
          </div>
        )}
      </Card>

      {/* Dispatch Processing Form Modal */}
      {showDispatchForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Dispatch to Packing</h2>
              
              {/* Product Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                  <option value="">-- Select Product --</option>
                  {uniqueProducts.map(product => (
                    <option key={product.key} value={product.key}>{product.name}</option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <>
                  {/* Stock Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-3 bg-card rounded-lg border border-border">
                    <div>
                      <span className="text-xs text-muted-foreground">Available Stock:</span>
                      <p className="font-semibold text-foreground">
                        {aggregatePlans(pendingPlans).find(p => p.productKey === selectedProduct)?.availableStock || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Total Quantity:</span>
                      <p className="font-semibold text-foreground">
                        {aggregatePlans(pendingPlans).find(p => p.productKey === selectedProduct)?.totalQuantity || 0} MT
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Shortage:</span>
                      <p className={`font-semibold ${(aggregatePlans(pendingPlans).find(p => p.productKey === selectedProduct)?.shortage || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(aggregatePlans(pendingPlans).find(p => p.productKey === selectedProduct)?.shortage || 0) > 0 
                          ? aggregatePlans(pendingPlans).find(p => p.productKey === selectedProduct)?.shortage
                          : '-'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Lots Summary */}
                  <div className="mb-6">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Total Lots:</span> {aggregatePlans(pendingPlans).find(p => p.productKey === selectedProduct)?.totalLots || 0} lots of 5 MT each
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDispatchForm(false);
                    setSelectedProduct('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleDispatch}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct}
                >
                  Dispatch to Packing
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

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getDispatchOrders,
  saveDispatchOrder,
  getProductStock,
  initializeDefaultStocks,
  type DispatchOrder 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string): string => {
  return productName.toUpperCase().replace(/\s+/g, ' ').trim();
};

interface AggregatedDispatch {
  productKey: string;
  productName: string;
  totalQuantity: number;
  availableStock: number;
  shortage: number;
  tankSize: string;
  totalLots: number;
  status: string;
  orders: DispatchOrder[];
}

const OrderDispatchPlanning = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [formData, setFormData] = useState({
    tankSize: '5',
    lots: '',
    remarks: '',
  });

  useEffect(() => {
    initializeDefaultStocks();
    const savedOrders = getDispatchOrders();
    
    // Initialize with default data if empty
    if (savedOrders.length === 0) {
      const defaultOrders: DispatchOrder[] = [
        {
          id: '1',
          productName: 'HK Rice',
          totalQuantity: 15,
          tankSize: '5 MT each',
          totalLots: 3,
          status: 'Planned',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          productName: 'HK SOYA',
          totalQuantity: 1000,
          tankSize: '5 MT each',
          totalLots: 200,
          status: 'Planned',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          productName: 'HK Soya',
          totalQuantity: 1000,
          tankSize: '5 MT each',
          totalLots: 200,
          status: 'Planned',
          createdAt: new Date().toISOString(),
        },
      ];
      
      defaultOrders.forEach(order => saveDispatchOrder(order));
      setOrders(defaultOrders);
    } else {
      setOrders(savedOrders);
    }
  }, []);

  // Aggregate orders by product
  const aggregateOrders = (ordersList: DispatchOrder[]): AggregatedDispatch[] => {
    const aggregated: { [key: string]: AggregatedDispatch } = {};

    ordersList.forEach(order => {
      const productKey = normalizeProductKey(order.productName);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: order.productName,
          totalQuantity: 0,
          availableStock: stock,
          shortage: 0,
          tankSize: order.tankSize,
          totalLots: 0,
          status: order.status,
          orders: []
        };
      }

      aggregated[productKey].totalQuantity += order.totalQuantity;
      aggregated[productKey].totalLots += order.totalLots;
      aggregated[productKey].orders.push(order);
    });

    // Calculate shortage
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalQuantity - agg.availableStock);
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'dispatched':
        return 'bg-green-100 text-green-800';
      case 'planned':
        return 'bg-blue-100 text-blue-800';
      case 'processed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleDispatchSubmit = () => {
    if (!selectedProduct || !formData.lots) {
      alert('Please select a product and fill in all fields');
      return;
    }

    // Update orders for selected product
    const updatedOrders = orders.map(order => {
      if (normalizeProductKey(order.productName) === selectedProduct) {
        return {
          ...order,
          status: 'Processed',
          processedAt: new Date().toISOString(),
        };
      }
      return order;
    });

    setOrders(updatedOrders);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('dispatch_orders', JSON.stringify(updatedOrders));
    }

    // Reset form
    setShowDispatchForm(false);
    setSelectedProduct('');
    setFormData({
      tankSize: '5',
      lots: '',
      remarks: '',
    });
  };

  const pendingOrders = orders.filter(o => o.status === 'Planned');
  const historyOrders = orders.filter(o => o.status !== 'Planned');

  const displayOrders = activeTab === 'pending' ? pendingOrders : historyOrders;
  const aggregatedOrders = aggregateOrders(displayOrders);

  const uniqueProducts = aggregateOrders(pendingOrders).map(a => ({
    key: a.productKey,
    name: a.productName
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

        {activeTab === 'pending' && pendingOrders.length > 0 && (
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
              {aggregatedOrders.map((aggregate) => {
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
                        {aggregate.productName}
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
                        {aggregate.totalLots} lots of {aggregate.tankSize}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                      </td>
                    </tr>
                    
                    {/* Expanded Details */}
                    {isExpanded && aggregate.orders.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">
                              Dispatch Details: ({aggregate.orders.length} {aggregate.orders.length === 1 ? 'order' : 'orders'})
                            </h4>
                            <table className="w-full bg-background/50 rounded-lg overflow-hidden">
                              <thead className="bg-background">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Order ID</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Product</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Quantity</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tank Size</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Lots</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.orders.map((order, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{order.id}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{order.productName}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{order.totalQuantity} MT</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{order.tankSize}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{order.totalLots}</td>
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
        {aggregatedOrders.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} dispatch orders
          </div>
        )}
      </Card>

      {/* Dispatch Processing Form Modal */}
      {showDispatchForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Dispatch Planning</h2>
              
              {/* Product Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => {
                    setSelectedProduct(e.target.value);
                    const product = aggregateOrders(pendingOrders).find(p => p.productKey === e.target.value);
                    if (product) {
                      setFormData(prev => ({
                        ...prev,
                        lots: product.totalLots.toString()
                      }));
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
                  {/* Stock Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-3 bg-card rounded-lg border border-border">
                    <div>
                      <span className="text-xs text-muted-foreground">Available Stock:</span>
                      <p className="font-semibold text-foreground">
                        {aggregateOrders(pendingOrders).find(p => p.productKey === selectedProduct)?.availableStock || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Total Quantity:</span>
                      <p className="font-semibold text-foreground">
                        {aggregateOrders(pendingOrders).find(p => p.productKey === selectedProduct)?.totalQuantity || 0} MT
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Shortage:</span>
                      <p className={`font-semibold ${(aggregateOrders(pendingOrders).find(p => p.productKey === selectedProduct)?.shortage || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(aggregateOrders(pendingOrders).find(p => p.productKey === selectedProduct)?.shortage || 0) > 0 
                          ? aggregateOrders(pendingOrders).find(p => p.productKey === selectedProduct)?.shortage
                          : '-'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Tank Size</label>
                      <select
                        value={formData.tankSize}
                        onChange={(e) => setFormData({ ...formData, tankSize: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      >
                        <option value="5">5 MT each</option>
                        <option value="10">10 MT each</option>
                        <option value="15">15 MT each</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Total Lots <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.lots}
                        onChange={(e) => setFormData({ ...formData, lots: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                        placeholder="200"
                      />
                    </div>
                  </div>

                  {/* Remarks */}
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
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDispatchForm(false);
                    setSelectedProduct('');
                    setFormData({
                      tankSize: '5',
                      lots: '',
                      remarks: '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleDispatchSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || !formData.lots}
                >
                  Process Dispatch
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OrderDispatchPlanning;

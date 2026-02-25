'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Fragment } from 'react';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 

  getDispatchOrders,
  saveDispatchOrder,
  getProductStock,
  initializeDefaultStocks,
  type DispatchOrder 
} from '@/lib/workflow-storage';

// Normalize product key
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const normalizeProductKey = (productName: string): string => {
  return productName.toUpperCase().replace(/\s+/g, ' ').trim();
};

// Start of Helper Functions
const categorizeOilType = (productName: string): string => {
  const upperName = productName.toUpperCase();
  if (upperName.includes('RBO') || upperName.includes('RICE')) return 'Rice Bran Oil';
  if (upperName.includes('SBO') || upperName.includes('SOYBEAN')) return 'Soybean Oil';
  if (upperName.includes('PALM') || upperName.includes('PALMOLEIN')) return 'Palm Oil';
  if (upperName.includes('MUSTARD') || upperName.includes('KACHI GHANI')) return 'Mustard Oil';
  if (upperName.includes('SUN') || upperName.includes('SUNFLOWER')) return 'Sunflower Oil';
  if (upperName.includes('COTTON')) return 'Cottonseed Oil';
  if (upperName.includes('GROUNDNUT')) return 'Groundnut Oil';
  return 'Other';
};

interface ExtendedDispatchOrder extends DispatchOrder {
  packingWeight?: number;
  totalWeightKg?: number;
}

interface AggregatedDispatch {
  productKey: string;
  productName: string;
  totalQuantity: number;
  totalWeightKg: number;
  availableStock: number;
  shortage: number;
  shortageKg: number;
  tankSize: string;
  totalLots: number;
  status: string;
  orders: ExtendedDispatchOrder[];
  oilType: string;
}

interface OilTypeGroup {
  oilType: string;
  totalQuantity: number;
  totalWeightKg: number;
  products: AggregatedDispatch[];
  isExpanded: boolean;
  shortage: number;
  shortageKg: number;
}
// End of Helper Functions

const OrderDispatchPlanning = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [orders, setOrders] = useState<ExtendedDispatchOrder[]>([]); // All orders
  const [loading, setLoading] = useState(true);
  
  // State for expanded/collapsed sections
  const [expandedOilTypes, setExpandedOilTypes] = useState<string[]>([]);
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
    
    // Fetch data from backend API
    const fetchDispatchOrders = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/dispatch-planning/pending`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch dispatch orders');
        }
        
        const result = await response.json();
        
        // Handle new API response format with data wrapper
        const data = result.data || result;
        
        // Transform backend data to match component format
        const transformedOrders: ExtendedDispatchOrder[] = data.map((item: any) => {
          const qty = parseFloat(item.quantity || '0');
          const packingWeight = parseFloat(item.packingWeight || '0');
          
          return {
            id: item.id, // now maps to so_no from backend
            productName: item.productName || 'Unknown Product',
            totalQuantity: qty,
            packingWeight: packingWeight,
            totalWeightKg: qty * packingWeight,
            tankSize: '5 MT each', // Default tank size
            totalLots: Math.ceil(qty / 5),
            status: 'Planned',
            createdAt: item.planned3 || new Date().toISOString(),
            orderNo: item.orderNo,
            customerName: item.customerName || 'Unknown Party',
            deliveryDate: item.deliveryDate,
          };
        });
        
        setOrders(transformedOrders);
      } catch (error) {
        console.error('Error fetching dispatch orders:', error);
        // Fallback to localStorage if API fails
        const savedOrders = getDispatchOrders();
        if (savedOrders.length > 0) {
          setOrders(savedOrders);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchDispatchOrders();
  }, []);

  // Aggregate orders by product
  const aggregateOrders = (ordersList: ExtendedDispatchOrder[]): AggregatedDispatch[] => {
    const aggregated: { [key: string]: AggregatedDispatch } = {};

    ordersList.forEach(order => {
      const productKey = normalizeProductKey(order.productName);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: order.productName,
          totalQuantity: 0,
          totalWeightKg: 0,
          availableStock: stock,
          shortage: 0,
          shortageKg: 0,
          tankSize: order.tankSize || '5 MT each',
          totalLots: 0,
          status: order.status,
          orders: [],
          oilType: categorizeOilType(order.productName),
        };
      }

      aggregated[productKey].totalQuantity += order.totalQuantity || 0;
      aggregated[productKey].totalWeightKg += order.totalWeightKg || 0;
      aggregated[productKey].totalLots += order.totalLots || 0;
      aggregated[productKey].orders.push(order);
    });

    // Calculate shortage
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalQuantity - agg.availableStock);
      // Assuming availableStock is in the same units as totalQuantity.
      // If availableStock is 0 (Under Construction), shortageKg will be totalWeightKg.
      // For now, let's calculate shortage proportionately if stock > 0.
      if (agg.totalQuantity > 0) {
        const ratio = agg.shortage / agg.totalQuantity;
        agg.shortageKg = agg.totalWeightKg * ratio;
      } else {
        agg.shortageKg = 0;
      }
    });

    return Object.values(aggregated);
  };

  const groupOrdersByOilType = (aggregatedList: AggregatedDispatch[]): OilTypeGroup[] => {
    const groups: { [key: string]: OilTypeGroup } = {};

    aggregatedList.forEach(agg => {
      const type = agg.oilType;
      if (!groups[type]) {
        groups[type] = {
          oilType: type,
          totalQuantity: 0,
          totalWeightKg: 0,
          products: [],
          isExpanded: false,
          shortage: 0,
          shortageKg: 0
        };
      }
      groups[type].totalQuantity += agg.totalQuantity;
      groups[type].totalWeightKg += agg.totalWeightKg;
      groups[type].shortage += agg.shortage;
      groups[type].shortageKg += agg.shortageKg;
      groups[type].products.push(agg);
    });

    return Object.values(groups).sort((a, b) => b.totalQuantity - a.totalQuantity);
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

  // Toggle Oil Type Expansion
  const toggleOilType = (type: string) => {
    setExpandedOilTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const pendingOrders = orders.filter(o => o.status === 'Planned');
  const historyOrders = orders.filter(o => o.status !== 'Planned');

  const displayOrders = activeTab === 'pending' ? pendingOrders : historyOrders;
  const aggregatedOrders = aggregateOrders(displayOrders);
  const groupedOrders = groupOrdersByOilType(aggregatedOrders);

  const uniqueProducts = aggregateOrders(pendingOrders).map(a => ({
    key: a.productKey,
    name: a.productName
  }));

  // Helper to format number
  const formatNumber = (num: number) => {
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

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
      </div>

      {/* Grouped Dispatch Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-10"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name / Oil Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Qty (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                  Available Stock
                  <span className="ml-2 text-xs font-normal text-muted-foreground italic">(Under Construction)</span>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Shortage (Kg)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={6} rows={5} />
            ) : (
              <tbody className="divide-y divide-border">
                {groupedOrders.map((group) => {
                  const isGroupExpanded = expandedOilTypes.includes(group.oilType);

                  return (
                    <Fragment key={group.oilType}>
                      {/* Level 1: Oil Type Group Header */}
                      <tr 
                        className="bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border/50"
                        onClick={() => toggleOilType(group.oilType)}
                      >
                        <td className="px-4 py-3 text-sm">
                          {isGroupExpanded ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-primary" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-lg font-bold text-primary">
                          {group.oilType} 
                          <span className="text-sm font-medium text-muted-foreground ml-2">
                             ({group.products.length} Products)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-base text-foreground font-bold">
                          {formatNumber(group.totalWeightKg)}
                        </td>
                        <td className="px-4 py-3 text-base text-foreground">
                          -
                        </td>
                        <td className={`px-4 py-3 text-base font-bold ${group.shortageKg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                           {group.shortageKg > 0 ? formatNumber(group.shortageKg) : '-'}
                        </td>
                        <td className="px-4 py-3 text-base">
                          <Badge variant="outline">{activeTab === 'pending' ? 'Pending' : 'History'}</Badge>
                        </td>
                      </tr>

                      {/* Level 2: Products within Oil Type */}
                      {isGroupExpanded && group.products.map((aggregate) => {
                        const isProductExpanded = expandedProduct === aggregate.productKey;
                        
                        return (
                          <Fragment key={aggregate.productKey}>
                            <tr 
                              className="hover:bg-card/50 transition-colors cursor-pointer bg-card/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedProduct(isProductExpanded ? null : aggregate.productKey);
                              }}
                            >
                              <td className="px-4 py-3 text-sm pl-8"> {/* Indented arrow */}
                                {isProductExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground font-medium pl-8"> {/* Indented name */}
                                {aggregate.productName}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground font-semibold">
                                {formatNumber(aggregate.totalWeightKg)}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground">
                                {aggregate.availableStock}
                              </td>
                              <td className={`px-4 py-3 text-sm font-semibold ${aggregate.shortageKg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {aggregate.shortageKg > 0 ? formatNumber(aggregate.shortageKg) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                              </td>
                            </tr>
                            
                            {/* Level 3: Individual Orders (Details) */}
                            {isProductExpanded && aggregate.orders.length > 0 && (
                              <tr key={`${aggregate.productKey}-details`}>
                                <td colSpan={8} className="px-4 py-2 bg-card/30">
                                  <div className="pl-16"> {/* More indentation for details */}
                                    <h4 className="font-semibold text-sm mb-2 text-foreground">
                                      Dispatch Details: ({aggregate.orders.length} {aggregate.orders.length === 1 ? 'order' : 'orders'})
                                    </h4>
                                    <table className="w-full bg-background/50 rounded-lg overflow-hidden border border-border/50">
                                      <thead className="bg-background">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Timestamp</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Order ID</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Party Name</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Product</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Quantity</th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Total Weight (Kg)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/50">
                                        {aggregate.orders.map((order, idx) => (
                                          <tr key={idx} className="hover:bg-background/70 transition-colors">
                                            <td className="px-3 py-2 text-xs text-muted-foreground">
                                              {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-foreground font-medium">{order.id}</td>
                                            <td className="px-3 py-2 text-sm text-foreground">{order.customerName || 'Unknown Party'}</td>
                                            <td className="px-3 py-2 text-sm text-foreground">{order.productName}</td>
                                            <td className="px-3 py-2 text-sm text-foreground">{order.totalQuantity || 0}</td>
                                            <td className="px-3 py-2 text-sm text-foreground">{formatNumber(order.totalWeightKg || 0)}</td>
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
              </tbody>
            )}
          </table>
        </div>
        {!loading && groupedOrders.length === 0 && (
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

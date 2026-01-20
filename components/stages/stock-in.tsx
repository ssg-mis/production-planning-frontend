'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getStockIn,
  type StockInItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedStock {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalFinishedQty: number;
  totalAcceptedQty: number;
  status: string;
  stockItems: StockInItem[];
  partyDetails: Array<{
    orderRef: string;
    partyName: string;
    quantity: number;
    packingType: string;
  }>;
}

const StockIn = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [stockItems, setStockItems] = useState<StockInItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [acceptQty, setAcceptQty] = useState<string>('');

  useEffect(() => {
    const items = getStockIn();
    setStockItems(items);
  }, []);

  // Aggregate stock items by product
  const aggregateStock = (items: StockInItem[]): AggregatedStock[] => {
    const aggregated: { [key: string]: AggregatedStock } = {};

    items.forEach(item => {
      const productKey = normalizeProductKey(item.productName, item.packingSize);
      
      if (!aggregated[productKey]) {
        aggregated[productKey] = {
          productKey,
          productName: item.productName,
          packingSize: item.packingSize,
          totalFinishedQty: 0,
          totalAcceptedQty: 0,
          status: item.status,
          stockItems: [],
          partyDetails: []
        };
      }

      aggregated[productKey].totalFinishedQty += item.finishedQty;
      aggregated[productKey].totalAcceptedQty += item.acceptedQty;
      aggregated[productKey].stockItems.push(item);

      // Add party details if available
      if (item.orderRef && item.partyName) {
        // Check if this party is already added
        const exists = aggregated[productKey].partyDetails.find(
          p => p.orderRef === item.orderRef && p.partyName === item.partyName
        );
        if (!exists) {
          aggregated[productKey].partyDetails.push({
            orderRef: item.orderRef,
            partyName: item.partyName,
            quantity: item.finishedQty,
            packingType: item.packingType || '-'
          });
        }
      }
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAcceptSubmit = () => {
    if (!selectedProduct || !acceptQty) {
      alert('Please select a product and enter accepted quantity');
      return;
    }

    // TODO: Implement accept submission logic
    alert('Stock acceptance will be implemented');
    
    setShowAcceptForm(false);
    setSelectedProduct('');
    setAcceptQty('');
  };

  const pendingStock = stockItems.filter((s) => s.status === 'Pending');
  const historyStock = stockItems.filter((s) => s.status !== 'Pending');
  const displayStock = activeTab === 'pending' ? pendingStock : historyStock;
  const aggregatedStock = aggregateStock(displayStock);

  const uniqueProducts = aggregateStock(pendingStock).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Stock In (Packing Head)"
        description="Accept finished goods to stock"
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

        {activeTab === 'pending' && pendingStock.length > 0 && (
          <Button 
            onClick={() => setShowAcceptForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Accept Stock
          </Button>
        )}
      </div>

      {/* Aggregated Stock Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Finished Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Accepted Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Party Orders</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedStock.map((aggregate) => {
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
                        {aggregate.totalFinishedQty}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">
                        {aggregate.totalAcceptedQty || '-'}
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
                        <td colSpan={6} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            {aggregate.partyDetails && aggregate.partyDetails.length > 0 ? (
                              <>
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
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground">No party details available</p>
                            )}
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
        {aggregatedStock.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} stock items
          </div>
        )}
      </Card>

      {/* Accept Stock Form Modal */}
      {showAcceptForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Accept Stock</h2>
              
              {/* Product Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="">-- Select Product --</option>
                  {uniqueProducts.map(product => (
                    <option key={product.key} value={product.key}>{product.name}</option>
                  ))}
                </select>
              </div>

              {/* Accept Quantity Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Accepted Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={acceptQty}
                  onChange={(e) => setAcceptQty(e.target.value)}
                  placeholder="Enter accepted quantity"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAcceptForm(false);
                    setSelectedProduct('');
                    setAcceptQty('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAcceptSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || !acceptQty}
                >
                  Accept to Stock
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StockIn;

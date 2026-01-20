'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getBalanceReceipts,
  type BalanceMaterialReceiptItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedBalance {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalVarianceQty: number;
  totalReceivedQty: number;
  status: string;
  balanceItems: BalanceMaterialReceiptItem[];
  partyDetails: Array<{
    orderRef: string;
    partyName: string;
    quantity: number;
    packingType: string;
  }>;
}

const BalanceMaterialReceipt = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [balanceItems, setBalanceItems] = useState<BalanceMaterialReceiptItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [receiptQuantity, setReceiptQuantity] = useState<string>('');

  useEffect(() => {
    const items = getBalanceReceipts();
    setBalanceItems(items);
  }, []);

  // Aggregate balance items by product
  const aggregateBalances = (items: BalanceMaterialReceiptItem[]): AggregatedBalance[] => {
    const aggregated: { [key: string]: AggregatedBalance } = {};

    items.forEach(item => {
      const productKey = normalizeProductKey(item.productName, item.packingSize);
      
      if (!aggregated[productKey]) {
        aggregated[productKey] = {
          productKey,
          productName: item.productName,
          packingSize: item.packingSize,
          totalVarianceQty: 0,
          totalReceivedQty: 0,
          status: item.status,
          balanceItems: [],
          partyDetails: []
        };
      }

      aggregated[productKey].totalVarianceQty += item.varianceQty;
      aggregated[productKey].totalReceivedQty += item.receivedQty;
      aggregated[productKey].balanceItems.push(item);

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
            quantity: item.varianceQty,
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
      case 'received':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleReceiptSubmit = () => {
    if (!selectedProduct || !receiptQuantity) {
      alert('Please select a product and enter received quantity');
      return;
    }

    // TODO: Implement receipt submission logic
    alert('Balance receipt submission will be implemented');
    
    setShowReceiptForm(false);
    setSelectedProduct('');
    setReceiptQuantity('');
  };

  const pendingBalances = balanceItems.filter((b) => b.status === 'Pending');
  const historyBalances = balanceItems.filter((b) => b.status !== 'Pending');
  const displayBalances = activeTab === 'pending' ? pendingBalances : historyBalances;
  const aggregatedBalances = aggregateBalances(displayBalances);

  const uniqueProducts = aggregateBalances(pendingBalances).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Balance Material Receipt"
        description="Record receipt of leftover/balance materials from production"
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

        {activeTab === 'pending' && pendingBalances.length > 0 && (
          <Button 
            onClick={() => setShowReceiptForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Balance Receipt
          </Button>
        )}
      </div>

      {/* Aggregated Balance Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Variance Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Received Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Party Orders</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedBalances.map((aggregate) => {
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
                        {aggregate.totalVarianceQty}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">
                        {aggregate.totalReceivedQty || '-'}
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
        {aggregatedBalances.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} balance material receipts
          </div>
        )}
      </Card>

      {/* Process Balance Receipt Form Modal */}
      {showReceiptForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Balance Receipt</h2>
              
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

              {/* Received Quantity Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Received Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={receiptQuantity}
                  onChange={(e) => setReceiptQuantity(e.target.value)}
                  placeholder="Enter received quantity"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReceiptForm(false);
                    setSelectedProduct('');
                    setReceiptQuantity('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleReceiptSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || !receiptQuantity}
                >
                  Receive Balance Materials
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BalanceMaterialReceipt;

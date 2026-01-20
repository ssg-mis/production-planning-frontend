'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getRawMaterialReceipts,
  moveToProductionEntry,
  getProductStock,
  initializeDefaultStocks,
  type RawMaterialReceiptItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string): string => {
  return productName.toUpperCase().replace(/\s+/g, ' ').trim();
};

interface AggregatedReceipt {
  productKey: string;
  productName: string;
  totalIssuedQty: number;
  totalReceivedQty: number;
  availableStock: number;
  shortage: number;
  status: string;
  receipts: RawMaterialReceiptItem[];
  bomItems: Array<{
    bomItem: string;
    issuedQty: number;
    receivedQty: number;
  }>;
}

const RawMaterialReceipt = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [receipts, setReceipts] = useState<RawMaterialReceiptItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    initializeDefaultStocks();
    const savedReceipts = getRawMaterialReceipts();
    setReceipts(savedReceipts);
  }, []);

  // Aggregate receipts by product
  const aggregateReceipts = (receiptsList: RawMaterialReceiptItem[]): AggregatedReceipt[] => {
    const aggregated: { [key: string]: AggregatedReceipt } = {};

    receiptsList.forEach(receipt => {
      const productKey = normalizeProductKey(receipt.productName);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: receipt.productName,
          totalIssuedQty: 0,
          totalReceivedQty: 0,
          availableStock: stock,
          shortage: 0,
          status: receipt.status,
          receipts: [],
          bomItems: []
        };
      }

      aggregated[productKey].totalIssuedQty += receipt.issuedQty;
      aggregated[productKey].totalReceivedQty += receipt.receivedQty;
      aggregated[productKey].receipts.push(receipt);

      // Consolidate BOM items
      const existingBom = aggregated[productKey].bomItems.find(b => b.bomItem === receipt.bomItem);
      if (existingBom) {
        existingBom.issuedQty += receipt.issuedQty;
        existingBom.receivedQty += receipt.receivedQty;
      } else {
        aggregated[productKey].bomItems.push({
          bomItem: receipt.bomItem,
          issuedQty: receipt.issuedQty,
          receivedQty: receipt.receivedQty
        });
      }
    });

    // Calculate shortage
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalIssuedQty - agg.availableStock);
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
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    // Get all receipts for the selected product
    const selectedReceipts = receipts.filter(receipt => 
      normalizeProductKey(receipt.productName) === selectedProduct
    );

    // Process each receipt - mark as received and move to Production Entry
    selectedReceipts.forEach(receipt => {
      const updatedReceipt: RawMaterialReceiptItem = {
        ...receipt,
        receivedQty: receipt.issuedQty,
        status: 'Received',
      };
      moveToProductionEntry(updatedReceipt);
    });

    // Update local state to remove processed items
    const remainingReceipts = receipts.filter(receipt => 
      normalizeProductKey(receipt.productName) !== selectedProduct
    );
    setReceipts(remainingReceipts);

    // Reset form
    setShowReceiptForm(false);
    setSelectedProduct('');
  };

  const pendingReceipts = receipts.filter((r) => r.status === 'Pending');
  const historyReceipts = receipts.filter((r) => r.status !== 'Pending');
  const displayReceipts = activeTab === 'pending' ? pendingReceipts : historyReceipts;
  const aggregatedReceipts = aggregateReceipts(displayReceipts);

  const uniqueProducts = aggregateReceipts(pendingReceipts).map(a => ({
    key: a.productKey,
    name: a.productName
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Raw Material Receipt"
        description="Record receipt of raw materials in production"
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

        {activeTab === 'pending' && pendingReceipts.length > 0 && (
          <Button 
            onClick={() => setShowReceiptForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Material Receipt
          </Button>
        )}
      </div>

      {/* Aggregated Receipts Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Issued Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Received Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">BOM Items</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedReceipts.map((aggregate) => {
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
                        {aggregate.totalIssuedQty}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">
                        {aggregate.totalReceivedQty || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {aggregate.availableStock}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {aggregate.bomItems.length} items
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                      </td>
                    </tr>
                    
                    {/* Expanded BOM Details */}
                    {isExpanded && aggregate.bomItems.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">
                              BOM Items Receipt: ({aggregate.bomItems.length} materials)
                            </h4>
                            <table className="w-full bg-background/50 rounded-lg overflow-hidden">
                              <thead className="bg-background">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">BOM Item</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Issued Qty</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Received Qty</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pending</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.bomItems.map((bom, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{bom.bomItem}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{bom.issuedQty}</td>
                                    <td className="px-3 py-2 text-sm text-green-600 font-medium">{bom.receivedQty || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-orange-600 font-medium">
                                      {bom.issuedQty - bom.receivedQty}
                                    </td>
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
        {aggregatedReceipts.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} receipts
          </div>
        )}
      </Card>

      {/* Process Material Receipt Form Modal */}
      {showReceiptForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Material Receipt</h2>
              
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

              {selectedProduct && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-card rounded-lg border border-border">
                    <div>
                      <span className="text-xs text-muted-foreground">Total Issued Qty:</span>
                      <p className="font-semibold text-foreground text-lg">
                        {aggregateReceipts(pendingReceipts).find(p => p.productKey === selectedProduct)?.totalIssuedQty || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Received Qty:</span>
                      <p className="font-semibold text-green-600 text-lg">
                        {aggregateReceipts(pendingReceipts).find(p => p.productKey === selectedProduct)?.totalReceivedQty || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Pending:</span>
                      <p className="font-semibold text-orange-600 text-lg">
                        {(aggregateReceipts(pendingReceipts).find(p => p.productKey === selectedProduct)?.totalIssuedQty || 0) -
                         (aggregateReceipts(pendingReceipts).find(p => p.productKey === selectedProduct)?.totalReceivedQty || 0)}
                      </p>
                    </div>
                  </div>

                  {/* BOM Items to Receive */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-foreground mb-3">BOM Items to Receive</h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-card border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">BOM Item</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Issued Qty</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Qty to Receive</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {aggregateReceipts(pendingReceipts)
                            .find(p => p.productKey === selectedProduct)
                            ?.bomItems.map((bom, idx) => (
                              <tr key={idx} className="hover:bg-card/50">
                                <td className="px-4 py-3 text-foreground font-medium">{bom.bomItem}</td>
                                <td className="px-4 py-3 text-foreground">{bom.issuedQty}</td>
                                <td className="px-4 py-3 text-primary font-medium">{bom.issuedQty}</td>
                              </tr>
                            ))}
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
                    setShowReceiptForm(false);
                    setSelectedProduct('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleReceiptSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct}
                >
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

export default RawMaterialReceipt;

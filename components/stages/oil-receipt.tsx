'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getOilReceipts,
  moveToRawMaterialIndent,
  getProductStock,
  initializeDefaultStocks,
  type OilReceiptItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedReceipt {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalQuantity: number;
  availableStock: number;
  shortage: number;
  packingType: string;
  status: string;
  items: OilReceiptItem[];
}

const OilReceipt = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [receipts, setReceipts] = useState<OilReceiptItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    receivedQuantity: '',
    receivedBy: '',
    receivedDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  useEffect(() => {
    initializeDefaultStocks();
    const savedReceipts = getOilReceipts();
    setReceipts(savedReceipts);
  }, []);

  // Aggregate receipts by product
  const aggregateReceipts = (receiptsList: OilReceiptItem[]): AggregatedReceipt[] => {
    const aggregated: { [key: string]: AggregatedReceipt } = {};

    receiptsList.forEach(receipt => {
      const productKey = normalizeProductKey(receipt.productName, receipt.packingSize);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: receipt.productName,
          packingSize: receipt.packingSize,
          totalQuantity: 0,
          availableStock: stock,
          shortage: 0,
          packingType: receipt.packingType || '-',
          status: receipt.status,
          items: []
        };
      }

      aggregated[productKey].totalQuantity += receipt.indentQuantity;
      aggregated[productKey].items.push(receipt);
    });

    // Calculate shortage
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalQuantity - agg.availableStock);
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'dispatched':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleProductSelect = (productKey: string) => {
    setSelectedProduct(productKey);
    const aggregated = aggregateReceipts(pendingReceipts);
    const product = aggregated.find(p => p.productKey === productKey);
    
    if (product) {
      setSelectedItems(product.items.map(item => item.id));
      // Auto-fill total quantity
      const totalQty = product.items.reduce((sum, item) => sum + item.indentQuantity, 0);
      setFormData(prev => ({ ...prev, receivedQuantity: totalQty.toString() }));
    }
  };

  const handleItemToggle = (itemId: string) => {
    let newSelected: string[];
    if (selectedItems.includes(itemId)) {
      newSelected = selectedItems.filter(id => id !== itemId);
    } else {
      newSelected = [...selectedItems, itemId];
    }
    setSelectedItems(newSelected);
    
    // Recalculate received quantity
    const aggregated = aggregateReceipts(pendingReceipts);
    const product = aggregated.find(p => p.productKey === selectedProduct);
    if (product) {
      const totalQty = product.items
        .filter(item => newSelected.includes(item.id))
        .reduce((sum, item) => sum + item.indentQuantity, 0);
      setFormData(prev => ({ ...prev, receivedQuantity: totalQty.toString() }));
    }
  };

  const handleReceiptSubmit = () => {
    if (!selectedProduct || selectedItems.length === 0) {
      alert('Please select a product and at least one item');
      return;
    }

    if (!formData.receivedBy) {
      alert('Please fill in received by field');
      return;
    }

    // Update selected items with receipt data
    const updatedReceipts = receipts.map(r => {
      if (selectedItems.includes(r.id)) {
        return {
          ...r,
          receivedQty: Number(formData.receivedQuantity),
          receivedBy: formData.receivedBy,
          receivedDate: formData.receivedDate,
          remarks: formData.remarks,
          status: 'Received' as any,
        };
      }
      return r;
    });

    // Move each selected item to Raw Material Indent (this also removes them from oil_receipts)
    updatedReceipts.forEach(r => {
      if (selectedItems.includes(r.id)) {
        moveToRawMaterialIndent(r);
      }
    });
    
    // Update local state to remove processed items
    const remainingReceipts = updatedReceipts.filter(r => !selectedItems.includes(r.id));
    setReceipts(remainingReceipts);

    // Reset form
    setShowForm(false);
    setSelectedProduct('');
    setSelectedItems([]);
    setFormData({
      receivedQuantity: '',
      receivedBy: '',
      receivedDate: new Date().toISOString().split('T')[0],
      remarks: '',
    });
  };

  const pendingReceipts = receipts.filter((r) => r.status !== 'Received');
  const historyReceipts = receipts.filter((r) => r.status === 'Received');

  const displayReceipts = activeTab === 'pending' ? pendingReceipts : historyReceipts;
  const aggregatedReceipts = aggregateReceipts(displayReceipts);

  const uniqueProducts = aggregateReceipts(pendingReceipts).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Oil Received (Packing Section)"
        description="Packaging head receives oil from plant person and confirms received quantity"
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
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Oil Receipt
          </Button>
        )}
      </div>

      {/* Aggregated Receipt Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Total Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Shortage</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Packing Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedReceipts.map((aggregate) => {
                const isExpanded = expandedProduct === aggregate.productKey;
                const displayName = `${aggregate.productName}${aggregate.packingSize ? ' ' + aggregate.packingSize : ''}`;
                
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
                        {displayName}
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
                        {aggregate.packingType}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                      </td>
                    </tr>
                    
                    {/* Expanded Details */}
                    {isExpanded && aggregate.items.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">
                              Order Details: ({aggregate.items.length} {aggregate.items.length === 1 ? 'order' : 'orders'})
                            </h4>
                            <table className="w-full bg-background/50 rounded-lg overflow-hidden">
                              <thead className="bg-background">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Order Ref</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Party Name</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Quantity</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Oil Type</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{item.orderRef}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{item.partyName || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{item.indentQuantity}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{item.selectedOil}</td>
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

      {/* Oil Receipt Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Oil Receipt</h2>
              
              {/* Product Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => handleProductSelect(e.target.value)}
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
                  {/* Order Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-3">
                      Select Orders to Process
                    </label>
                    <div className="border border-border rounded-lg p-4 bg-card max-h-40 overflow-y-auto">
                      {aggregateReceipts(pendingReceipts)
                        .find(p => p.productKey === selectedProduct)
                        ?.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 hover:bg-background/50 px-2 rounded">
                            <label className="flex items-center gap-3 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => handleItemToggle(item.id)}
                                className="w-4 h-4 rounded border-border"
                              />
                              <span className="text-sm font-medium text-foreground">
                                {item.orderRef} - {item.partyName || 'Unknown Party'}
                              </span>
                            </label>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>Qty: {item.indentQuantity}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Form Fields Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Received Quantity (MT)</label>
                      <input
                        type="number"
                        value={formData.receivedQuantity}
                        onChange={(e) => setFormData({ ...formData, receivedQuantity: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Received By <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.receivedBy}
                        onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                        placeholder="Name of Receiver"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Received Date</label>
                      <input
                        type="date"
                        value={formData.receivedDate}
                        onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
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
                    setShowForm(false);
                    setSelectedProduct('');
                    setSelectedItems([]);
                    setFormData({
                      receivedQuantity: '',
                      receivedBy: '',
                      receivedDate: new Date().toISOString().split('T')[0],
                      remarks: '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleReceiptSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || selectedItems.length === 0 || !formData.receivedBy}
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

export default OilReceipt;

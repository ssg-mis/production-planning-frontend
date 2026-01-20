'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getOilApprovals, 
  moveToLabConfirmation, 
  getProductStock,
  initializeDefaultStocks,
  type OilApprovalItem 
} from '@/lib/workflow-storage';

// Normalize product key for matching
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedApproval {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalQuantity: number;
  availableStock: number;
  shortage: number;
  packingType: string;
  status: string;
  items: OilApprovalItem[];
}

const OilIndentApproval = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [approvals, setApprovals] = useState<OilApprovalItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    action: 'approve',
    remarks: '',
  });

  useEffect(() => {
    initializeDefaultStocks();
    const savedApprovals = getOilApprovals();
    setApprovals(savedApprovals);
  }, []);

  // Aggregate approvals by product
  const aggregateApprovals = (approvalsList: OilApprovalItem[]): AggregatedApproval[] => {
    const aggregated: { [key: string]: AggregatedApproval } = {};

    approvalsList.forEach(approval => {
      const productKey = normalizeProductKey(approval.productName, approval.packingSize);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: approval.productName,
          packingSize: approval.packingSize,
          totalQuantity: 0,
          availableStock: stock,
          shortage: 0,
          packingType: approval.packingType || '-',
          status: approval.status,
          items: []
        };
      }

      aggregated[productKey].totalQuantity += approval.indentQuantity;
      aggregated[productKey].items.push(approval);
    });

    // Calculate shortage for each product
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalQuantity - agg.availableStock);
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleApprovalSubmit = () => {
    if (!selectedProduct || selectedItems.length === 0) {
      alert('Please select a product and at least one item');
      return;
    }

    if (formData.action === 'approve') {
      // Update selected items with approval data and edited quantities
      const updatedApprovals = approvals.map(a => {
        if (selectedItems.includes(a.id)) {
          return { 
            ...a, 
            indentQuantity: editedQuantities[a.id] || a.indentQuantity,
            status: 'Confirmed' as any, 
            approvalDate: new Date().toISOString(),
            remarks: formData.remarks 
          };
        }
        return a;
      });

      // Move each selected item to Lab Confirmation (this also removes them from oil_approvals)
      updatedApprovals.forEach(a => {
        if (selectedItems.includes(a.id)) {
          moveToLabConfirmation(a);
        }
      });
      
      // Update local state to remove processed items
      const remainingApprovals = updatedApprovals.filter(a => !selectedItems.includes(a.id));
      setApprovals(remainingApprovals);
    } else {
      // Reject items - update status
      const updatedApprovals = approvals.map((a) => 
        selectedItems.includes(a.id) ? { ...a, status: 'Rejected' as any, remarks: formData.remarks } : a
      );
      setApprovals(updatedApprovals);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('oil_approvals', JSON.stringify(updatedApprovals));
      }
    }

    // Reset form
    setShowApprovalForm(false);
    setSelectedProduct('');
    setSelectedItems([]);
    setEditedQuantities({});
    setFormData({ action: 'approve', remarks: '' });
  };

  const handleProductSelect = (productKey: string) => {
    setSelectedProduct(productKey);
    const aggregated = aggregateApprovals(pendingApprovals);
    const product = aggregated.find(p => p.productKey === productKey);
    
    if (product) {
      // Select all items for this product by default
      setSelectedItems(product.items.map(item => item.id));
      
      // Initialize edited quantities with current values
      const quantities: Record<string, number> = {};
      product.items.forEach(item => {
        quantities[item.id] = item.indentQuantity;
      });
      setEditedQuantities(quantities);
    }
  };

  const handleItemToggle = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'Approved');
  const historyApprovals = approvals.filter((a) => a.status !== 'Approved');
  
  const displayApprovals = activeTab === 'pending' ? pendingApprovals : historyApprovals;
  const aggregatedApprovals = aggregateApprovals(displayApprovals);

  const uniqueProducts = aggregateApprovals(pendingApprovals).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Oil Indent Approval"
        description="Review and approve oil indents from packing department"
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

        {activeTab === 'pending' && pendingApprovals.length > 0 && (
          <Button 
            onClick={() => setShowApprovalForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Indent Approval
          </Button>
        )}
      </div>

      {/* Aggregated Approval Table */}
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
              {aggregatedApprovals.map((aggregate) => {
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
        {aggregatedApprovals.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} approvals
          </div>
        )}
      </Card>

      {/* Approval Form Modal */}
      {showApprovalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Indent Approval</h2>
              
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

              {/* Order Selection */}
              {selectedProduct && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-3">
                      Select Orders to Process
                    </label>
                    
                    {/* Stock Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-3 p-3 bg-card rounded-lg border border-border">
                      <div>
                        <span className="text-xs text-muted-foreground">Available Stock:</span>
                        <p className="font-semibold text-foreground">{getProductStock(selectedProduct)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Total Indent:</span>
                        <p className="font-semibold text-foreground">
                          {selectedItems.reduce((sum, itemId) => sum + (editedQuantities[itemId] || 0), 0)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Shortage:</span>
                        <p className={`font-semibold ${
                          Math.max(0, selectedItems.reduce((sum, itemId) => sum + (editedQuantities[itemId] || 0), 0) - getProductStock(selectedProduct)) > 0 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          {Math.max(0, selectedItems.reduce((sum, itemId) => sum + (editedQuantities[itemId] || 0), 0) - getProductStock(selectedProduct)) > 0
                            ? Math.max(0, selectedItems.reduce((sum, itemId) => sum + (editedQuantities[itemId] || 0), 0) - getProductStock(selectedProduct))
                            : '-'
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-card border-b border-border">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Select</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Party Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Quantity (Editable)</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Packing Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {aggregateApprovals(pendingApprovals)
                            .find(p => p.productKey === selectedProduct)
                            ?.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-background/50">
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.includes(item.id)}
                                    onChange={() => handleItemToggle(item.id)}
                                    className="w-4 h-4 rounded border-border"
                                  />
                                </td>
                                <td className="px-3 py-2 text-sm font-medium text-foreground">
                                  {item.orderRef} - {item.partyName || 'Unknown Party'}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={editedQuantities[item.id] || item.indentQuantity}
                                    onChange={(e) => {
                                      const newQty = Number(e.target.value);
                                      setEditedQuantities(prev => ({
                                        ...prev,
                                        [item.id]: newQty
                                      }));
                                    }}
                                    className="w-24 px-2 py-1 border border-border rounded bg-background text-foreground text-sm font-semibold"
                                    min="0"
                                  />
                                </td>
                                <td className="px-3 py-2 text-sm text-muted-foreground">
                                  {item.selectedOil}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedItems.length} order(s) selected
                    </p>
                  </div>

                  {/* Action Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">Action</label>
                    <select
                      value={formData.action}
                      onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    >
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                    </select>
                  </div>

                  {/* Remarks */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                    <textarea
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Add approval or rejection remarks"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground h-24"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApprovalForm(false);
                    setSelectedProduct('');
                    setSelectedItems([]);
                    setEditedQuantities({});
                    setFormData({ action: 'approve', remarks: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleApprovalSubmit}
                  className={formData.action === 'approve' ? 'bg-primary hover:bg-primary/90' : 'bg-red-600 hover:bg-red-700'}
                  disabled={!selectedProduct || selectedItems.length === 0}
                >
                  {formData.action === 'approve' ? 'Approve & Send to Lab' : 'Reject Selected'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OilIndentApproval;

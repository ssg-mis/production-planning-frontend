'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getLabConfirmations, 
  moveToDispatchPlanning,
  getProductStock,
  initializeDefaultStocks,
  type LabConfirmationItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedConfirmation {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalQuantity: number;
  availableStock: number;
  shortage: number;
  packingType: string;
  status: string;
  items: LabConfirmationItem[];
}

const LabConfirmation = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [confirmations, setConfirmations] = useState<LabConfirmationItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    issuedQuantity: '',
    dateOfIssue: new Date().toISOString().split('T')[0],
    issuedBy: '',
    qaStatus: 'Pass' as 'Pass' | 'Fail' | 'Pending',
    certificateFile: '',
    certificateFileName: '',
    remarks: '',
  });

  useEffect(() => {
    initializeDefaultStocks();
    const savedConfirmations = getLabConfirmations();
    setConfirmations(savedConfirmations);
  }, []);

  // Aggregate confirmations by product
  const aggregateConfirmations = (confirmationsList: LabConfirmationItem[]): AggregatedConfirmation[] => {
    const aggregated: { [key: string]: AggregatedConfirmation } = {};

    confirmationsList.forEach(confirmation => {
      const productKey = normalizeProductKey(confirmation.productName, confirmation.packingSize);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: confirmation.productName,
          packingSize: confirmation.packingSize,
          totalQuantity: 0,
          availableStock: stock,
          shortage: 0,
          packingType: confirmation.packingType || '-',
          status: confirmation.status,
          items: []
        };
      }

      aggregated[productKey].totalQuantity += confirmation.indentQuantity;
      aggregated[productKey].items.push(confirmation);
    });

    // Calculate shortage
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalQuantity - agg.availableStock);
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'issued':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleProductSelect = (productKey: string) => {
    setSelectedProduct(productKey);
    const aggregated = aggregateConfirmations(pendingConfirmations);
    const product = aggregated.find(p => p.productKey === productKey);
    
    if (product) {
      setSelectedItems(product.items.map(item => item.id));
      // Auto-fill total quantity
      const totalQty = product.items.reduce((sum, item) => sum + item.indentQuantity, 0);
      setFormData(prev => ({ ...prev, issuedQuantity: totalQty.toString() }));
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
    
    // Recalculate issued quantity
    const aggregated = aggregateConfirmations(pendingConfirmations);
    const product = aggregated.find(p => p.productKey === selectedProduct);
    if (product) {
      const totalQty = product.items
        .filter(item => newSelected.includes(item.id))
        .reduce((sum, item) => sum + item.indentQuantity, 0);
      setFormData(prev => ({ ...prev, issuedQuantity: totalQty.toString() }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          certificateFile: reader.result as string,
          certificateFileName: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmSubmit = () => {
    if (!selectedProduct || selectedItems.length === 0) {
      alert('Please select a product and at least one item');
      return;
    }

    if (!formData.issuedBy) {
      alert('Please fill in issued by field');
      return;
    }

    // Update selected items with lab confirmation data and mark as processed
    const updatedConfirmations = confirmations.map(c => {
      if (selectedItems.includes(c.id)) {
        return {
          ...c,
          issuedQuantity: Number(formData.issuedQuantity),
          dateOfIssue: formData.dateOfIssue,
          issuedBy: formData.issuedBy,
          qaStatus: formData.qaStatus,
          certificateFile: formData.certificateFile,
          certificateFileName: formData.certificateFileName,
          remarks: formData.remarks,
          confirmed: true,
          status: 'Processed' as any,
          labDate: new Date().toISOString(),
        };
      }
      return c;
    });

    // Move each selected item to Dispatch Planning (this also removes them from lab_confirmations)
    updatedConfirmations.forEach(c => {
      if (selectedItems.includes(c.id)) {
        moveToDispatchPlanning(c);
      }
    });
    
    // Update local state to remove processed items
    const remainingConfirmations = updatedConfirmations.filter(c => !selectedItems.includes(c.id));
    setConfirmations(remainingConfirmations);

    // Reset form
    setShowForm(false);
    setSelectedProduct('');
    setSelectedItems([]);
    setFormData({
      issuedQuantity: '',
      dateOfIssue: new Date().toISOString().split('T')[0],
      issuedBy: '',
      qaStatus: 'Pass',
      certificateFile: '',
      certificateFileName: '',
      remarks: '',
    });
  };

  const pendingConfirmations = confirmations.filter((c) => c.status === 'Confirmed');
  const historyConfirmations = confirmations.filter((c) => c.status !== 'Confirmed');

  const displayConfirmations = activeTab === 'pending' ? pendingConfirmations : historyConfirmations;
  const aggregatedConfirmations = aggregateConfirmations(displayConfirmations);

  const uniqueProducts = aggregateConfirmations(pendingConfirmations).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Lab Confirmation"
        description="Verify lab parameters and sample results"
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

        {activeTab === 'pending' && pendingConfirmations.length > 0 && (
          <Button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process to Lab Confirmation
          </Button>
        )}
      </div>

      {/* Aggregated Confirmation Table */}
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
              {aggregatedConfirmations.map((aggregate) => {
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
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Sample Result</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.items.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{item.orderRef}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{item.partyName || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{item.indentQuantity}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{item.selectedOil}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{item.sampleResult || 'Pending'}</td>
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
        {aggregatedConfirmations.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} confirmations
          </div>
        )}
      </Card>

      {/* Lab Confirmation Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Quality Approval & Oil Issue</h2>
              
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
                      {aggregateConfirmations(pendingConfirmations)
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
                      <label className="block text-sm font-medium text-foreground mb-2">Issued Quantity (MT)</label>
                      <input
                        type="number"
                        value={formData.issuedQuantity}
                        onChange={(e) => setFormData({ ...formData, issuedQuantity: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Date of Issue</label>
                      <input
                        type="date"
                        value={formData.dateOfIssue}
                        onChange={(e) => setFormData({ ...formData, dateOfIssue: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Issued By <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.issuedBy}
                        onChange={(e) => setFormData({ ...formData, issuedBy: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                        placeholder="Name of Approver"
                      />
                    </div>
                  </div>

                  {/* Certificate Upload */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">Quality Certificate Upload</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-card">
                      {formData.certificateFileName ? (
                        <div className="space-y-2">
                          <p className="text-sm text-foreground font-medium">{formData.certificateFileName}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData({ ...formData, certificateFile: '', certificateFileName: '' })}
                          >
                            Remove File
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="mb-2">
                            <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">Select Certificate File</p>
                          <p className="text-xs text-muted-foreground mb-3">Upload PDF or image certificate for this batch</p>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="certificate-upload"
                          />
                          <label htmlFor="certificate-upload">
                            <Button variant="outline" size="sm" asChild>
                              <span className="cursor-pointer">Choose File</span>
                            </Button>
                          </label>
                        </>
                      )}
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
                      issuedQuantity: '',
                      dateOfIssue: new Date().toISOString().split('T')[0],
                      issuedBy: '',
                      qaStatus: 'Pass',
                      certificateFile: '',
                      certificateFileName: '',
                      remarks: '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || selectedItems.length === 0 || !formData.issuedBy}
                >
                  Issue Approved Batch
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LabConfirmation;

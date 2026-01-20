'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getOilIndents, 
  saveOilIndent, 
  moveToOilApproval,
  getProductStock,
  initializeDefaultStocks,
  type OilIndentItem,
  type OilIndentWithParties,
  type PartyProductDetail
} from '@/lib/workflow-storage';

// Normalize product key for matching (case-insensitive, remove extra spaces)
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

const OilIndent = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [indents, setIndents] = useState<OilIndentItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showIndentForm, setShowIndentForm] = useState(false);
  const [showAddDataForm, setShowAddDataForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedParties, setSelectedParties] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    selectedOil: '',
    indentQuantity: 0,
  });

  const [addDataForm, setAddDataForm] = useState({
    orderRef: '',
    productName: '',
    packingSize: '',
    packingType: 'Tin',
    partyName: '',
    oilRequired: '',
  });

  // Initialize with 10 default data entries
  const initializeDefaultData = () => {
    const defaultIndents: OilIndentItem[] = [
      {
        id: '1',
        orderRef: 'DP-2026-001',
        productName: 'HK Rice',
        packingSize: '15 kg',
        packingType: 'Tin',
        partyName: 'ABC Party',
        oilRequired: 1000,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '2',
        orderRef: 'DP-2026-002',
        productName: 'HK Rice',
        packingSize: '13 kg',
        packingType: 'Tin',
        partyName: 'ABC Party',
        oilRequired: 1000,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '3',
        orderRef: 'DP-2026-003',
        productName: 'HK Rice',
        packingSize: '1 ltr',
        packingType: 'Box',
        partyName: 'ABC Party',
        oilRequired: 1000,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '4',
        orderRef: 'DP-2026-004',
        productName: 'HK Soya',
        packingSize: '15 kg',
        packingType: 'Tin',
        partyName: 'BCD Party',
        oilRequired: 1000,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '5',
        orderRef: 'DP-2026-005',
        productName: 'HK Rice',
        packingSize: '15 kg',
        packingType: 'Tin',
        partyName: 'BCD Party',
        oilRequired: 1000,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '6',
        orderRef: 'DP-2026-006',
        productName: 'HK Soya',
        packingSize: '15 kg',
        packingType: 'Tin',
        partyName: 'ABC Party',
        oilRequired: 1000,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '7',
        orderRef: 'DP-2026-007',
        productName: 'HK Sunflower',
        packingSize: '1 ltr',
        packingType: 'Pouch',
        partyName: 'XYZ Party',
        oilRequired: 2000,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '8',
        orderRef: 'DP-2026-008',
        productName: 'HK Groundnut',
        packingSize: '15 kg',
        packingType: 'Tin',
        partyName: 'ABC Party',
        oilRequired: 1500,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '9',
        orderRef: 'DP-2026-009',
        productName: 'HK Soya',
        packingSize: '10 kg',
        packingType: 'Tin',
        partyName: 'BCD Party',
        oilRequired: 800,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
      {
        id: '10',
        orderRef: 'DP-2026-010',
        productName: 'HK Rice',
        packingSize: '5 kg',
        packingType: 'Pouch',
        partyName: 'XYZ Party',
        oilRequired: 500,
        selectedOil: '',
        indentQuantity: 0,
        createdAt: new Date().toISOString(),
        status: 'Pending',
      },
    ];
    
    // Clear and reinitialize
    if (typeof window !== 'undefined') {
      localStorage.removeItem('oil_indents');
      defaultIndents.forEach(item => saveOilIndent(item));
    }
    
    return defaultIndents;
  };

  // Load initial data - ALWAYS reinitialize to ensure we have 10 fresh entries
  useEffect(() => {
    // Force reinitialize with 10 default entries
    const defaultIndents = initializeDefaultData();
    setIndents(defaultIndents);
  }, []);

  // Aggregate indents by product locally with normalized keys
  const aggregateIndentsByProduct = (indentsList: OilIndentItem[]): OilIndentWithParties[] => {
    const aggregated: { [key: string]: OilIndentWithParties } = {};

    indentsList.forEach(indent => {
      const normalizedKey = normalizeProductKey(indent.productName, indent.packingSize);
      
      if (!aggregated[normalizedKey]) {
        aggregated[normalizedKey] = {
          id: indent.id,
          orderRef: indent.orderRef,
          productName: indent.productName,
          packingSize: indent.packingSize,
          oilRequired: 0,
          selectedOil: indent.selectedOil,
          indentQuantity: 0,
          createdAt: indent.createdAt,
          status: indent.status,
          parties: [],
          selectedParties: []
        };
      }

      aggregated[normalizedKey].oilRequired += indent.oilRequired;
      aggregated[normalizedKey].indentQuantity += indent.indentQuantity;

      if (indent.partyName) {
        aggregated[normalizedKey].parties.push({
          partyName: indent.partyName,
          productName: indent.productName,
          packingSize: indent.packingSize || '',
          quantity: indent.oilRequired,
          packingType: indent.packingType || ''
        });
        
        if (!aggregated[normalizedKey].selectedParties?.includes(indent.partyName)) {
          aggregated[normalizedKey].selectedParties?.push(indent.partyName);
        }
      }
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddData = () => {
    if (!addDataForm.productName || !addDataForm.partyName || !addDataForm.oilRequired) {
      alert('Please fill in all required fields: Product Name, Party Name, and Oil Required');
      return;
    }

    const newIndent: OilIndentItem = {
      id: Date.now().toString(),
      orderRef: addDataForm.orderRef || `DP-${Date.now()}`,
      productName: addDataForm.productName,
      packingSize: addDataForm.packingSize,
      packingType: addDataForm.packingType,
      partyName: addDataForm.partyName,
      oilRequired: Number(addDataForm.oilRequired),
      selectedOil: '',
      indentQuantity: 0,
      createdAt: new Date().toISOString(),
      status: 'Pending',
    };

    saveOilIndent(newIndent);
    const updatedIndents = [...indents, newIndent];
    setIndents(updatedIndents);
    
    // Reset form
    setShowAddDataForm(false);
    setAddDataForm({
      orderRef: '',
      productName: '',
      packingSize: '',
      packingType: 'Tin',
      partyName: '',
      oilRequired: '',
    });
  };

  const pendingIndents = indents.filter((i) => i.status === 'Pending');
  const historyIndents = indents.filter((i) => i.status !== 'Pending');
  
  // Get aggregated view using local function
  const displayIndents = activeTab === 'pending' ? pendingIndents : historyIndents;
  const aggregatedIndents = aggregateIndentsByProduct(displayIndents);

  // Get unique products from pending indents using normalized keys
  const uniqueProducts = Array.from(
    new Set(
      pendingIndents
        .map(i => normalizeProductKey(i.productName, i.packingSize))
        .filter(p => p)
    )
  );

  // Handle product selection in form
  const handleProductSelect = (normalizedKey: string) => {
    setSelectedProduct(normalizedKey);
    
    // Find all parties for this product using normalized matching
    const partiesForProduct = pendingIndents
      .filter(i => normalizeProductKey(i.productName, i.packingSize) === normalizedKey)
      .map(i => i.partyName)
      .filter((p): p is string => !!p);
    
    const uniqueParties = Array.from(new Set(partiesForProduct));
    setSelectedParties(uniqueParties);
    
    // Calculate total quantity
    const totalQty = pendingIndents
      .filter(i => normalizeProductKey(i.productName, i.packingSize) === normalizedKey)
      .reduce((sum, i) => sum + i.oilRequired, 0);
    
    // Get display name from first matching product
    const firstMatch = pendingIndents.find(i => normalizeProductKey(i.productName, i.packingSize) === normalizedKey);
    const displayName = firstMatch ? `${firstMatch.productName}${firstMatch.packingSize ? ' ' + firstMatch.packingSize : ''}` : normalizedKey;
    
    setFormData({
      selectedOil: displayName,
      indentQuantity: totalQty,
    });
  };

  // Handle party checkbox toggle
  const handlePartyToggle = (partyName: string) => {
    let newSelectedParties: string[];
    
    if (selectedParties.includes(partyName)) {
      newSelectedParties = selectedParties.filter(p => p !== partyName);
    } else {
      newSelectedParties = [...selectedParties, partyName];
    }
    
    setSelectedParties(newSelectedParties);
    
    // Recalculate total based on selected parties
    const totalQty = pendingIndents
      .filter(i => 
        normalizeProductKey(i.productName, i.packingSize) === selectedProduct &&
        newSelectedParties.includes(i.partyName || '')
      )
      .reduce((sum, i) => sum + i.oilRequired, 0);
    
    setFormData({
      ...formData,
      indentQuantity: totalQty,
    });
  };

  // Get parties for selected product using normalized matching
  const getPartiesForProduct = (normalizedKey: string): PartyProductDetail[] => {
    return pendingIndents
      .filter(i => normalizeProductKey(i.productName, i.packingSize) === normalizedKey)
      .map(i => ({
        partyName: i.partyName || '',
        quantity: i.oilRequired,
        packingType: i.packingType || '',
        productName: i.productName,
        packingSize: i.packingSize || ''
      }));
  };

  // Get display name for normalized key
  const getDisplayName = (normalizedKey: string): string => {
    const firstMatch = pendingIndents.find(i => normalizeProductKey(i.productName, i.packingSize) === normalizedKey);
    return firstMatch ? `${firstMatch.productName}${firstMatch.packingSize ? ' ' + firstMatch.packingSize : ''}` : normalizedKey;
  };

  // Handle submit indent
  const handleSubmitIndent = () => {
    if (!selectedProduct || selectedParties.length === 0) {
      alert('Please select a product and at least one party');
      return;
    }

    // Update indents for selected parties using normalized matching
    const updatedIndents = indents.map(indent => {
      if (
        normalizeProductKey(indent.productName, indent.packingSize) === selectedProduct &&
        selectedParties.includes(indent.partyName || '')
      ) {
        return {
          ...indent,
          selectedOil: formData.selectedOil,
          indentQuantity: indent.oilRequired,
          status: 'Approved' as const,
        };
      }
      return indent;
    });

    // Move to approval
    updatedIndents.forEach(indent => {
      if (
        normalizeProductKey(indent.productName, indent.packingSize) === selectedProduct &&
        selectedParties.includes(indent.partyName || '') &&
        indent.status === 'Approved'
      ) {
        moveToOilApproval(indent);
      }
    });

    // Update local state - reload from storage
    const remainingIndents = getOilIndents();
    setIndents(remainingIndents);
    
    // Reset form
    setShowIndentForm(false);
    setSelectedProduct('');
    setSelectedParties([]);
    setFormData({ selectedOil: '', indentQuantity: 0 });
  };

  return (
    <div className="p-6 bg-background">
      <StageHeader title="Oil Indent" description="Submit oil indents for required products" />

      {/* Tabs and Action Buttons */}
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

        <div className="flex gap-2">
          {activeTab === 'pending' && (
            <>
              <Button 
                onClick={() => setShowAddDataForm(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Data
              </Button>
              <Button 
                onClick={() => setShowIndentForm(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Oil Indent
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Aggregated Products Table */}
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
              {aggregatedIndents.map((aggregate) => {
                const normalizedKey = normalizeProductKey(aggregate.productName, aggregate.packingSize);
                const displayName = `${aggregate.productName}${aggregate.packingSize ? ' ' + aggregate.packingSize : ''}`;
                const isExpanded = expandedProduct === normalizedKey;
                const availableStock = getProductStock(normalizedKey);
                const shortage = Math.max(0, aggregate.oilRequired - availableStock);
                
                return (
                  <>
                    <tr 
                      key={aggregate.id} 
                      className="hover:bg-card/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedProduct(isExpanded ? null : normalizedKey)}
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
                        {aggregate.oilRequired}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {availableStock}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${shortage > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {shortage > 0 ? shortage : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {aggregate.parties.length > 0 ? aggregate.parties[0].packingType : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                      </td>
                    </tr>
                    
                    {/* Expanded Party Details */}
                    {isExpanded && aggregate.parties.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">
                              Party Details: ({aggregate.parties.length} {aggregate.parties.length === 1 ? 'party' : 'parties'})
                            </h4>
                            <table className="w-full bg-background/50 rounded-lg overflow-hidden">
                              <thead className="bg-background">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Party Name</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Quantity</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Packing Type</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.parties.map((party, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{party.partyName}</td>
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
        {aggregatedIndents.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} indents
          </div>
        )}
      </Card>

      {/* Add Data Form Modal */}
      {showAddDataForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Add New Data Entry</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Order Reference</label>
                  <input
                    type="text"
                    value={addDataForm.orderRef}
                    onChange={(e) => setAddDataForm({ ...addDataForm, orderRef: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="DP-2026-011"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Party Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addDataForm.partyName}
                    onChange={(e) => setAddDataForm({ ...addDataForm, partyName: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="ABC Party"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addDataForm.productName}
                    onChange={(e) => setAddDataForm({ ...addDataForm, productName: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="HK Rice"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Packing Size</label>
                  <input
                    type="text"
                    value={addDataForm.packingSize}
                    onChange={(e) => setAddDataForm({ ...addDataForm, packingSize: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="15 kg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Packing Type</label>
                  <select
                    value={addDataForm.packingType}
                    onChange={(e) => setAddDataForm({ ...addDataForm, packingType: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  >
                    <option value="Tin">Tin</option>
                    <option value="Box">Box</option>
                    <option value="Pouch">Pouch</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Oil Required (MT) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={addDataForm.oilRequired}
                    onChange={(e) => setAddDataForm({ ...addDataForm, oilRequired: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddDataForm(false);
                    setAddDataForm({
                      orderRef: '',
                      productName: '',
                      packingSize: '',
                      packingType: 'Tin',
                      partyName: '',
                      oilRequired: '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddData}
                  className="bg-primary hover:bg-primary/90"
                >
                  Add Data
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Oil Indent Form Modal */}
      {showIndentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Create Oil Indent</h2>
              
              {/* Product Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="">-- Select Product --</option>
                  {uniqueProducts.map(normalizedKey => (
                    <option key={normalizedKey} value={normalizedKey}>
                      {getDisplayName(normalizedKey)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Party Selection with Checkboxes */}
              {selectedProduct && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-3">
                      Select Parties (Total Qty: {formData.indentQuantity})
                    </label>
                    
                    {/* Stock Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-3 p-3 bg-card rounded-lg border border-border">
                      <div>
                        <span className="text-xs text-muted-foreground">Available Stock:</span>
                        <p className="font-semibold text-foreground">{getProductStock(selectedProduct)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Total Indent:</span>
                        <p className="font-semibold text-foreground">{formData.indentQuantity}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Shortage:</span>
                        <p className={`font-semibold ${Math.max(0, formData.indentQuantity - getProductStock(selectedProduct)) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {Math.max(0, formData.indentQuantity - getProductStock(selectedProduct)) > 0 
                            ? Math.max(0, formData.indentQuantity - getProductStock(selectedProduct))
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
                          {getPartiesForProduct(selectedProduct).map((party, idx) => (
                            <tr key={idx} className="hover:bg-background/50">
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedParties.includes(party.partyName)}
                                  onChange={() => handlePartyToggle(party.partyName)}
                                  className="w-4 h-4 rounded border-border"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-foreground">{party.partyName}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={party.quantity}
                                  onChange={(e) => {
                                    const newQty = Number(e.target.value);
                                    // Update the party quantity in the indents state
                                    const updatedIndents = indents.map(indent => {
                                      if (normalizeProductKey(indent.productName, indent.packingSize) === selectedProduct && 
                                          indent.partyName === party.partyName) {
                                        return { ...indent, oilRequired: newQty };
                                      }
                                      return indent;
                                    });
                                    setIndents(updatedIndents);
                                    
                                    // Recalculate total if this party is selected
                                    if (selectedParties.includes(party.partyName)) {
                                      const total = updatedIndents
                                        .filter(i => normalizeProductKey(i.productName, i.packingSize) === selectedProduct)
                                        .filter(i => selectedParties.includes(i.partyName || ''))
                                        .reduce((sum, i) => sum + i.oilRequired, 0);
                                      setFormData(prev => ({ ...prev, indentQuantity: total }));
                                    }
                                  }}
                                  className="w-24 px-2 py-1 border border-border rounded bg-background text-foreground text-sm font-semibold"
                                  min="0"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm text-muted-foreground">{party.packingType}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {getPartiesForProduct(selectedProduct).length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">No parties found for this product</p>
                    )}
                  </div>

                  {/* Selected Oil Type */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">Oil Type</label>
                    <input
                      type="text"
                      value={formData.selectedOil}
                      onChange={(e) => setFormData({ ...formData, selectedOil: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      placeholder="Enter oil type (e.g., HK Rice Oil)"
                    />
                  </div>

                  {/* Total Quantity (Auto-filled) */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-2">Total Indent Quantity</label>
                    <div className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-foreground font-semibold">
                      {formData.indentQuantity}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedParties.length} of {getPartiesForProduct(selectedProduct).length} parties selected
                      {selectedParties.length < getPartiesForProduct(selectedProduct).length && (
                        <span className="text-yellow-600 ml-2">
                          (Remaining: {
                            getPartiesForProduct(selectedProduct)
                              .filter(p => !selectedParties.includes(p.partyName))
                              .reduce((sum, p) => sum + p.quantity, 0)
                          })
                        </span>
                      )}
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowIndentForm(false);
                    setSelectedProduct('');
                    setSelectedParties([]);
                    setFormData({ selectedOil: '', indentQuantity: 0 });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitIndent}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct || selectedParties.length === 0 || !formData.selectedOil}
                >
                  Submit to Approval
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OilIndent;

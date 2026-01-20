'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getRawMaterialIndents, 
  moveToRawMaterialIssue,
  getProductStock,
  initializeDefaultStocks,
  type RawMaterialIndentItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string, packingSize?: string): string => {
  const normalized = `${productName}${packingSize ? ' ' + packingSize : ''}`
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  return normalized;
};

interface AggregatedIndent {
  productKey: string;
  productName: string;
  packingSize?: string;
  totalQuantity: number;
  availableStock: number;
  shortage: number;
  totalBomItems: number;
  status: string;
  indents: RawMaterialIndentItem[];
  consolidatedBOM: Array<{
    item: string;
    qtyRequired: number;
    qtyAllocated: number;
  }>;
}

const PackingRawMaterialIndent = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [indents, setIndents] = useState<RawMaterialIndentItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showProcessForm, setShowProcessForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    initializeDefaultStocks();
    const savedIndents = getRawMaterialIndents();
    setIndents(savedIndents);
  }, []);

  // Aggregate indents by product
  const aggregateIndents = (indentsList: RawMaterialIndentItem[]): AggregatedIndent[] => {
    const aggregated: { [key: string]: AggregatedIndent } = {};

    indentsList.forEach(indent => {
      const productKey = normalizeProductKey(indent.productName, indent.packingSize);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: indent.productName,
          packingSize: indent.packingSize,
          totalQuantity: 0,
          availableStock: stock,
          shortage: 0,
          totalBomItems: 0,
          status: indent.status,
          indents: [],
          consolidatedBOM: []
        };
      }

      aggregated[productKey].totalQuantity += indent.plannedQty;
      aggregated[productKey].indents.push(indent);

      // Consolidate BOM items
      indent.bom.forEach(bomItem => {
        const existingBom = aggregated[productKey].consolidatedBOM.find(b => b.item === bomItem.item);
        if (existingBom) {
          existingBom.qtyRequired += bomItem.qtyRequired;
          existingBom.qtyAllocated += bomItem.qtyAllocated;
        } else {
          aggregated[productKey].consolidatedBOM.push({ ...bomItem });
        }
      });
    });

    // Calculate shortage and total BOM items
    Object.values(aggregated).forEach(agg => {
      agg.shortage = Math.max(0, agg.totalQuantity - agg.availableStock);
      agg.totalBomItems = agg.consolidatedBOM.length;
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'allocated':
        return 'bg-blue-100 text-blue-800';
      case 'issued':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleProcessSubmit = () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    // Get all indents for the selected product
    const selectedIndents = indents.filter(indent => 
      normalizeProductKey(indent.productName, indent.packingSize) === selectedProduct
    );

    // Process each indent - allocate BOM and move to Raw Material Issue
    selectedIndents.forEach(indent => {
      const updatedIndent: RawMaterialIndentItem = {
        ...indent,
        bom: indent.bom.map((item) => ({
          ...item,
          qtyAllocated: item.qtyRequired,
        })),
        status: 'Allocated',
      };
      moveToRawMaterialIssue(updatedIndent);
    });

    // Update local state to remove processed items
    const remainingIndents = indents.filter(indent => 
      normalizeProductKey(indent.productName, indent.packingSize) !== selectedProduct
    );
    setIndents(remainingIndents);

    // Reset form
    setShowProcessForm(false);
    setSelectedProduct('');
  };

  const pendingIndents = indents.filter((i) => i.status === 'Pending');
  const historyIndents = indents.filter((i) => i.status !== 'Pending');
  const displayIndents = activeTab === 'pending' ? pendingIndents : historyIndents;
  const aggregatedIndents = aggregateIndents(displayIndents);

  const uniqueProducts = aggregateIndents(pendingIndents).map(a => ({
    key: a.productKey,
    name: `${a.productName}${a.packingSize ? ' ' + a.packingSize : ''}`
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Packing Raw Material Indent"
        description="Create BOM-based indents for packing materials required for production"
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

        {activeTab === 'pending' && pendingIndents.length > 0 && (
          <Button 
            onClick={() => setShowProcessForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Raw Material
          </Button>
        )}
      </div>

      {/* Aggregated Indents Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Planned Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Available Stock</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Shortage</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">BOM Items</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedIndents.map((aggregate) => {
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
                        {aggregate.totalBomItems} items
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(aggregate.status)}>{aggregate.status}</Badge>
                      </td>
                    </tr>
                    
                    {/* Expanded BOM Details */}
                    {isExpanded && aggregate.consolidatedBOM.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 bg-card/30">
                          <div className="pl-8">
                            <h4 className="font-semibold text-sm mb-2 text-foreground">
                              Bill of Materials (BOM): ({aggregate.totalBomItems} raw materials)
                            </h4>
                            <table className="w-full bg-background/50 rounded-lg overflow-hidden">
                              <thead className="bg-background">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Raw Material</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Required Qty</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Allocated Qty</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pending</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.consolidatedBOM.map((bom, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{bom.item}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{bom.qtyRequired}</td>
                                    <td className="px-3 py-2 text-sm text-green-600 font-medium">{bom.qtyAllocated}</td>
                                    <td className="px-3 py-2 text-sm text-orange-600 font-medium">
                                      {bom.qtyRequired - bom.qtyAllocated}
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
        {aggregatedIndents.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} indents
          </div>
        )}
      </Card>

      {/* Process Raw Material Form Modal */}
      {showProcessForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Raw Material Allocation</h2>
              
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
                      <span className="text-xs text-muted-foreground">Planned Quantity:</span>
                      <p className="font-semibold text-foreground text-lg">
                        {aggregateIndents(pendingIndents).find(p => p.productKey === selectedProduct)?.totalQuantity || 0} units
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Available Stock:</span>
                      <p className="font-semibold text-foreground text-lg">
                        {aggregateIndents(pendingIndents).find(p => p.productKey === selectedProduct)?.availableStock || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Shortage:</span>
                      <p className={`font-semibold text-lg ${(aggregateIndents(pendingIndents).find(p => p.productKey === selectedProduct)?.shortage || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(aggregateIndents(pendingIndents).find(p => p.productKey === selectedProduct)?.shortage || 0) > 0 
                          ? aggregateIndents(pendingIndents).find(p => p.productKey === selectedProduct)?.shortage
                          : 'No Shortage'
                        }
                      </p>
                    </div>
                  </div>

                  {/* BOM Details */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-foreground mb-3">Bill of Materials (BOM)</h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-card border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Raw Material</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Required Qty</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Qty to Allocate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {aggregateIndents(pendingIndents)
                            .find(p => p.productKey === selectedProduct)
                            ?.consolidatedBOM.map((bom, idx) => (
                              <tr key={idx} className="hover:bg-card/50">
                                <td className="px-4 py-3 text-foreground font-medium">{bom.item}</td>
                                <td className="px-4 py-3 text-foreground">{bom.qtyRequired}</td>
                                <td className="px-4 py-3 text-primary font-medium">{bom.qtyRequired}</td>
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
                    setShowProcessForm(false);
                    setSelectedProduct('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleProcessSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct}
                >
                  Allocate & Process
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PackingRawMaterialIndent;

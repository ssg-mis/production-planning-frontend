'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { 
  getRawMaterialIssues,
  moveToRawMaterialReceipt,
  getProductStock,
  initializeDefaultStocks,
  type RawMaterialIssueItem 
} from '@/lib/workflow-storage';

// Normalize product key
const normalizeProductKey = (productName: string): string => {
  return productName.toUpperCase().replace(/\s+/g, ' ').trim();
};

interface AggregatedIssue {
  productKey: string;
  productName: string;
  totalPlannedQty: number;
  totalIssuedQty: number;
  totalRemainingQty: number;
  availableStock: number;
  shortage: number;
  status: string;
  issues: RawMaterialIssueItem[];
  bomItems: Array<{
    bomItem: string;
    plannedQty: number;
    issuedQty: number;
    remainingQty: number;
  }>;
}

const RawMaterialIssue = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [issues, setIssues] = useState<RawMaterialIssueItem[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    initializeDefaultStocks();
    const savedIssues = getRawMaterialIssues();
    setIssues(savedIssues);
  }, []);

  // Aggregate issues by product
  const aggregateIssues = (issuesList: RawMaterialIssueItem[]): AggregatedIssue[] => {
    const aggregated: { [key: string]: AggregatedIssue } = {};

    issuesList.forEach(issue => {
      const productKey = normalizeProductKey(issue.productName);
      
      if (!aggregated[productKey]) {
        const stock = getProductStock(productKey);
        aggregated[productKey] = {
          productKey,
          productName: issue.productName,
          totalPlannedQty: 0,
          totalIssuedQty: 0,
          totalRemainingQty: 0,
          availableStock: stock,
          shortage: 0,
          status: issue.status,
          issues: [],
          bomItems: []
        };
      }

      aggregated[productKey].totalPlannedQty += issue.plannedQty;
      aggregated[productKey].totalIssuedQty += issue.issuedQty;
      aggregated[productKey].issues.push(issue);

      // Consolidate BOM items
      const existingBom = aggregated[productKey].bomItems.find(b => b.bomItem === issue.bomItem);
      if (existingBom) {
        existingBom.plannedQty += issue.plannedQty;
        existingBom.issuedQty += issue.issuedQty;
      } else {
        aggregated[productKey].bomItems.push({
          bomItem: issue.bomItem,
          plannedQty: issue.plannedQty,
          issuedQty: issue.issuedQty,
          remainingQty: issue.plannedQty - issue.issuedQty
        });
      }
    });

    // Calculate totals and shortage
    Object.values(aggregated).forEach(agg => {
      agg.totalRemainingQty = agg.totalPlannedQty - agg.totalIssuedQty;
      agg.shortage = Math.max(0, agg.totalPlannedQty - agg.availableStock);
      // Update remaining qty for BOM items
      agg.bomItems.forEach(bom => {
        bom.remainingQty = bom.plannedQty - bom.issuedQty;
      });
    });

    return Object.values(aggregated);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'issued':
        return 'bg-green-100 text-green-800';
      case 'partially issued':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleIssueSubmit = () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    // Get all issues for the selected product
    const selectedIssues = issues.filter(issue => 
      normalizeProductKey(issue.productName) === selectedProduct
    );

    // Process each issue - mark as issued and move to Raw Material Receipt
    selectedIssues.forEach(issue => {
      const updatedIssue: RawMaterialIssueItem = {
        ...issue,
        issuedQty: issue.plannedQty,
        status: 'Issued',
      };
      moveToRawMaterialReceipt(updatedIssue);
    });

    // Update local state to remove processed items
    const remainingIssues = issues.filter(issue => 
      normalizeProductKey(issue.productName) !== selectedProduct
    );
    setIssues(remainingIssues);

    // Reset form
    setShowIssueForm(false);
    setSelectedProduct('');
  };

  const pendingIssues = issues.filter((i) => i.status === 'Pending');
  const historyIssues = issues.filter((i) => i.status !== 'Pending');
  const displayIssues = activeTab === 'pending' ? pendingIssues : historyIssues;
  const aggregatedIssues = aggregateIssues(displayIssues);

  const uniqueProducts = aggregateIssues(pendingIssues).map(a => ({
    key: a.productKey,
    name: a.productName
  }));

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Raw Material Issue (Packing Head)"
        description="Issue packing materials to production floor"
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

        {activeTab === 'pending' && pendingIssues.length > 0 && (
          <Button 
            onClick={() => setShowIssueForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Process Material Issue
          </Button>
        )}
      </div>

      {/* Aggregated Issues Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground w-8"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Planned Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Issued Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Remaining Qty</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">BOM Items</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aggregatedIssues.map((aggregate) => {
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
                        {aggregate.totalPlannedQty}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">
                        {aggregate.totalIssuedQty || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-orange-600 font-semibold">
                        {aggregate.totalRemainingQty}
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
                              BOM Items to Issue: ({aggregate.bomItems.length} materials)
                            </h4>
                            <table className="w-full bg-background/50 rounded-lg overflow-hidden">
                              <thead className="bg-background">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">BOM Item</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Planned Qty</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Issued Qty</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Remaining Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {aggregate.bomItems.map((bom, idx) => (
                                  <tr key={idx} className="hover:bg-background/70 transition-colors">
                                    <td className="px-3 py-2 text-sm text-foreground font-medium">{bom.bomItem}</td>
                                    <td className="px-3 py-2 text-sm text-foreground">{bom.plannedQty}</td>
                                    <td className="px-3 py-2 text-sm text-green-600 font-medium">{bom.issuedQty || '-'}</td>
                                    <td className="px-3 py-2 text-sm text-orange-600 font-medium">{bom.remainingQty}</td>
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
        {aggregatedIssues.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} issues
          </div>
        )}
      </Card>

      {/* Process Material Issue Form Modal */}
      {showIssueForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Process Material Issue</h2>
              
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
                      <span className="text-xs text-muted-foreground">Total Planned Qty:</span>
                      <p className="font-semibold text-foreground text-lg">
                        {aggregateIssues(pendingIssues).find(p => p.productKey === selectedProduct)?.totalPlannedQty || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Issued Qty:</span>
                      <p className="font-semibold text-green-600 text-lg">
                        {aggregateIssues(pendingIssues).find(p => p.productKey === selectedProduct)?.totalIssuedQty || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Remaining:</span>
                      <p className="font-semibold text-orange-600 text-lg">
                        {aggregateIssues(pendingIssues).find(p => p.productKey === selectedProduct)?.totalRemainingQty || 0}
                      </p>
                    </div>
                  </div>

                  {/* BOM Items to Issue */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-foreground mb-3">BOM Items to Issue</h3>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-card border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">BOM Item</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Planned Qty</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">Qty to Issue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {aggregateIssues(pendingIssues)
                            .find(p => p.productKey === selectedProduct)
                            ?.bomItems.map((bom, idx) => (
                              <tr key={idx} className="hover:bg-card/50">
                                <td className="px-4 py-3 text-foreground font-medium">{bom.bomItem}</td>
                                <td className="px-4 py-3 text-foreground">{bom.plannedQty}</td>
                                <td className="px-4 py-3 text-primary font-medium">{bom.plannedQty}</td>
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
                    setShowIssueForm(false);
                    setSelectedProduct('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleIssueSubmit}
                  className="bg-primary hover:bg-primary/90"
                  disabled={!selectedProduct}
                >
                  Issue Materials
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RawMaterialIssue;

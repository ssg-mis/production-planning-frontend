'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import TableSkeleton from '@/components/table-skeleton';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const BalanceMaterialReceipt = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [materialReceipts, setMaterialReceipts] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'pending' ? '/pending' : '/history';
      const response = await fetch(`${API_BASE_URL}/balance-material-receipt${endpoint}`);
      const data = await response.json();
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching balance receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const handleReceiptSubmit = async () => {
    if (!selectedEntry) return;

    try {
      const payload = {
        productionId: selectedEntry.production_id,
        receivedBy: 'Store Head',
        remarks,
        materialReceipts: selectedEntry.varianceItems.map((item: any) => ({
          material: item.material,
          planned: item.planned,
          actual: item.actual,
          varianceUsed: item.diff,
          returned: item.returned,
          damaged: item.damaged,
          receivedQty: materialReceipts[item.material] || 0
        }))
      };

      const response = await fetch(`${API_BASE_URL}/balance-material-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to submit balance receipt');

      setShowReceiptForm(false);
      setSelectedEntry(null);
      setMaterialReceipts({});
      setRemarks('');
      fetchItems();
    } catch (error) {
      console.error('Error submitting balance receipt:', error);
      alert('Failed to submit balance receipt');
    }
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

  const formatNumber = (num: any) => {
    const n = Number(num);
    return isNaN(n) ? '0' : n.toLocaleString('en-IN');
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <StageHeader
        title="Balance Material Receipt"
        description="Record receipt of leftover/balance materials from production"
      />

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

      <Card className="overflow-hidden border-border shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Production ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Party Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Produced Qty</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                {activeTab === 'pending' && <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {loading ? (
                <TableSkeleton cols={6} rows={5} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No {activeTab} balance receipts found</td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.production_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-bold text-primary">{item.production_id}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {item.productName} {item.packingSize && <span className="text-muted-foreground">({item.packingSize})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{item.partyName || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{formatNumber(item.actual_qty)}</td>
                  <td className="px-4 py-3">
                    <Badge className={getStatusColor(item.status || 'Pending')}>{item.status || 'Pending'}</Badge>
                  </td>
                  {activeTab === 'pending' && (
                    <td className="px-4 py-3 text-right">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedEntry(item);
                          setShowReceiptForm(true);
                          // Pre-fill received quantities with variance/returned amounts
                          const initialReceipts: Record<string, number> = {};
                          item.varianceItems.forEach((v: any) => {
                            initialReceipts[v.material] = (v.diff || 0) + (v.returned || 0);
                          });
                          setMaterialReceipts(initialReceipts);
                        }}
                      >
                        Receive
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showReceiptForm && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background p-6 border-border shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-2">
              <h2 className="text-xl font-bold text-foreground">Process Balance Material Receipt</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowReceiptForm(false)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <label className="text-xs text-muted-foreground block">Production ID</label>
                  <span className="text-sm font-bold font-mono">{selectedEntry.production_id}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Product</label>
                  <span className="text-sm font-bold">{selectedEntry.productName}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Party</label>
                  <span className="text-sm font-medium">{selectedEntry.partyName || '-'}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Produced Qty</label>
                  <span className="text-sm font-bold">{formatNumber(selectedEntry.actual_qty)}</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-3 uppercase text-muted-foreground">Leftover Materials (Variance / Returned)</h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-xs font-bold text-muted-foreground uppercase border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left">Material</th>
                        <th className="px-3 py-2 text-center">Variance</th>
                        <th className="px-3 py-2 text-center">Returned</th>
                        <th className="px-3 py-2 text-center">Damaged</th>
                        <th className="px-3 py-2 text-right w-32">Qty Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedEntry.varianceItems.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2 font-medium">{item.material}</td>
                          <td className="px-3 py-2 text-center font-semibold text-orange-600">{item.diff || 0}</td>
                          <td className="px-3 py-2 text-center font-bold text-green-600">{item.returned || 0}</td>
                          <td className="px-3 py-2 text-center font-medium text-red-500">{item.damaged || 0}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={materialReceipts[item.material] || 0}
                              onChange={(e) => setMaterialReceipts(prev => ({ ...prev, [item.material]: Number(e.target.value) }))}
                              className="w-full px-2 py-1 text-right border border-border rounded bg-background font-bold text-primary"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Remarks</label>
                <textarea
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="Notes about quality or quantity of balance materials..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground h-24"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setShowReceiptForm(false)}>Cancel</Button>
                <Button onClick={handleReceiptSubmit} className="bg-primary hover:bg-primary/90">Confirm Receipt</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BalanceMaterialReceipt;

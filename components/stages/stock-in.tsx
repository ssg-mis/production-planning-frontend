'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import TableSkeleton from '@/components/table-skeleton';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || `${API_BASE_URL}`;

const StockIn = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'pending' ? '/pending' : '/history';
      const response = await fetch(`${API_BASE_URL}/stock-in${endpoint}`);
      const data = await response.json();
      setItems(data || []);
      setSelectedIds([]);
    } catch (error) {
      console.error('Error fetching stock items:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map(item => item.production_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleAcceptStock = async () => {
    if (selectedIds.length === 0) return;

    setProcessing(true);
    try {
      const selectedItems = items.filter(item => selectedIds.includes(item.production_id));
      const payload = {
        items: selectedItems.map(item => ({
          productionId: item.production_id,
          finishedQty: item.actual_qty,
          acceptedQty: item.actual_qty, // Assuming full acceptance by default
          receivedBy: 'Packing Head',
          remarks: 'Accepted to warehouse stock'
        }))
      };

      const response = await fetch(`${API_BASE_URL}/stock-in/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to accept stock');

      alert(`Successfully accepted ${selectedIds.length} item(s) to stock`);
      fetchItems();
    } catch (error) {
      console.error('Error accepting stock:', error);
      alert('Failed to accept stock');
    } finally {
      setProcessing(false);
    }
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

  const formatNumber = (num: any) => {
    const n = Number(num);
    return isNaN(n) ? '0' : n.toLocaleString('en-IN');
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <StageHeader
        title="Stock In (Warehouse)"
        description="Accept finished goods from production into warehouse stock"
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

        {activeTab === 'pending' && items.length > 0 && (
          <Button 
            onClick={handleAcceptStock}
            disabled={selectedIds.length === 0 || processing}
            className="flex items-center gap-2"
          >
            {processing ? 'Processing...' : `Accept Selected (${selectedIds.length})`}
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-border shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {activeTab === 'pending' && (
                  <th className="px-4 py-3 text-left w-12">
                    <input 
                      type="checkbox" 
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      checked={selectedIds.length === items.length && items.length > 0}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Production ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Party Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Produced Qty</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton cols={activeTab === 'pending' ? 6 : 5} rows={5} />
            ) : (
              <tbody className="divide-y divide-border bg-background">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'pending' ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                      No {activeTab} stock items found
                    </td>
                  </tr>
                ) : items.map((item) => (
                  <tr key={item.production_id} className="hover:bg-muted/30 transition-colors">
                    {activeTab === 'pending' && (
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(item.production_id)}
                          onChange={() => handleToggleSelect(item.production_id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-mono font-bold text-primary">{item.production_id}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {item.productName} {item.packingSize && <span className="text-muted-foreground ml-1">({item.packingSize})</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{item.partyName || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatNumber(item.actual_qty || item.finished_qty)}</td>
                    <td className="px-4 py-3">
                      <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
};

export default StockIn;

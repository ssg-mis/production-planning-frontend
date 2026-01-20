'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';

interface DispatchOrder {
  id: string;
  orderRef: string;
  product: string;
  dispatchedQty: number;
  date: string;
  status: string;
}

const ActualDispatch = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [orders] = useState<DispatchOrder[]>([
    {
      id: '1',
      orderRef: 'DP-2026-001',
      product: 'HK Rice 15 Kg',
      dispatchedQty: 2400,
      date: new Date().toLocaleDateString(),
      status: 'Completed',
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in transit':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingOrders = orders.filter(o => o.status !== 'Completed');
  const historyOrders = orders.filter(o => o.status === 'Completed');
  const displayOrders = activeTab === 'pending' ? pendingOrders : historyOrders;

  return (
    <div className="p-6 bg-background">
      <StageHeader
        title="Actual Dispatch (Order Management)"
        description="Track final dispatch of finished goods to customers"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground border border-border'
          }`}
        >
          ✅ Pending
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground border border-border'
          }`}
        >
          📜 History
        </button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-card border-b border-border">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Order Ref</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Product</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Dispatched Qty</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayOrders.map((order) => (
              <tr key={order.id} className="hover:bg-card/50 transition-colors">
                <td className="px-6 py-4 text-sm text-foreground font-medium">{order.orderRef}</td>
                <td className="px-6 py-4 text-sm text-foreground">{order.product}</td>
                <td className="px-6 py-4 text-sm text-foreground">{order.dispatchedQty}</td>
                <td className="px-6 py-4 text-sm text-foreground">{order.date}</td>
                <td className="px-6 py-4 text-sm">
                  <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayOrders.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No {activeTab === 'pending' ? 'pending' : 'history'} dispatches
          </div>
        )}
      </Card>
    </div>
  );
};

export default ActualDispatch;

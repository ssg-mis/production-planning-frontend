'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: any) => void;
}

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'order-dispatch', label: 'Order Dispatch Planning', icon: '📦' },
  { id: 'oil-indent', label: 'Oil Indent', icon: '🛢️' },
  { id: 'oil-indent-approval', label: 'Oil Indent Approval', icon: '✅' },
  { id: 'lab-confirmation', label: 'Lab Confirmation', icon: '🧪' },
  { id: 'dispatch-planning', label: 'Dispatch Planning (Plant)', icon: '🏭' },
  { id: 'oil-receipt', label: 'Oil Receipt', icon: '📥' },
  { id: 'packing-raw-material', label: 'Packing Raw Material Indent', icon: '📋' },
  { id: 'raw-material-issue', label: 'Raw Material Issue', icon: '📤' },
  { id: 'raw-material-receipt', label: 'Raw Material Receipt', icon: '📦' },
  { id: 'production-entry', label: 'Production Entry', icon: '⚙️' },
  { id: 'balance-material', label: 'Balance Material Receipt', icon: '⚖️' },
  { id: 'stock-in', label: 'Stock In', icon: '📊' },
  // { id: 'actual-dispatch', label: 'Actual Dispatch', icon: '🚚' },
  { id: 'reports', label: 'Reports', icon: '📈' },
];

export default function Sidebar({ currentPage, setCurrentPage }: SidebarProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`${
        expanded ? 'w-64' : 'w-20'
      } bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${!expanded && 'hidden'}`}>
            <div className="w-8 h-8 bg-sidebar-primary rounded flex items-center justify-center text-sidebar-primary-foreground font-bold">
              PP
            </div>
            <h1 className="font-bold text-sidebar-foreground whitespace-nowrap">
              Production
            </h1>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-sidebar-accent rounded transition-colors"
          >
            <ChevronDown
              size={20}
              className={`text-sidebar-foreground transition-transform ${
                expanded ? 'rotate-0' : '-rotate-90'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full px-4 py-3 text-left transition-colors ${
              currentPage === item.id
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent'
            }`}
            title={item.label}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              {expanded && <span className="text-sm font-medium">{item.label}</span>}
            </div>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 text-center text-xs text-sidebar-foreground">
        {expanded && <p>v1.0</p>}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/auth-context';
import LoginPage from '@/components/login-page';
import Sidebar from '@/components/sidebar';
import Dashboard from '@/components/stages/dashboard';
import OrderDispatchPlanning from '@/components/stages/order-dispatch-planning';
import OilIndent from '@/components/stages/oil-indent';
import OilIndentApproval from '@/components/stages/oil-indent-approval';
import LabConfirmation from '@/components/stages/lab-confirmation';
import DispatchPlanning from '@/components/stages/dispatch-planning';
import OilReceipt from '@/components/stages/oil-receipt';
import PackingRawMaterialIndent from '@/components/stages/packing-raw-material-indent';
import RawMaterialIssue from '@/components/stages/raw-material-issue';
import RawMaterialReceipt from '@/components/stages/raw-material-receipt';
import ProductionEntry from '@/components/stages/production-entry';
import BalanceMaterialReceipt from '@/components/stages/balance-material-receipt';
import StockIn from '@/components/stages/stock-in';
import ActualDispatch from '@/components/stages/actual-dispatch';
import Reports from '@/components/stages/reports';
import Settings from '@/components/stages/settings';

type Page =
  | 'dashboard' | 'order-dispatch' | 'oil-indent' | 'oil-indent-approval'
  | 'lab-confirmation' | 'dispatch-planning' | 'oil-receipt' | 'packing-raw-material'
  | 'raw-material-issue' | 'raw-material-receipt' | 'production-entry'
  | 'balance-material' | 'stock-in' | 'actual-dispatch' | 'reports' | 'settings';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'order-dispatch': return <OrderDispatchPlanning />;
      case 'oil-indent': return <OilIndent />;
      case 'oil-indent-approval': return <OilIndentApproval />;
      case 'lab-confirmation': return <LabConfirmation />;
      case 'dispatch-planning': return <DispatchPlanning />;
      case 'oil-receipt': return <OilReceipt />;
      case 'packing-raw-material': return <PackingRawMaterialIndent />;
      case 'raw-material-issue': return <RawMaterialIssue />;
      case 'raw-material-receipt': return <RawMaterialReceipt />;
      case 'production-entry': return <ProductionEntry />;
      case 'balance-material': return <BalanceMaterialReceipt />;
      case 'stock-in': return <StockIn />;
      case 'actual-dispatch': return <ActualDispatch />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top spacer for hamburger button */}
        <div className="md:hidden h-14" />
        <div className="h-full md:h-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

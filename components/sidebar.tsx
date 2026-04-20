'use client';

import {
  LayoutDashboard, PackageSearch, Droplet, CheckCircle2, FlaskConical,
  Truck, Inbox, ClipboardList, ArrowUpFromLine, ArrowDownToLine,
  Factory, Scale, Warehouse, BarChart3, Settings, LogOut,
  ChevronLeft, Menu, X, BookOpen
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: any) => void;
}

const ALL_NAV_ITEMS = [
  { id: 'dashboard',            label: 'Dashboard',                   icon: LayoutDashboard },
  { id: 'order-dispatch',       label: 'Order Dispatch Planning',     icon: PackageSearch },
  { id: 'oil-indent',           label: 'Oil Indent',                  icon: Droplet },
  { id: 'oil-indent-approval',  label: 'Oil Indent Approval',         icon: CheckCircle2 },
  { id: 'lab-confirmation',     label: 'Lab Confirmation',            icon: FlaskConical },
  { id: 'dispatch-planning',    label: 'Actual Dispatch',             icon: Truck },
  { id: 'oil-receipt',          label: 'Oil Receipt',                 icon: Inbox },
  { id: 'packing-raw-material', label: 'Packing Raw Material Indent', icon: ClipboardList },
  { id: 'raw-material-issue',   label: 'Raw Material Issue',          icon: ArrowUpFromLine },
  { id: 'raw-material-receipt', label: 'Raw Material Receipt',        icon: ArrowDownToLine },
  { id: 'production-entry',     label: 'Production Entry',            icon: Factory },
  { id: 'balance-material',     label: 'Balance Material Receipt',    icon: Scale },
  { id: 'stock-in',             label: 'Stock In',                    icon: Warehouse },
  { id: 'reports',              label: 'Reports',                     icon: BarChart3 },
  { id: 'master',               label: 'Master',                      icon: BookOpen },
];

export default function Sidebar({ currentPage, setCurrentPage }: SidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, isAdmin, canAccess } = useAuth();

  // Close mobile sidebar on page change
  useEffect(() => { setMobileOpen(false); }, [currentPage]);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navigationItems = ALL_NAV_ITEMS.filter(item => canAccess(item.id));

  const NavItem = ({ item, onClick }: { item: typeof ALL_NAV_ITEMS[0]; onClick?: () => void }) => {
    const isActive = currentPage === item.id;
    const Icon = item.icon;
    return (
      <button
        onClick={() => { setCurrentPage(item.id); onClick?.(); }}
        title={!expanded ? item.label : undefined}
        className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 text-left transition-all duration-150 ${
          isActive
            ? 'bg-primary text-white shadow-md shadow-primary/30'
            : 'text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent'
        }`}
        style={{ width: 'calc(100% - 16px)' }}
      >
        <Icon
          size={18}
          className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'}`}
        />
        {expanded && (
          <span className="text-sm font-medium truncate leading-none">{item.label}</span>
        )}

        {/* Tooltip for collapsed state */}
        {!expanded && (
          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-sidebar-foreground text-sidebar rounded-md text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg">
            {item.label}
          </div>
        )}
      </button>
    );
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full bg-sidebar ${mobile ? 'w-72' : ''}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border shrink-0">
        <div className={`flex items-center gap-2.5 overflow-hidden ${!expanded && !mobile ? 'w-0 opacity-0' : 'flex-1 opacity-100'} transition-all duration-200`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/40">
            <span className="text-sm font-bold text-white tracking-tight">PP</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground leading-none">Production</p>
            <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 leading-none">Planning System</p>
          </div>
        </div>

        {/* Desktop collapse toggle */}
        {!mobile && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all shrink-0"
          >
            <ChevronLeft size={16} className={`transition-transform duration-200 ${!expanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Mobile close button */}
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all">
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {navigationItems.map(item => (
          <NavItem key={item.id} item={item} />
        ))}

        {/* Divider before Settings */}
        {isAdmin && (
          <>
            <div className="my-2 mx-4 border-t border-sidebar-border/60" />
            <button
              onClick={() => { setCurrentPage('settings'); }}
              title={!expanded ? 'Settings' : undefined}
              className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 text-left transition-all duration-150 ${
                currentPage === 'settings'
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
              style={{ width: 'calc(100% - 16px)' }}
            >
              <Settings
                size={18}
                className={`shrink-0 transition-colors ${currentPage === 'settings' ? 'text-white' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground'}`}
              />
              {expanded && <span className="text-sm font-medium">Settings</span>}
              {!expanded && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-sidebar-foreground text-sidebar rounded-md text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-lg">
                  Settings
                </div>
              )}
            </button>
          </>
        )}
      </nav>

      {/* ── User Footer ── */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        {expanded || mobile ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-sidebar-accent/60">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-primary to-indigo-400 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">{user?.username}</p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize mt-0.5">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex justify-center">
              <div className="w-7 h-7 rounded-lg bg-linear-to-br from-primary to-indigo-400 flex items-center justify-center text-xs font-bold text-white shadow-sm" title={user?.username}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="w-full flex items-center justify-center p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-150"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile Hamburger Button ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground shadow-lg border border-sidebar-border"
      >
        <Menu size={18} />
      </button>

      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <div className={`md:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
        <SidebarContent mobile />
      </div>

      {/* ── Desktop Sidebar ── */}
      <div
        className={`hidden md:flex flex-col ${expanded ? 'w-64' : 'w-17'} bg-sidebar border-r border-sidebar-border transition-all duration-250 ease-in-out overflow-hidden shrink-0`}
      >
        <SidebarContent />
      </div>
    </>
  );
}

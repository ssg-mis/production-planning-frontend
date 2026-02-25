'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || `${API_BASE_URL}`;
  ShoppingCart, Droplet, FlaskConical, Factory, Warehouse,
  TrendingUp, RefreshCw, ArrowRight
} from 'lucide-react';

const API = `${API_BASE_URL}`;

const PIPELINE_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b'];
const PIE_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

interface DashboardStats {
  kpis: {
    ordersPending: number;
    oilIndentsPending: number;
    productionInProgress: number;
    stockInCount: number;
    labPending: number;
  };
  pipeline: { stage: string; total: number; done: number; color: string }[];
  oilConsumption: { name: string; value: number }[];
  weeklyActivity: { date: string; completed: number; pending: number }[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/dashboard/stats`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError('Could not load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const kpiCards = stats ? [
    {
      label: 'Orders Pending',
      value: stats.kpis.ordersPending,
      icon: ShoppingCart,
      gradient: 'from-rose-500 to-pink-600',
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      badge: 'bg-rose-100 text-rose-700'
    },
    {
      label: 'Oil Indents Pending',
      value: stats.kpis.oilIndentsPending,
      icon: Droplet,
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700'
    },
    {
      label: 'Lab Confirmations',
      value: stats.kpis.labPending,
      icon: FlaskConical,
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      badge: 'bg-violet-100 text-violet-700'
    },
    {
      label: 'Production Active',
      value: stats.kpis.productionInProgress,
      icon: Factory,
      gradient: 'from-sky-500 to-blue-600',
      bg: 'bg-sky-50',
      text: 'text-sky-600',
      badge: 'bg-sky-100 text-sky-700'
    },
    {
      label: 'Stock In (Total)',
      value: stats.kpis.stockInCount,
      icon: Warehouse,
      gradient: 'from-emerald-500 to-green-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-700'
    },
  ] : [];

  return (
    <div className="p-5 lg:p-7 bg-background min-h-screen">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-7 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-8 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Production Planning Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-4">
            Real-time overview of all production and dispatch activities
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all shrink-0 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-7">
        {loading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 animate-pulse">
                <div className="h-3 w-24 bg-muted rounded mb-4" />
                <div className="h-8 w-12 bg-muted rounded" />
              </div>
            ))
          : kpiCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5 hover:shadow-md hover:shadow-primary/5 transition-all duration-200 group">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none">{card.label}</p>
                    <div className={`w-8 h-8 rounded-lg bg-linear-to-br ${card.gradient} flex items-center justify-center shadow-sm`}>
                      <Icon size={15} className="text-white" />
                    </div>
                  </div>
                  <p className={`text-3xl font-extrabold ${card.text} leading-none`}>
                    {card.value}
                  </p>
                  <div className={`mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${card.badge}`}>
                    {card.value > 0 ? 'Active' : 'Clear'}
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* ── Pipeline Progress ───────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6 mb-7">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Production Pipeline</h2>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {(stats?.pipeline || []).map((stage, i) => {
              const pct = stage.total > 0 ? Math.round((stage.done / stage.total) * 100) : 0;
              const isLast = i === (stats?.pipeline.length || 1) - 1;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl border border-border bg-background p-4 hover:border-primary/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">{stage.stage}</p>
                      <span className="text-xs font-bold" style={{ color: stage.color }}>{pct}%</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-extrabold text-foreground leading-none">{stage.done}</span>
                      <span className="text-xs text-muted-foreground mb-0.5">/ {stage.total}</span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: stage.color }}
                      />
                    </div>
                  </div>
                  {!isLast && (
                    <ArrowRight size={14} className="text-muted-foreground shrink-0 hidden md:block" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Charts Row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-7">

        {/* Oil Type Breakdown Pie */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">Oil Type Breakdown</h2>
          {loading ? (
            <div className="h-56 bg-muted rounded-lg animate-pulse" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stats?.oilConsumption}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {(stats?.oilConsumption || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} orders`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {(stats?.oilConsumption || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Weekly Activity Line Chart */}
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">Weekly Production Activity</h2>
          {loading ? (
            <div className="h-56 bg-muted rounded-lg animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={stats?.weeklyActivity} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="completed" name="Completed" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Last Updated ─────────────────────────────────── */}
      {lastUpdated && (
        <p className="text-center text-xs text-muted-foreground/60">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

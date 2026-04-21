'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StageHeader from '@/components/stage-header';
import { Plus, Pencil, Trash2, X, Check, RefreshCw, Database, ChevronRight, ChevronDown, Search, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

/* ─────────────── Tab Config ─────────────── */
const TABS = [
  {
    id: 'raw_material',
    label: 'Raw Material',
    endpoint: 'raw-material',
    idColumn: 'id',
    columns: ['name', 'category', 'unit', 'rmid', 'status', 'rm_weight_gms_per_unit', 'max_filling_capacity_mlt'],
    icon: '🧪',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    id: 'bom',
    label: 'BOM',
    endpoint: 'bom',
    idColumn: 'id',
    columns: ['skuid', 'skuname', 'mainqty', 'mainuom', 'rmid', 'rmname', 'rmqty', 'rmunit', 'kgperrmunit', 'rmkgs'],
    icon: '📋',
    color: 'from-violet-500 to-purple-400',
  },
  {
    id: 'lab_report_master',
    label: 'Lab Report Master',
    endpoint: 'lab-report-master',
    idColumn: 'sn',
    columns: ['status', 'parameters', 'standard_limit', 'applicable_oil_types'],
    icon: '🔬',
    color: 'from-green-500 to-emerald-400',
  },
  {
    id: 'chemical_additives',
    label: 'Chemical Additives',
    endpoint: 'chemical-additives',
    idColumn: 'id',
    columns: ['chemical_id', 'status', 'chemical_name', 'standard_weight_per_mt', 'standard_unit', 'oil_type'],
    icon: '⚗️',
    color: 'from-orange-500 to-amber-400',
  },
  {
    id: 'tanker_master',
    label: 'Tanker Master',
    endpoint: 'tanker-master',
    idColumn: 'id',
    columns: ['tanker_id', 'status', 'located_at', 'oil_type', 'max_capacity_ltr', 'radius_cm', 'height_cm'],
    icon: '🚛',
    color: 'from-rose-500 to-pink-400',
  },
];

/* ─────────────── Helpers ─────────────── */
const formatColHeader = (col: string) =>
  col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const SKIP_EDIT_COLS = ['id', 'sn', 'created_at', 'updated_at', 'createdat', 'updatedat'];

/* ─────────────── Main Component ─────────────── */
export default function Master() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [tableData, setTableData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [bomComponents, setBomComponents] = useState<any[]>([{ rmid: '', rmname: '', rmqty: '', rmunit: '', kgperrmunit: '', rmkgs: '' }]);
  const [rms, setRms] = useState<any[]>([]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  /* ── Fetch ── */
  const fetchTab = useCallback(
    async (tabId: string) => {
      const tab = TABS.find((t) => t.id === tabId);
      if (!tab) return;
      setLoading((p) => ({ ...p, [tabId]: true }));
      setError((p) => ({ ...p, [tabId]: '' }));
      try {
        const res = await fetch(`${API_BASE_URL}/master/${tab.endpoint}`);
        const json = await res.json();
        if (json.status === 'success') {
          setTableData((p) => ({ ...p, [tabId]: json.data }));
        } else {
          setError((p) => ({ ...p, [tabId]: json.message || 'Failed to load data' }));
        }
      } catch (e: any) {
        setError((p) => ({ ...p, [tabId]: 'Error connecting to server' }));
      } finally {
        setLoading((p) => ({ ...p, [tabId]: false }));
      }
    },
    []
  );

  const fetchRMs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/master/raw-material`);
      const json = await res.json();
      if (json.status === 'success') setRms(json.data);
    } catch (e) {}
  }, []);

  useEffect(() => { fetchRMs(); }, [fetchRMs]);

  // Fetch on tab switch (lazy load)
  useEffect(() => {
    if (!tableData[activeTab]) {
      fetchTab(activeTab);
    }
  }, [activeTab, fetchTab, tableData]);

  /* ── Columns ── */
  const rows = tableData[activeTab] || [];
  
  // Use dynamic columns from data if available, otherwise use hardcoded ones from config
  const rawColumns = rows.length > 0 
    ? Object.keys(rows[0]).filter(k => k !== '__typename') 
    : [currentTab.idColumn, ...(currentTab.columns || [])];

  const columns = rawColumns;

  /* ── Group BOM Data ── */
  const groupedBOM = activeTab === 'bom' ? rows.reduce((acc: Record<string, any>, row: any) => {
    const key = row.skuid || row.skuname || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        skuInfo: {
          id: row.id,
          skuid: row.skuid,
          skuname: row.skuname,
          mainqty: row.mainqty,
          mainuom: row.mainuom,
        },
        components: [],
      };
    }
    acc[key].components.push(row);
    return acc;
  }, {}) : {};

  const bomGroups = Object.values(groupedBOM);
  
  // Editable columns are those not in SKIP_EDIT_COLS
  const editableCols = (currentTab.columns || columns.filter(
    (c) => !SKIP_EDIT_COLS.includes(c.toLowerCase())
  ));

  /* ── Open Add Modal ── */
  const openAdd = () => {
    setEditingRow(null);
    const blank: Record<string, any> = {};
    editableCols.forEach((c) => (blank[c] = ''));
    setFormData(blank);
    
    if (activeTab === 'bom') {
      setBomComponents([{ rmid: '', rmname: '', rmqty: '', rmunit: '', kgperrmunit: '', rmkgs: '' }]);
    }
    
    setShowModal(true);
  };

  /* ── Open Edit Modal ── */
  const openEdit = (row: any) => {
    setEditingRow(row);
    const filled: Record<string, any> = {};
    editableCols.forEach((c) => (filled[c] = row[c] ?? ''));
    setFormData(filled);

    if (activeTab === 'bom') {
      // Find all components for this SKU to edit the whole recipe
      const group = bomGroups.find((g: any) => g.skuInfo.skuid === row.skuid);
      if (group) {
        setBomComponents(group.components.map((c: any) => ({ ...c })));
      } else {
        setBomComponents([{ ...row }]);
      }
    }
    
    setShowModal(true);
  };

  /* ── Save (Create / Update) ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'bom') {
        // Multi-row save for BOM
        for (const comp of bomComponents) {
          const payload = {
            ...comp,
            skuid: formData.skuid,
            skuname: formData.skuname,
            mainqty: formData.mainqty,
            mainuom: formData.mainuom,
          };
          
          const url = comp.id
            ? `${API_BASE_URL}/master/${currentTab.endpoint}/${comp.id}`
            : `${API_BASE_URL}/master/${currentTab.endpoint}`;
          const method = comp.id ? 'PUT' : 'POST';

          await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
        setShowModal(false);
        await fetchTab(activeTab);
      } else {
        // Standard single record save
        const url = editingRow
          ? `${API_BASE_URL}/master/${currentTab.endpoint}/${editingRow[currentTab.idColumn]}`
          : `${API_BASE_URL}/master/${currentTab.endpoint}`;
        const method = editingRow ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (json.status === 'success') {
          setShowModal(false);
          await fetchTab(activeTab);
        } else {
          alert(json.message || 'Save failed');
        }
      }
    } catch (e: any) {
      alert('Error saving: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (row: any) => {
    const idValue = row[currentTab.idColumn];
    if (!confirm(`Delete record #${idValue}? This cannot be undone.`)) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/master/${currentTab.endpoint}/${idValue}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (json.status === 'success') {
        await fetchTab(activeTab);
      } else {
        alert(json.message || 'Delete failed');
      }
    } catch (e: any) {
      alert('Error deleting: ' + e.message);
    }
  };

  const isLoading = loading[activeTab];
  const hasError = error[activeTab];

  return (
    <div className="p-6 bg-background min-h-screen">
      <StageHeader
        title="Master Data"
        description="Manage core master tables from the Order Dispatch database"
      />

      {/* ── Tab Bar ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
              activeTab === tab.id
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-105'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
            {tableData[tab.id] && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tableData[tab.id].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Table Card ── */}
      <Card className="border-border shadow-md overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg bg-gradient-to-br ${currentTab.color} flex items-center justify-center text-lg shadow-md`}
            >
              {currentTab.icon}
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base leading-none">
                {currentTab.label}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rows.length} record{rows.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTab(activeTab)}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={openAdd}
              disabled={isLoading || !!hasError}
              className="gap-1.5"
            >
              <Plus size={13} />
              Add Row
            </Button>
          </div>
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading {currentTab.label}…
          </div>
        ) : hasError ? (
          <div className="p-6">
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              <Database size={16} />
              <div>
                <p className="font-semibold text-sm">Failed to load data</p>
                <p className="text-xs mt-0.5 opacity-75">{hasError}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto text-red-600 border-red-200"
                onClick={() => fetchTab(activeTab)}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="text-4xl mb-3">{currentTab.icon}</div>
            <p className="font-semibold text-foreground">No records found</p>
            <p className="text-sm mt-1">
              Click <strong>Add Row</strong> to insert the first record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {columns.filter(col => {
                    // Hide component columns in parent table for BOM tab
                    if (activeTab === 'bom' && (col.startsWith('rm') || col === 'kgperrmunit')) return false;
                    return true;
                  }).map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                    >
                      {formatColHeader(col)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {activeTab === 'bom' ? (
                  bomGroups.map((group: any, gIdx: number) => {
                    const isExpanded = expandedRows.has(group.skuInfo.skuid);
                    return (
                      <>
                        {/* Parent SKU Row */}
                        <tr
                          key={group.skuInfo.skuid || gIdx}
                          className="hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => toggleRow(group.skuInfo.skuid)}
                        >
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown size={16} className="text-primary" />
                              ) : (
                                <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
                              )}
                              <span className="font-mono font-bold text-primary">
                                #{group.skuInfo.id}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">{group.skuInfo.skuid}</td>
                          <td className="px-4 py-3 text-sm font-medium max-w-[400px] truncate" title={group.skuInfo.skuname}>
                            {group.skuInfo.skuname}
                          </td>
                          <td className="px-4 py-3 text-sm">{group.skuInfo.mainqty}</td>
                          <td className="px-4 py-3 text-sm">{group.skuInfo.mainuom}</td>
                          <td className="px-4 py-3 text-right">
                             <div className="flex items-center justify-end gap-2">
                               <div className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded inline-block font-bold">
                                 {group.components.length} ITEMS
                               </div>
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   // Open edit for first component but we'll adapt this for SKU edit
                                   openEdit(group.components[0]);
                                 }}
                                 className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                 title="Edit SKU Details"
                               >
                                 <Pencil size={14} />
                               </button>
                             </div>
                          </td>
                        </tr>

                        {/* Expanded Components View */}
                        {isExpanded && (
                          <tr className="bg-muted/10">
                            <td colSpan={columns.length + 1} className="px-6 py-4">
                              <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">RM ID</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">RM Name</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">Qty</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">Unit</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">KG/Unit</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase">RM KGS</th>
                                      <th className="px-3 py-2 text-right text-[10px] font-bold text-muted-foreground uppercase">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {group.components.map((comp: any, cIdx: number) => (
                                      <tr key={comp.id || cIdx} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 font-mono text-xs text-primary">{comp.rmid || '—'}</td>
                                        <td className="px-3 py-2 text-xs truncate max-w-[250px]" title={comp.rmname}>{comp.rmname}</td>
                                        <td className="px-3 py-2 text-xs">{comp.rmqty}</td>
                                        <td className="px-3 py-2 text-xs">{comp.rmunit}</td>
                                        <td className="px-3 py-2 text-xs">{comp.kgperrmunit || '—'}</td>
                                        <td className="px-3 py-2 text-xs">{comp.rmkgs || '—'}</td>
                                        <td className="px-3 py-2 text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEdit(comp);
                                              }}
                                              className="p-1 rounded text-muted-foreground hover:text-primary transition-all"
                                            >
                                              <Pencil size={12} />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(comp);
                                              }}
                                              className="p-1 rounded text-muted-foreground hover:text-red-500 transition-all"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
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
                  })
                ) : (
                  rows.map((row: any, idx: number) => (
                    <tr
                      key={row.id ?? idx}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className={`px-4 py-3 text-sm text-foreground ${
                            col.toLowerCase().includes('name') ? 'min-w-[200px] max-w-[500px]' : 'max-w-[200px]'
                          } truncate`}
                          title={String(row[col] ?? '')}
                        >
                          {col === currentTab.idColumn ? (
                            <span className="font-mono font-bold text-primary">
                              #{row[col]}
                            </span>
                          ) : row[col] === null || row[col] === undefined || row[col] === '' ? (
                            <span className="text-muted-foreground/50 text-xs italic">—</span>
                          ) : typeof row[col] === 'boolean' ? (
                            row[col] ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-medium">
                                <Check size={10} /> Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-medium">
                                <X size={10} /> No
                              </span>
                            )
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-background/95 border-border shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md rounded-[2rem] border-none ring-1 ring-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-7 border-b border-white/5 bg-gradient-to-br from-primary/10 via-background to-background">
              <div className="flex items-center gap-5">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentTab.color} flex items-center justify-center text-2xl shadow-[0_10px_20px_rgba(0,0,0,0.2)] ring-1 ring-white/20`}
                >
                  {currentTab.icon}
                </div>
                <div>
                  <h2 className="font-black text-foreground text-xl leading-tight tracking-[0.02em]">
                    {editingRow ? 'Update Recipe' : 'Design New Recipe'}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="px-2.5 py-0.5 rounded-lg bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest ring-1 ring-primary/20">
                      {currentTab.label}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground font-bold tracking-tight uppercase">
                      {editingRow ? `RECIPE ID: #${editingRow[currentTab.idColumn]}` : 'Drafting Stage'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2.5 rounded-2xl text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-all duration-300 outline-none focus:ring-2 focus:ring-primary/20 group"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6">
              {activeTab === 'bom' ? (
                <div className="space-y-6">
                  {/* SKU Header Section */}
                  <div className="bg-gradient-to-br from-muted/30 to-muted/5 p-6 rounded-[1.5rem] border border-white/5 shadow-inner backdrop-blur-sm">
                    <h3 className="text-[10px] font-black text-primary/80 uppercase mb-5 tracking-[0.25em] flex items-center gap-2.5">
                      <div className="w-4 h-[1px] bg-primary/30" />
                      SKU Recipe Details
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                      {[
                        { id: 'skuid', label: 'SKU ID', placeholder: 'SKU1001' },
                        { id: 'skuname', label: 'SKU Name', placeholder: 'Product Description' },
                        { id: 'mainqty', label: 'Batch Qty', placeholder: '1.0' },
                        { id: 'mainuom', label: 'UOM', placeholder: 'Box' }
                      ].map(item => (
                        <div key={item.id} className="space-y-2">
                          <label className="block text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em] ml-1">{item.label}</label>
                          <input
                            type="text"
                            value={formData[item.id] ?? ''}
                            onChange={(e) => setFormData(p => ({ ...p, [item.id]: e.target.value }))}
                            className="w-full px-4 py-2.5 text-xs bg-black/20 border border-white/5 rounded-2xl text-foreground transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none placeholder:text-muted-foreground/30 hover:bg-black/30"
                            placeholder={item.placeholder}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Components Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Ingredients (Components)</h3>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-[10px] font-black gap-2 px-4 border border-primary/20 text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                        onClick={() => setBomComponents(p => [...p, { rmid: '', rmname: '', rmqty: '', rmunit: '', kgperrmunit: '', rmkgs: '' }])}
                      >
                        <Plus size={12} strokeWidth={3} /> ADD INGREDIENT
                      </Button>
                    </div>
                    
                    <div className="border border-border/40 rounded-xl overflow-hidden shadow-sm bg-card/30">
                      <table className="w-full text-[11px]">
                        <thead className="bg-muted/40 border-b border-border/40 text-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left w-[12%] text-muted-foreground font-bold tracking-wider">ID</th>
                            <th className="px-4 py-3 text-left w-[45%] text-muted-foreground font-bold tracking-wider">RAW MATERIAL</th>
                            <th className="px-4 py-3 text-left w-[15%] text-muted-foreground font-bold tracking-wider">QTY</th>
                            <th className="px-4 py-3 text-left w-[15%] text-muted-foreground font-bold tracking-wider">UNIT</th>
                            <th className="px-4 py-3 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {bomComponents.map((comp, idx) => (
                            <tr key={idx} className="bg-background hover:bg-muted/30 transition-colors group">
                              <td className="px-3 py-2 font-mono text-[10px] text-primary font-bold">
                                {comp.rmid || <span className="text-muted-foreground/30">—</span>}
                              </td>
                              <td className="px-3 py-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      role="combobox"
                                      className={cn(
                                        "w-full justify-between text-xs font-medium hover:bg-muted/50 h-8 px-2",
                                        !comp.rmid && "text-muted-foreground"
                                      )}
                                    >
                                      {comp.rmid
                                        ? rms.find((rm) => String(rm.id) === String(comp.rmid))?.name
                                        : "Select Raw Material..."}
                                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Search raw material..." className="h-8 text-xs" />
                                      <CommandList>
                                        <CommandEmpty>No material found.</CommandEmpty>
                                        <CommandGroup>
                                          {rms.map((rm) => (
                                            <CommandItem
                                              key={rm.id}
                                              value={rm.name}
                                              onSelect={() => {
                                                const updated = [...bomComponents];
                                                updated[idx] = { 
                                                  ...updated[idx], 
                                                  rmid: String(rm.id), 
                                                  rmname: rm.name,
                                                  rmunit: rm.unit || updated[idx].rmunit,
                                                  rmqty: updated[idx].rmqty || '0'
                                                };
                                                setBomComponents(updated);
                                              }}
                                              className="text-xs"
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-3 w-3",
                                                  String(comp.rmid) === String(rm.id) ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              {rm.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </td>
                              <td className="px-3 py-2">
                                <input 
                                  type="text" 
                                  value={comp.rmqty}
                                  onChange={(e) => {
                                    const updated = [...bomComponents];
                                    updated[idx].rmqty = e.target.value;
                                    setBomComponents(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:ring-0 text-xs p-0 text-foreground"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input 
                                  type="text" 
                                  value={comp.rmunit}
                                  onChange={(e) => {
                                    const updated = [...bomComponents];
                                    updated[idx].rmunit = e.target.value;
                                    setBomComponents(updated);
                                  }}
                                  className="w-full bg-transparent border-none focus:ring-0 text-xs p-0 text-foreground"
                                  placeholder="Unit"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button 
                                  onClick={() => setBomComponents(p => p.filter((_, i) => i !== idx))}
                                  className="text-muted-foreground/50 hover:text-red-500 transition-colors p-1"
                                  title="Remove row"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {editableCols.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      No editable fields found. Fetch the table first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {editableCols.map((col) => (
                        <div key={col}>
                          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            {formatColHeader(col)}
                          </label>
                          {col === 'status' ? (
                            <div className="relative">
                              <select
                                value={formData[col] ?? ''}
                                onChange={(e) =>
                                  setFormData((p) => ({ ...p, [col]: e.target.value }))
                                }
                                className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer pr-10"
                              >
                                <option value="" disabled>Select Status</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={formData[col] ?? ''}
                              onChange={(e) =>
                                setFormData((p) => ({ ...p, [col]: e.target.value }))
                              }
                              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background text-foreground transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-muted-foreground/30"
                              placeholder={`Enter ${formatColHeader(col)}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex justify-end items-center gap-4 mt-10 pt-6 border-t border-white/5">
                <button 
                  onClick={() => setShowModal(false)} 
                  disabled={saving}
                  className="px-6 py-2 text-xs font-black text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  DISCARD
                </button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving || (activeTab !== 'bom' && editableCols.length === 0)} 
                  className="relative group px-8 py-5 h-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 font-black text-xs tracking-widest overflow-hidden shadow-[0_10px_20px_rgba(var(--primary),0.3)] transition-all active:scale-95"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative flex items-center gap-2">
                    {saving ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        PERSISTING...
                      </>
                    ) : (
                      <>
                        <Database size={14} />
                        {editingRow ? 'SYNC CHANGES' : 'DEPLOY RECIPE'}
                      </>
                    )}
                  </span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

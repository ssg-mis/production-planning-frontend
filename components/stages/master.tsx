'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StageHeader from '@/components/stage-header';
import { Plus, Pencil, Trash2, X, Check, RefreshCw, Database } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

/* ─────────────── Tab Config ─────────────── */
const TABS = [
  {
    id: 'raw_material',
    label: 'Raw Material',
    endpoint: 'raw-material',
    idColumn: 'id',
    columns: ['name', 'category', 'unit'],
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
    setShowModal(true);
  };

  /* ── Open Edit Modal ── */
  const openEdit = (row: any) => {
    setEditingRow(row);
    const filled: Record<string, any> = {};
    editableCols.forEach((c) => (filled[c] = row[c] ?? ''));
    setFormData(filled);
    setShowModal(true);
  };

  /* ── Save (Create / Update) ── */
  const handleSave = async () => {
    setSaving(true);
    try {
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
        // Refresh table
        await fetchTab(activeTab);
      } else {
        alert(json.message || 'Save failed');
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
                  {columns.map((col) => (
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
                {rows.map((row: any, idx: number) => (
                  <tr
                    key={row.id ?? idx}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background border-border shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${currentTab.color} flex items-center justify-center text-base shadow-md`}
                >
                  {currentTab.icon}
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-base leading-none">
                    {editingRow ? 'Edit Record' : 'Add New Record'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentTab.label} — {editingRow ? `#${editingRow[currentTab.idColumn]}` : 'New'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6">
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
                      <input
                        type="text"
                        value={formData[col] ?? ''}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, [col]: e.target.value }))
                        }
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all placeholder:text-muted-foreground/50"
                        placeholder={`Enter ${formatColHeader(col)}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || editableCols.length === 0}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      {editingRow ? 'Save Changes' : 'Create Record'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

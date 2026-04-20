'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StageHeader from '@/components/stage-header';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

const ALL_PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'order-dispatch', label: 'Order Dispatch Planning' },
  { id: 'oil-indent', label: 'Oil Indent' },
  { id: 'oil-indent-approval', label: 'Oil Indent Approval' },
  { id: 'lab-confirmation', label: 'Lab Confirmation' },
  { id: 'dispatch-planning', label: 'Actual Dispatch' },
  { id: 'oil-receipt', label: 'Oil Receipt' },
  { id: 'packing-raw-material', label: 'Packing Raw Material Indent' },
  { id: 'raw-material-issue', label: 'Raw Material Issue' },
  { id: 'raw-material-receipt', label: 'Raw Material Receipt' },
  { id: 'production-entry', label: 'Production Entry' },
  { id: 'balance-material', label: 'Balance Material Receipt' },
  { id: 'stock-in', label: 'Stock In' },
  { id: 'reports', label: 'Reports' },
  { id: 'master', label: 'Master' },
];

const DEFAULT_FORM = {
  username: '', password: '', email: '', phoneNo: '', role: 'user',
  status: 'active', allowedPages: ALL_PAGES.map(p => p.id)
};

export default function Settings() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`);
      const data = await res.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setEditingUser(null);
    setForm({ ...DEFAULT_FORM });
    setShowForm(true);
  };

  const openEdit = (user: any) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      email: user.email || '',
      phoneNo: user.phone_no || '',
      role: user.role,
      status: user.status,
      allowedPages: user.allowed_pages || ALL_PAGES.map(p => p.id)
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
    fetchUsers();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingUser
      ? `${API_BASE_URL}/users/${editingUser.id}`
      : `${API_BASE_URL}/users`;
    const method = editingUser ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setShowForm(false);
      fetchUsers();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to save user');
    }
  };

  const togglePage = (pageId: string) => {
    setForm(prev => ({
      ...prev,
      allowedPages: prev.allowedPages.includes(pageId)
        ? prev.allowedPages.filter(p => p !== pageId)
        : [...prev.allowedPages, pageId]
    }));
  };

  if (!isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground mt-2">Only admins can access the Settings page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <StageHeader title="Settings — User Management" description="Manage user accounts, roles, and page access" />

      <div className="flex justify-end mb-6">
        <Button onClick={openAdd} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <Card className="overflow-hidden border-border shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Page Access</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-primary font-bold">{user.id}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{user.username}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{user.email || '-'}</td>
                  <td className="px-4 py-3 text-sm">{user.phone_no || '-'}</td>
                  <td className="px-4 py-3">
                    <Badge className={user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {user.role === 'admin' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">All Pages</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(user.allowed_pages || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">No pages</span>
                        ) : (
                          (user.allowed_pages || []).map((pageId: string) => {
                            const pageLabel = ALL_PAGES.find(p => p.id === pageId)?.label || pageId;
                            return (
                              <span key={pageId} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                {pageLabel}
                              </span>
                            );
                          })
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700 hover:border-red-300" onClick={() => handleDelete(user.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit User Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background p-6 border-border shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-3">
              <h2 className="text-xl font-bold text-foreground">{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Username *</label>
                  <input required value={form.username} onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="username" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Password {editingUser && <span className="text-muted-foreground font-normal text-xs">(leave blank to keep)</span>}
                  </label>
                  <input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    required={!editingUser}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone No.</label>
                  <input value={form.phoneNo} onChange={e => setForm(prev => ({ ...prev, phoneNo: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" placeholder="9999999999" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-foreground">Page Access</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setForm(p => ({ ...p, allowedPages: ALL_PAGES.map(x => x.id) }))}
                        className="text-xs text-primary hover:underline">Select All</button>
                      <span className="text-muted-foreground text-xs">|</span>
                      <button type="button" onClick={() => setForm(p => ({ ...p, allowedPages: [] }))}
                        className="text-xs text-primary hover:underline">Clear All</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-4 border border-border rounded-lg bg-muted/20">
                    {ALL_PAGES.map(page => (
                      <label key={page.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded p-1.5 transition-colors">
                        <input type="checkbox" checked={form.allowedPages.includes(page.id)}
                          onChange={() => togglePage(page.id)}
                          className="w-3.5 h-3.5 rounded text-primary focus:ring-primary" />
                        <span className="text-sm text-foreground">{page.label}</span>
                      </label>
                    ))}
                  </div>
                </div>


              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit">{editingUser ? 'Save Changes' : 'Create User'}</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

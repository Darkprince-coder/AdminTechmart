// src/pages/UserManagementPage.jsx  (ADMIN PROJECT — branch card fix)
// Fixes:
// 1. Branch card "Manager" label now shows the assigned user's full_name
//    from user_profiles (not the stale shops.manager_name field)
// 2. Added "Edit branch" button to update shop name, location, phone
// 3. shops.manager_name is also updated when editing a branch

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../lib/utils';
import '../styles/users.css';

const EMPTY_USER_FORM  = { email:'', full_name:'', role:'manager', shop_id:'' };
const EMPTY_SHOP_FORM  = { name:'', location:'', manager_name:'', phone:'' };

export default function UserManagementPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [users,       setUsers]       = useState([]);
  const [shops,       setShops]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState(false);
  const [saving,      setSaving]      = useState(false);

  // User edit form
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUserId,   setEditUserId]   = useState(null);
  const [userForm,     setUserForm]     = useState(EMPTY_USER_FORM);

  // Add / edit shop form
  const [showShopForm, setShowShopForm] = useState(false);
  const [editShopId,   setEditShopId]   = useState(null); // null = add new
  const [shopForm,     setShopForm]     = useState(EMPTY_SHOP_FORM);
  const [savingShop,   setSavingShop]   = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [usersRes, shopsRes] = await Promise.all([
      supabase.from('user_profiles').select('*, shops(name, location)').order('created_at'),
      supabase.from('shops').select('*').eq('is_active', true).order('name'),
    ]);
    if (usersRes.error || shopsRes.error) {
      setLoadError(true);
      setUsers([]);
      setShops([]);
      toastRef.current.error(
        usersRes.error?.message || shopsRes.error?.message || 'Could not load users or branches.',
      );
    } else {
      setUsers(usersRes.data  || []);
      setShops(shopsRes.data  || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- User form ----
  const openEditUser = u => {
    setEditUserId(u.id);
    setUserForm({
      email:     u.email     || '',
      full_name: u.full_name || '',
      role:      u.role      || 'manager',
      shop_id:   u.shop_id   || '',
    });
    setShowUserForm(true);
  };
  const cancelUserForm = () => { setShowUserForm(false); setEditUserId(null); setUserForm(EMPTY_USER_FORM); };

  const handleSaveUser = async () => {
    const { full_name, role, shop_id } = userForm;
    if (role === 'manager' && !shop_id)
      return toastRef.current.error('Managers must be assigned to a branch');

    setSaving(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: full_name.trim() || null, role, shop_id: shop_id || null })
      .eq('id', editUserId);

    if (error) {
      toastRef.current.error('Update failed: ' + error.message);
    } else {
      toastRef.current.success('User updated');
      cancelUserForm();
      fetchAll();
    }
    setSaving(false);
  };

  const handleToggleActive = async u => {
    const action = u.is_active ? 'deactivate' : 'reactivate';
    if (!window.confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} ${u.email}?`)) return;
    const { error } = await supabase
      .from('user_profiles').update({ is_active: !u.is_active }).eq('id', u.id);
    if (error) toastRef.current.error('Failed: ' + error.message);
    else { toastRef.current.success(`User ${action}d`); fetchAll(); }
  };

  // ---- Shop form (add + edit) ----
  const openAddShop = () => {
    setEditShopId(null);
    setShopForm(EMPTY_SHOP_FORM);
    setShowShopForm(true);
  };

  const openEditShop = s => {
    setEditShopId(s.id);
    setShopForm({
      name:         s.name         || '',
      location:     s.location     || '',
      manager_name: s.manager_name || '',
      phone:        s.phone        || '',
    });
    setShowShopForm(true);
  };

  const cancelShopForm = () => { setShowShopForm(false); setEditShopId(null); setShopForm(EMPTY_SHOP_FORM); };

  const handleSaveShop = async () => {
    if (!shopForm.name.trim())     return toastRef.current.error('Shop name is required');
    if (!shopForm.location.trim()) return toastRef.current.error('Location is required');

    setSavingShop(true);
    const payload = {
      name:         shopForm.name.trim(),
      location:     shopForm.location.trim(),
      manager_name: shopForm.manager_name.trim() || null,
      phone:        shopForm.phone.trim()        || null,
    };

    if (editShopId) {
      const { error } = await supabase.from('shops').update(payload).eq('id', editShopId);
      if (error) { toastRef.current.error('Update failed: ' + error.message); }
      else       { toastRef.current.success('Branch updated'); cancelShopForm(); fetchAll(); }
    } else {
      const { data, error } = await supabase.from('shops').insert(payload).select().single();
      if (error) { toastRef.current.error('Failed to add branch: ' + error.message); }
      else       { toastRef.current.success(`"${data.name}" added`); cancelShopForm(); fetchAll(); }
    }
    setSavingShop(false);
  };

  const roleLabel = role => role === 'admin' ? 'Admin' : 'Branch Manager';

  // ---- Branch card: get assigned manager name from user_profiles ----
  // FIX: previously used shops.manager_name which is a static text field.
  // Now we look up the actual assigned user from user_profiles.
  const getAssignedManager = shopId => {
    const assigned = users.filter(u => u.shop_id === shopId && u.is_active);
    if (assigned.length === 0) return null;
    // Return the first manager's display name
    return assigned.map(u => u.full_name || u.email).join(', ');
  };

  return (
    <div className="fade-in">

      {/* ---- INFO BANNER ---- */}
      <div className="um-how-it-works">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8"  x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div>
          <strong>To add a new manager:</strong> Create their account in{' '}
          <strong>Supabase Dashboard → Authentication → Users</strong>.
          Their profile will appear here automatically. Then click <strong>Edit</strong> to
          set their name, assign a branch, and confirm their role.
        </div>
      </div>

      {/* ---- BRANCHES ---- */}
      <div className="card um-section">
        <div className="card-header">
          <span className="card-title">
            Branches
            <span style={{ color:'var(--text-secondary)', fontWeight:400, fontSize:12, marginLeft:8 }}>
              {shops.length} branch{shops.length!==1?'es':''}
            </span>
          </span>
          <button className="btn btn-secondary btn-sm" onClick={openAddShop}>
            + Add branch
          </button>
        </div>

        {/* Add / Edit shop form */}
        {showShopForm && (
          <div className="um-inline-form fade-in">
            <div className="um-form-title">
              {editShopId ? 'Edit branch details' : 'New branch'}
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Shop name *</label>
                <input className="form-input" placeholder="e.g. Ezekii Electronics Kisumu"
                  value={shopForm.name}
                  onChange={e => setShopForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Location *</label>
                <input className="form-input" placeholder="e.g. Kisumu Town"
                  value={shopForm.location}
                  onChange={e => setShopForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Manager name (display only)</label>
                <input className="form-input" placeholder="e.g. Jane Achieng"
                  value={shopForm.manager_name}
                  onChange={e => setShopForm(f => ({ ...f, manager_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" placeholder="+254 7XX XXX XXX"
                  value={shopForm.phone}
                  onChange={e => setShopForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="um-form-actions">
              <button className="btn btn-ghost" onClick={cancelShopForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveShop} disabled={savingShop}>
                {savingShop ? 'Saving…' : editShopId ? 'Save changes' : 'Add branch'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="ov-loading" style={{ minHeight:80 }}><div className="spinner"/></div>
        ) : loadError ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <p style={{ color: 'var(--red)', marginBottom: 12 }}>Could not load branches.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchAll()}>Retry</button>
          </div>
        ) : shops.length === 0 ? (
          <div className="empty-state"><p>No branches yet. Add one above.</p></div>
        ) : (
          <div className="um-shops-grid">
            {shops.map(s => {
              const assignedUsers   = users.filter(u => u.shop_id === s.id);
              const managerDisplay  = getAssignedManager(s.id);
              return (
                <div key={s.id} className="um-shop-card">
                  <div className="um-shop-header">
                    <div>
                      <div className="um-shop-name">{s.name}</div>
                      <div className="um-shop-loc">{s.location}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5 }}>
                      <span className="badge badge-teal">
                        {assignedUsers.length} user{assignedUsers.length!==1?'s':''}
                      </span>
                      <button className="btn btn-ghost btn-xs"
                        onClick={() => openEditShop(s)}>
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* FIX: show live manager name from user_profiles, not hardcoded shops.manager_name */}
                  {managerDisplay ? (
                    <div className="um-shop-meta">
                      <strong>Manager:</strong> {managerDisplay}
                    </div>
                  ) : (
                    <div className="um-shop-meta" style={{ color:'var(--amber)' }}>
                      No manager assigned
                    </div>
                  )}

                  {s.phone && (
                    <div className="um-shop-meta">Phone: {s.phone}</div>
                  )}

                  {assignedUsers.length > 0 && (
                    <div className="um-shop-users">
                      {assignedUsers.map(u => (
                        <span key={u.id} className={`um-user-pill ${!u.is_active ? 'um-user-pill-inactive' : ''}`}>
                          {u.full_name || u.email}
                          {!u.is_active && ' (inactive)'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- USERS ---- */}
      <div className="card um-section">
        <div className="card-header">
          <span className="card-title">
            Users
            <span style={{ color:'var(--text-secondary)', fontWeight:400, fontSize:12, marginLeft:8 }}>
              {users.length} account{users.length!==1?'s':''}
            </span>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={fetchAll}>Refresh</button>
        </div>

        {/* User edit form */}
        {showUserForm && (
          <div className="um-inline-form um-user-form fade-in">
            <div className="um-form-title">Edit user — {userForm.email}</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full name</label>
                <input name="full_name" type="text" className="form-input"
                  placeholder="e.g. John Kamau"
                  value={userForm.full_name}
                  onChange={e => setUserForm(f => ({ ...f, full_name: e.target.value }))}
                  autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={userForm.role}
                  onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="manager">Branch Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {userForm.role === 'manager' && (
                <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                  <label className="form-label">Assigned branch *</label>
                  <select className="form-select" value={userForm.shop_id}
                    onChange={e => setUserForm(f => ({ ...f, shop_id: e.target.value }))}>
                    <option value="">— Select branch —</option>
                    {shops.map(s => (
                      <option key={s.id} value={s.id}>{s.name} — {s.location}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="um-edit-note">
              To reset a password, use Supabase Dashboard → Authentication → Users.
            </div>
            <div className="um-form-actions">
              <button className="btn btn-ghost" onClick={cancelUserForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveUser} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="ov-loading" style={{ minHeight:80 }}><div className="spinner"/></div>
        ) : loadError ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <p style={{ color: 'var(--red)', marginBottom: 12 }}>Could not load users.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchAll()}>Retry</button>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <p>
              No users yet. Create one in Supabase Dashboard → Authentication → Users,
              then refresh here to assign their role and branch.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name / Email</th><th>Role</th><th>Branch</th>
                  <th>Status</th><th>Created</th>
                  <th style={{ textAlign:'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight:500, fontSize:13 }}>
                        {u.full_name || (
                          <span style={{ color:'var(--text-tertiary)' }}>No name set</span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-secondary)' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${u.role==='admin'?'badge-teal':'badge-info'}`}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td style={{ fontSize:13 }}>
                      {u.shops ? (
                        <>
                          <div style={{ fontWeight:500 }}>{u.shops.name}</div>
                          <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
                            {u.shops.location}
                          </div>
                        </>
                      ) : (
                        <span style={{ color:'var(--amber)', fontSize:12 }}>
                          No branch assigned
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.is_active?'badge-ok':'badge-danger'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                      {fmtDate(u.created_at)}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditUser(u)}>
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${u.is_active?'btn-danger':'btn-secondary'}`}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

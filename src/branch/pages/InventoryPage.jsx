// src/branch/pages/InventoryPage.jsx  (BRANCH APP)
// Fix: handleQuickSell now does a fresh DB fetch of quantity before
// decrementing instead of using the prop value which may be stale.
// Everything else unchanged from original.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { insertAuditLog } from '../../lib/auditLog';
import { fmtKES, stockStatus, stockPct, margin } from '../lib/utils';
import NoShopAssigned from '../components/NoShopAssigned';
import '../styles/inventory-scoped.css';

const PRESET_CATEGORIES = [
  'Phones',
  'Phone Accessories',
  'Bulbs & Lighting',
  'Woofers & Speakers',
  'TVs',
  'USB Drives & Storage',
  'Cables & Chargers',
  'Batteries',
  'Earphones & Headsets',
  'Other Electronics',
];

const EMPTY_FORM = {
  name:           '',
  category:       'Phones',
  useCustom:      false,
  customCategory: '',
  buy_price:      '',
  sell_price:     '',
  quantity:       '',
  alert_qty:      '5',
};

export default function InventoryPage() {
  const { shopId, isAdmin } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [products,      setProducts]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [quickSellId,   setQuickSellId]   = useState(null);
  const [search,        setSearch]        = useState('');
  const [catFilter,     setCatFilter]     = useState('all');
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [editId,        setEditId]        = useState(null);
  const [showForm,      setShowForm]      = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchProducts = useCallback(async () => {
    if (!shopId) { setLoading(false); setFetchError(false); return; }
    setLoading(true);
    setFetchError(false);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, category, buy_price, sell_price, quantity, alert_qty, created_at')
      .eq('shop_id', shopId)
      .order('name');
    if (error) {
      console.error('Inventory fetch:', error.message);
      setFetchError(true);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }, [shopId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const stockValue   = products.reduce((a, p) => a + (p.sell_price || 0) * (p.quantity || 0), 0);
  const totalUnits   = products.reduce((a, p) => a + (p.quantity || 0), 0);
  const lowItems     = products.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) <= (p.alert_qty || 5));
  const oosItems     = products.filter(p => (p.quantity || 0) === 0);

  const usedCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  const visible = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q);
    const matchCat = catFilter === 'all' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const openEdit = p => {
    setEditId(p.id);
    const isPreset = PRESET_CATEGORIES.includes(p.category);
    setForm({
      name:           p.name,
      category:       isPreset ? p.category : PRESET_CATEGORIES[0],
      useCustom:      !isPreset,
      customCategory: isPreset ? '' : (p.category || ''),
      buy_price:      isAdmin ? (p.buy_price  ?? '') : '',
      sell_price:     isAdmin ? (p.sell_price ?? '') : '',
      quantity:       p.quantity   ?? '',
      alert_qty:      p.alert_qty  ?? 5,
    });
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    const { name, category, useCustom, customCategory,
            buy_price, sell_price, quantity, alert_qty } = form;

    if (!name.trim())                    return toastRef.current.error('Product name is required');
    if (!sell_price || +sell_price <= 0) return toastRef.current.error('Enter a valid sell price');
    if (isAdmin) {
      if (buy_price === '' || +buy_price < 0) return toastRef.current.error('Enter a valid buy price');
      if (+sell_price < +buy_price)           return toastRef.current.error('Sell price is less than buy price');
    }
    if (quantity === '' || +quantity < 0) return toastRef.current.error('Enter a valid quantity');

    const finalCategory = useCustom
      ? (customCategory.trim() || 'Other Electronics')
      : category;

    setSaving(true);
    const payload = {
      name:       name.trim(),
      category:   finalCategory,
      buy_price:  isAdmin ? +buy_price : (editId ? undefined : 0),
      sell_price: +sell_price,
      quantity:   +quantity,
      alert_qty:  +alert_qty || 5,
      shop_id:    shopId,
    };

    if (editId) {
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    }

    const { error } = editId
      ? await supabase.from('products').update(payload).eq('id', editId)
      : await supabase.from('products').insert(payload);

    if (error) {
      toastRef.current.error('Failed to save product: ' + error.message);
    } else {
      toastRef.current.success(editId ? `${name} updated` : `${name} added to inventory`);
      cancelForm();
      fetchProducts();
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteConfirm.id);
    if (error) {
      toastRef.current.error('Delete failed: ' + error.message);
    } else {
      insertAuditLog({
        action: 'product_delete',
        entityType: 'product',
        entityId: deleteConfirm.id,
        metadata: {
          portal: 'branch',
          shop_id: shopId,
          name: deleteConfirm.name,
          category: deleteConfirm.category,
        },
      });
      toastRef.current.success(`${deleteConfirm.name} removed from inventory`);
      fetchProducts();
    }
    setDeleteConfirm(null);
  };

  // ── Quick sell ─────────────────────────────────────────────────────────────
  // FIX: fresh DB fetch before decrementing to avoid race condition.
  // Previously used p.quantity from the product prop which could be stale
  // if the list hadn't refreshed since the last sale was recorded.
  const handleQuickSell = async p => {
    setQuickSellId(p.id);

    // Get the real current quantity from the database
    const { data: freshProduct, error: freshErr } = await supabase
      .from('products')
      .select('quantity, sell_price, buy_price, name')
      .eq('id', p.id)
      .single();

    if (freshErr || !freshProduct) {
      setQuickSellId(null);
      return toastRef.current.error('Could not verify stock — please try again');
    }

    if (freshProduct.quantity < 1) {
      setQuickSellId(null);
      return toastRef.current.error('Out of stock!');
    }

    const { error: stockErr } = await supabase
      .from('products')
      .update({ quantity: freshProduct.quantity - 1 })
      .eq('id', p.id);

    if (stockErr) {
      setQuickSellId(null);
      return toastRef.current.error('Stock update failed');
    }

    const { error: saleErr } = await supabase.from('sales').insert({
      shop_id:       shopId,
      product_id:    p.id,
      product_name:  freshProduct.name,
      customer_name: 'Walk-in',
      quantity:      1,
      unit_price:    freshProduct.sell_price,
      buy_price:     freshProduct.buy_price,
      total_amount:  freshProduct.sell_price,
      profit:        freshProduct.sell_price - freshProduct.buy_price,
    });

    if (saleErr) {
      toastRef.current.warning('Stock updated but sale record failed');
    } else {
      toastRef.current.success(`Sold: ${freshProduct.name} — ${fmtKES(freshProduct.sell_price)}`);
    }
    setQuickSellId(null);
    fetchProducts();
  };

  const handleRestock = async (p, amount) => {
    if (!amount || amount < 1) return;
    const { error } = await supabase
      .from('products')
      .update({ quantity: (p.quantity || 0) + amount })
      .eq('id', p.id);
    if (error) {
      toastRef.current.error('Restock failed: ' + error.message);
    } else {
      toastRef.current.success(`${p.name} restocked — +${amount} units`);
      fetchProducts();
    }
  };

  if (!shopId) return <NoShopAssigned />;

  return (
    <>
    <div className="fade-up">

      {/* ---- STATS ---- */}
      <div className="grid-4 mb-md">
        {isAdmin ? (
          <div className="metric-card metric-brand">
            <div className="metric-label">Stock Value</div>
            <div className="metric-value">{fmtKES(stockValue)}</div>
            <div className="metric-sub">{products.length} products</div>
          </div>
        ) : (
          <div className="metric-card metric-brand">
            <div className="metric-label">Total Products</div>
            <div className="metric-value">{products.length}</div>
            <div className="metric-sub">{totalUnits} units in stock</div>
          </div>
        )}
        <div className="metric-card">
          <div className="metric-label">Total Units</div>
          <div className="metric-value">{totalUnits}</div>
          <div className="metric-sub">{products.length} SKUs</div>
        </div>
        <div className={`metric-card ${lowItems.length > 0 ? 'metric-amber' : ''}`}>
          <div className="metric-label">Low Stock</div>
          <div className="metric-value"
            style={{ color: lowItems.length > 0 ? 'var(--amber)' : 'inherit' }}>
            {lowItems.length}
          </div>
          <div className={`metric-sub ${lowItems.length > 0 ? 'warn' : ''}`}>
            {lowItems.length > 0 ? 'need restocking' : 'all good'}
          </div>
        </div>
        <div className={`metric-card ${oosItems.length > 0 ? 'metric-red' : ''}`}>
          <div className="metric-label">Out of Stock</div>
          <div className="metric-value"
            style={{ color: oosItems.length > 0 ? 'var(--red)' : 'inherit' }}>
            {oosItems.length}
          </div>
          <div className={`metric-sub ${oosItems.length > 0 ? 'danger' : ''}`}>
            {oosItems.length > 0 ? 'urgent restock' : 'all stocked'}
          </div>
        </div>
      </div>

      {/* ---- ADD / EDIT FORM ---- */}
      {showForm && (
        <div className="card inv-form-card mb-md">
          <div className="card-header">
            <span className="card-title">
              {editId ? 'Edit product' : 'Add new product'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={cancelForm}>Cancel</button>
          </div>

          <div className="inv-form">
            <div className="form-group">
              <label className="form-label">Product name *</label>
              <input
                name="name"
                className="form-input"
                placeholder="e.g. Samsung Galaxy A15, Philips 9W Bulb"
                value={form.name}
                onChange={handleChange}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              {!form.useCustom ? (
                <div className="inv-cat-select-wrap">
                  <select name="category" className="form-select"
                    value={form.category} onChange={handleChange}>
                    {PRESET_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-ghost btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setForm(f => ({ ...f, useCustom: true, customCategory: '' }))}>
                    + Custom
                  </button>
                </div>
              ) : (
                <div className="inv-cat-select-wrap">
                  <input name="customCategory" className="form-input"
                    placeholder="Type a new category name"
                    value={form.customCategory}
                    onChange={handleChange}
                    autoFocus
                  />
                  <button type="button" className="btn btn-ghost btn-sm"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setForm(f => ({ ...f, useCustom: false, customCategory: '' }))}>
                    Use preset
                  </button>
                </div>
              )}
            </div>

            <div className="grid-2">
              {isAdmin && (
                <div className="form-group">
                  <label className="form-label">Buy price (KSh) *</label>
                  <input name="buy_price" type="number" min="0" className="form-input"
                    placeholder="What you paid"
                    value={form.buy_price} onChange={handleChange} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Sell price (KSh) *</label>
                <input name="sell_price" type="number" min="0" className="form-input"
                  placeholder="What you charge"
                  value={form.sell_price} onChange={handleChange} />
              </div>
            </div>

            {isAdmin && form.buy_price && form.sell_price && (
              +form.sell_price > +form.buy_price ? (
                <div className="inv-margin-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                  Profit per unit: <strong>{fmtKES(+form.sell_price - +form.buy_price)}</strong>
                  &nbsp;({margin(+form.buy_price, +form.sell_price)}% margin)
                </div>
              ) : +form.sell_price < +form.buy_price ? (
                <div className="inv-margin-hint inv-margin-warn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  Sell price is below buy price — you would make a loss on each sale.
                </div>
              ) : null
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Quantity in stock *</label>
                <input name="quantity" type="number" min="0" className="form-input"
                  placeholder="How many units?"
                  value={form.quantity} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Low stock alert at</label>
                <input name="alert_qty" type="number" min="0" className="form-input"
                  placeholder="5"
                  value={form.alert_qty} onChange={handleChange} />
              </div>
            </div>

            <div className="inv-form-actions">
              <button className="btn btn-ghost" onClick={cancelForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}/> Saving…</>
                  : editId ? 'Save changes' : 'Add product'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- TOOLBAR ---- */}
      <div className="inv-toolbar mb-md">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="inv-cat-chips">
          <button
            className={`inv-chip ${catFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCatFilter('all')}
          >
            All ({products.length})
          </button>
          {usedCategories.map(c => {
            const count = products.filter(p => p.category === c).length;
            return (
              <button key={c}
                className={`inv-chip ${catFilter === c ? 'active' : ''}`}
                onClick={() => setCatFilter(catFilter === c ? 'all' : c)}
              >
                {c} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- PRODUCT LIST ---- */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Inventory
            <span className="inv-count">
              {visible.length} of {products.length}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={fetchProducts}>
            Refresh
          </button>
        </div>

        {fetchError && (
          <div className="inv-fetch-error">
            Could not load inventory.{' '}
            <button className="inv-retry-link" onClick={fetchProducts}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="inv-loading">
            <div className="spinner"/>
            <span>Loading inventory…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <p>
              {search || catFilter !== 'all'
                ? 'No products match your search or filter.'
                : 'No products yet. Tap "Add product" to get started.'}
            </p>
          </div>
        ) : (
          <>
            <div className="inv-mobile-list">
              {visible.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isAdmin={isAdmin}
                  isQuickSelling={quickSellId === p.id}
                  onEdit={() => openEdit(p)}
                  onSell={() => handleQuickSell(p)}
                  onDelete={() => setDeleteConfirm(p)}
                  onRestock={amt => handleRestock(p, amt)}
                />
              ))}
            </div>

            <div className="table-wrap inv-desktop-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    {isAdmin && <th>Buy</th>}
                    <th>Sell</th>
                    {isAdmin && <th>Margin</th>}
                    <th>Qty</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(p => {
                    const { status, label } = stockStatus(p.quantity || 0, p.alert_qty || 5);
                    const pct = stockPct(p.quantity || 0, p.alert_qty || 5);
                    const mg  = margin(p.buy_price || 0, p.sell_price || 0);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td><span className="badge badge-info">{p.category || '—'}</span></td>
                        {isAdmin && <td style={{ fontSize: 12 }}>{fmtKES(p.buy_price)}</td>}
                        <td style={{ fontSize: 12 }}>{fmtKES(p.sell_price)}</td>
                        {isAdmin && (
                          <td>
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: mg >= 20 ? 'var(--brand)' : mg > 0 ? 'var(--amber)' : 'var(--red)',
                            }}>
                              {mg}%
                            </span>
                          </td>
                        )}
                        <td>
                          <div className="inv-stock-cell">
                            <span style={{ fontWeight: 600, minWidth: 24 }}>{p.quantity ?? 0}</span>
                            <div className="progress-wrap">
                              <div className={`progress-fill progress-${status}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge badge-${status}`}>{label}</span></td>
                        <td>
                          <div className="inv-actions">
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => handleQuickSell(p)}
                              disabled={(p.quantity || 0) === 0 || quickSellId === p.id}>
                              {quickSellId === p.id ? (
                                <><span className="spinner spinner-sm" /> Selling…</>
                              ) : 'Sell 1'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => setDeleteConfirm(p)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>

    {deleteConfirm && (
      <div className="overlay-bg" onClick={() => setDeleteConfirm(null)}>
        <div className="overlay-card" onClick={e => e.stopPropagation()}>
          <div className="overlay-title">Delete product?</div>
          <div className="overlay-body">
            This will permanently remove <strong>{deleteConfirm.name}</strong> from
            your inventory. This action cannot be undone.
          </div>
          <div className="overlay-actions">
            <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function ProductCard({ product: p, isAdmin, isQuickSelling, onEdit, onSell, onDelete, onRestock }) {
  const [showRestock, setShowRestock] = useState(false);
  const [restockAmt,  setRestockAmt]  = useState('');
  const { status, label } = stockStatus(p.quantity || 0, p.alert_qty || 5);
  const mg = margin(p.buy_price || 0, p.sell_price || 0);

  return (
    <div className={`inv-product-card ${status === 'danger' ? 'inv-card-oos' : status === 'warn' ? 'inv-card-low' : ''}`}>
      <div className="inv-product-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="inv-product-name">{p.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <span className="badge badge-info">{p.category || '—'}</span>
            <span className={`badge badge-${status}`}>{label}</span>
          </div>
        </div>
        <div className="inv-product-qty" style={{
          color: status === 'danger' ? 'var(--red)' : status === 'warn' ? 'var(--amber)' : 'var(--brand)',
        }}>
          {p.quantity ?? 0}
          <span style={{ fontSize: 10, fontWeight: 400, display: 'block', textAlign: 'center' }}>units</span>
        </div>
      </div>

      <div className="progress-wrap" style={{ width: '100%', height: 5, margin: '4px 0 10px' }}>
        <div className={`progress-fill progress-${status}`}
          style={{ width: `${stockPct(p.quantity || 0, p.alert_qty || 5)}%` }} />
      </div>

      <div className="inv-product-prices">
        {isAdmin ? (
          <>
            <div className="inv-price-item">
              <span className="metric-label">Buy price</span>
              <span className="inv-price-val">{fmtKES(p.buy_price)}</span>
            </div>
            <div className="inv-price-item">
              <span className="metric-label">Sell price</span>
              <span className="inv-price-val">{fmtKES(p.sell_price)}</span>
            </div>
            <div className="inv-price-item">
              <span className="metric-label">Profit/unit</span>
              <span className="inv-price-val"
                style={{ color: mg >= 20 ? 'var(--brand)' : mg > 0 ? 'var(--amber)' : 'var(--red)' }}>
                {fmtKES((p.sell_price || 0) - (p.buy_price || 0))}
              </span>
            </div>
            <div className="inv-price-item">
              <span className="metric-label">Margin</span>
              <span className="inv-price-val"
                style={{ color: mg >= 20 ? 'var(--brand)' : mg > 0 ? 'var(--amber)' : 'var(--red)' }}>
                {mg}%
              </span>
            </div>
          </>
        ) : (
          <div className="inv-price-item">
            <span className="metric-label">Sell price</span>
            <span className="inv-price-val">{fmtKES(p.sell_price)}</span>
          </div>
        )}
      </div>

      {showRestock && (
        <div className="inv-restock-row">
          <input type="number" min="1" className="form-input" style={{ flex: 1 }}
            placeholder="Units to add"
            value={restockAmt}
            onChange={e => setRestockAmt(e.target.value)}
            autoFocus
          />
          <button className="btn btn-secondary btn-sm"
            onClick={() => {
              if (+restockAmt > 0) {
                onRestock(+restockAmt);
                setShowRestock(false);
                setRestockAmt('');
              }
            }}>
            Confirm
          </button>
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setShowRestock(false); setRestockAmt(''); }}>
            Cancel
          </button>
        </div>
      )}

      <div className="inv-product-actions">
        <button className="btn btn-secondary btn-sm" onClick={onSell}
          disabled={(p.quantity || 0) === 0 || isQuickSelling}>
          {isQuickSelling ? (
            <><span className="spinner spinner-sm" /> Selling…</>
          ) : 'Sell 1'}
        </button>
        <button className="btn btn-ghost btn-sm"
          onClick={() => setShowRestock(v => !v)}>
          Restock
        </button>
      </div>
    </div>
  );
}

// src/pages/InventoryPage.jsx  (ADMIN PROJECT)
// Schema: products.quantity, alert_qty, buy_price, sell_price, category

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { fmtKES, stockStatus, stockPct, margin } from '../lib/utils';
import { downloadLowStockReorderPdf } from '../lib/pdfExport';
import { insertAuditLog } from '../lib/auditLog';
import '../styles/inventory.css';

// Ezekii Electronics categories (matches branch app)
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
  shop_id:        '',
};

export default function InventoryPage() {
  const { shops, activeShopId } = useShop();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('all');
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [editId,     setEditId]     = useState(null);
  const [showForm,   setShowForm]   = useState(false);

  // Default shop_id in form when branch filter changes
  useEffect(() => {
    const defaultShop = activeShopId !== 'all' ? activeShopId : (shops[0]?.id || '');
    setForm(f => ({ ...f, shop_id: defaultShop }));
  }, [activeShopId, shops]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    let q = supabase
      .from('products')
      .select('id, name, category, buy_price, sell_price, quantity, alert_qty, shop_id, shops(name)')
      .order('name');
    if (activeShopId !== 'all') q = q.eq('shop_id', activeShopId);
    const { data, error } = await q;
    if (error) {
      console.error('Inventory fetch:', error.message);
      setFetchError(true);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }, [activeShopId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Derived
  const totalValue = products.reduce((a, p) => a + (p.sell_price||0) * (p.quantity||0), 0);
  const lowCount   = products.filter(p => (p.quantity||0) <= (p.alert_qty||5) && (p.quantity||0) > 0).length;
  const oosCount   = products.filter(p => (p.quantity||0) === 0).length;

  const lowStockExportRows = useMemo(
    () =>
      products
        .filter(p => (p.quantity || 0) <= (p.alert_qty || 5))
        .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
        .map(p => ({
          name: p.name,
          category: p.category,
          branch: p.shops?.name,
          qty: p.quantity ?? 0,
          alert: p.alert_qty ?? 5,
          buy: p.buy_price ?? 0,
          sell: p.sell_price ?? 0,
          status: (p.quantity || 0) === 0 ? 'Out of stock' : 'Low stock',
        })),
    [products],
  );

  const exportShopLabel =
    activeShopId === 'all' ? 'All branches' : shops.find(s => s.id === activeShopId)?.name || 'Branch';

  const handleExportReorderPdf = () => {
    try {
      downloadLowStockReorderPdf({
        shopLabel: exportShopLabel,
        rangeNote: 'Current stock (Inventory)',
        rows: lowStockExportRows,
        showBranchColumn: activeShopId === 'all',
      });
      toastRef.current.success('Supplier reorder PDF downloaded');
    } catch (err) {
      console.error(err);
      toastRef.current.error(err?.message || 'PDF export failed');
    }
  };

  const usedCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

  const visible = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.shops?.name || '').toLowerCase().includes(q);
    const matchCat = catFilter === 'all' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const openAdd = () => {
    setEditId(null);
    const defaultShop = activeShopId !== 'all' ? activeShopId : (shops[0]?.id || '');
    setForm({ ...EMPTY_FORM, shop_id: defaultShop });
    setShowForm(true);
  };

  const openEdit = p => {
    setEditId(p.id);
    const isPreset = PRESET_CATEGORIES.includes(p.category);
    setForm({
      name:           p.name,
      category:       isPreset ? p.category : PRESET_CATEGORIES[0],
      useCustom:      !isPreset,
      customCategory: isPreset ? '' : (p.category || ''),
      buy_price:      p.buy_price  ?? '',
      sell_price:     p.sell_price ?? '',
      quantity:       p.quantity   ?? '',
      alert_qty:      p.alert_qty  ?? 5,
      shop_id:        p.shop_id,
    });
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    const { name, buy_price, sell_price, quantity, alert_qty,
            shop_id, category, useCustom, customCategory } = form;

    if (!name.trim())                    return toastRef.current.error('Product name is required');
    if (!shop_id)                        return toastRef.current.error('Select a branch');
    if (buy_price === '' || +buy_price < 0)   return toastRef.current.error('Enter a valid buy price');
    if (!sell_price || +sell_price <= 0) return toastRef.current.error('Enter a valid sell price');
    if (quantity === '' || +quantity < 0) return toastRef.current.error('Enter a valid quantity');

    const finalCategory = useCustom
      ? (customCategory.trim() || 'Other Electronics')
      : category;

    setSaving(true);
    const payload = {
      name: name.trim(), category: finalCategory, shop_id,
      buy_price: +buy_price, sell_price: +sell_price,
      quantity: +quantity, alert_qty: +alert_qty || 5,
    };

    const { error } = editId
      ? await supabase.from('products').update(payload).eq('id', editId)
      : await supabase.from('products').insert(payload);

    if (error) {
      toastRef.current.error('Save failed: ' + error.message);
    } else {
      toastRef.current.success(editId ? 'Product updated' : `${name.trim()} added`);
      cancelForm();
      fetchProducts();
    }
    setSaving(false);
  };

  const handleDelete = async p => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) toastRef.current.error('Delete failed: ' + error.message);
    else {
      insertAuditLog({
        action: 'product_delete',
        entityType: 'product',
        entityId: p.id,
        metadata: { name: p.name, shop_id: p.shop_id, category: p.category },
      });
      toastRef.current.success(`${p.name} deleted`);
      fetchProducts();
    }
  };

  const handleQuickSell = async p => {
    if ((p.quantity||0) < 1) return toastRef.current.error('Out of stock!');
    const { error: sErr } = await supabase
      .from('products').update({ quantity: p.quantity - 1 }).eq('id', p.id);
    if (sErr) return toastRef.current.error('Stock update failed');
    await supabase.from('sales').insert({
      shop_id: p.shop_id, product_id: p.id,
      product_name: p.name, customer_name: 'Walk-in',
      quantity: 1, unit_price: p.sell_price, buy_price: p.buy_price,
    });
    toastRef.current.success(`Sold: ${p.name} — ${fmtKES(p.sell_price)}`);
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

  return (
    <div className="fade-in">

      {/* ---- STATS ---- */}
      <div className="grid-4 mb-md">
        <div className="metric-card">
          <div className="metric-label">Stock Value</div>
          <div className="metric-value" style={{ fontSize: 18 }}>{fmtKES(totalValue)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total SKUs</div>
          <div className="metric-value" style={{ fontSize: 18 }}>{products.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Low Stock</div>
          <div className="metric-value"
            style={{ fontSize: 18, color: lowCount > 0 ? 'var(--amber)' : 'inherit' }}>
            {lowCount}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Out of Stock</div>
          <div className="metric-value"
            style={{ fontSize: 18, color: oosCount > 0 ? 'var(--red)' : 'inherit' }}>
            {oosCount}
          </div>
        </div>
      </div>

      {/* ---- TOOLBAR ---- */}
      <div className="inv-toolbar mb-md">
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search by name, category or branch…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="inv-cat-filters">
          <button
            className={`btn btn-sm ${catFilter === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setCatFilter('all')}>
            All
          </button>
          {usedCategories.map(c => (
            <button key={c}
              className={`btn btn-sm ${catFilter === c ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setCatFilter(catFilter === c ? 'all' : c)}>
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm inv-export-pdf-btn"
          onClick={handleExportReorderPdf}
          disabled={lowStockExportRows.length === 0}
          title={lowStockExportRows.length === 0 ? 'No low or out-of-stock items' : 'Download PDF for suppliers'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Reorder PDF
        </button>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add product</button>
      </div>

      {/* ---- ADD / EDIT FORM ---- */}
      {showForm && (
        <div className="card inv-form-card mb-md fade-in">
          <div className="card-header">
            <span className="card-title">{editId ? 'Edit product' : 'Add new product'}</span>
            <button className="btn btn-ghost btn-sm" onClick={cancelForm}>Cancel</button>
          </div>
          <div className="inv-form">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product name *</label>
                <input name="name" className="form-input"
                  placeholder="e.g. Samsung Galaxy A15"
                  value={form.name} onChange={handleChange} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                {!form.useCustom ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select name="category" className="form-select"
                      value={form.category} onChange={handleChange} style={{ flex: 1 }}>
                      {PRESET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button type="button" className="btn btn-ghost btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      onClick={() => setForm(f => ({ ...f, useCustom: true, customCategory: '' }))}>
                      + Custom
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input name="customCategory" className="form-input"
                      placeholder="Type new category name"
                      value={form.customCategory} onChange={handleChange}
                      style={{ flex: 1 }} autoFocus />
                    <button type="button" className="btn btn-ghost btn-sm"
                      style={{ whiteSpace: 'nowrap' }}
                      onClick={() => setForm(f => ({ ...f, useCustom: false, customCategory: '' }))}>
                      Use preset
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Buy price (KSh) *</label>
                <input name="buy_price" type="number" min="0" className="form-input"
                  placeholder="Cost price" value={form.buy_price} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Sell price (KSh) *</label>
                <input name="sell_price" type="number" min="0" className="form-input"
                  placeholder="Retail price" value={form.sell_price} onChange={handleChange} />
              </div>
            </div>

            {form.buy_price && form.sell_price && +form.sell_price > +form.buy_price && (
              <div className="inv-margin-hint">
                Profit per unit: {fmtKES(+form.sell_price - +form.buy_price)}
                &nbsp;({margin(+form.buy_price, +form.sell_price)}% margin)
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input name="quantity" type="number" min="0" className="form-input"
                  value={form.quantity} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Low stock alert at</label>
                <input name="alert_qty" type="number" min="0" className="form-input"
                  placeholder="5" value={form.alert_qty} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Branch *</label>
              <select name="shop_id" className="form-select"
                value={form.shop_id} onChange={handleChange}>
                <option value="">— Select branch —</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name} — {s.location}</option>)}
              </select>
            </div>

            <div className="inv-form-actions">
              <button className="btn btn-ghost" onClick={cancelForm}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- TABLE ---- */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {activeShopId === 'all'
              ? 'All inventory'
              : `Inventory — ${shops.find(s => s.id === activeShopId)?.name}`}
            <span style={{ color:'var(--text-secondary)', fontWeight:400, fontSize:12, marginLeft:8 }}>
              {visible.length} product{visible.length !== 1 ? 's' : ''}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={fetchProducts}>Refresh</button>
        </div>

        {fetchError && (
          <div style={{ padding: '10px 0', color: 'var(--red)', fontSize: 13 }}>
            Failed to load.{' '}
            <button style={{ color:'var(--teal)', background:'none', border:'none',
              cursor:'pointer', textDecoration:'underline', fontSize:13 }}
              onClick={fetchProducts}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="ov-loading" style={{ minHeight: 120 }}>
            <div className="spinner"/><span>Loading…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p>{search || catFilter !== 'all'
              ? 'No products match your filter.'
              : 'No products yet. Click "Add product" to get started.'}</p>
          </div>
        ) : (
          <>
            <div className="inv-mobile-list">
              {visible.map(p => (
                <AdminProductCard
                  key={p.id}
                  product={p}
                  showBranch={activeShopId === 'all'}
                  onEdit={() => openEdit(p)}
                  onSell={() => handleQuickSell(p)}
                  onDelete={() => handleDelete(p)}
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
                    {activeShopId === 'all' && <th>Branch</th>}
                    <th>Buy</th>
                    <th>Sell</th>
                    <th>Margin</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(p => {
                    const { status, label } = stockStatus(p.quantity||0, p.alert_qty||5);
                    const pct = stockPct(p.quantity||0, p.alert_qty||5);
                    const mg  = margin(p.buy_price||0, p.sell_price||0);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td><span className="badge badge-info">{p.category || '—'}</span></td>
                        {activeShopId === 'all' && (
                          <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                            {p.shops?.name || '—'}
                          </td>
                        )}
                        <td style={{ fontSize: 12 }}>{fmtKES(p.buy_price)}</td>
                        <td style={{ fontSize: 12 }}>{fmtKES(p.sell_price)}</td>
                        <td style={{ fontSize:12, fontWeight:600,
                          color: mg>=20?'var(--teal)':mg>0?'var(--amber)':'var(--red)' }}>
                          {mg}%
                        </td>
                        <td>
                          <div className="inv-stock-cell">
                            <span style={{ fontWeight: 600 }}>{p.quantity ?? 0}</span>
                            <div className="progress-wrap">
                              <div className={`progress-fill progress-${status}`}
                                style={{ width: `${pct}%` }}/>
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge badge-${status}`}>{label}</span></td>
                        <td>
                          <div className="inv-actions">
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => handleQuickSell(p)}
                              disabled={(p.quantity||0) === 0}>
                              Sell 1
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>
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
  );
}

function AdminProductCard({ product: p, showBranch, onEdit, onSell, onDelete, onRestock }) {
  const [showRestock, setShowRestock] = useState(false);
  const [restockAmt, setRestockAmt] = useState('');
  const { status, label } = stockStatus(p.quantity || 0, p.alert_qty || 5);
  const mg = margin(p.buy_price || 0, p.sell_price || 0);

  return (
    <div className={`inv-product-card ${status === 'danger' ? 'inv-card-oos' : status === 'warn' ? 'inv-card-low' : ''}`}>
      <div className="inv-product-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="inv-product-name">{p.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-info">{p.category || '—'}</span>
            <span className={`badge badge-${status}`}>{label}</span>
            {showBranch && (
              <span className="inv-product-branch">{p.shops?.name || 'Branch not set'}</span>
            )}
          </div>
        </div>
        <div
          className="inv-product-qty"
          style={{
            color: status === 'danger' ? 'var(--red)' : status === 'warn' ? 'var(--amber)' : 'var(--teal)',
          }}
        >
          {p.quantity ?? 0}
          <span style={{ fontSize: 10, fontWeight: 400, display: 'block', textAlign: 'center' }}>units</span>
        </div>
      </div>

      <div className="progress-wrap" style={{ width: '100%', height: 5, margin: '4px 0 10px' }}>
        <div
          className={`progress-fill progress-${status}`}
          style={{ width: `${stockPct(p.quantity || 0, p.alert_qty || 5)}%` }}
        />
      </div>

      <div className="inv-product-prices">
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
          <span
            className="inv-price-val"
            style={{ color: mg >= 20 ? 'var(--teal)' : mg > 0 ? 'var(--amber)' : 'var(--red)' }}
          >
            {fmtKES((p.sell_price || 0) - (p.buy_price || 0))}
          </span>
        </div>
        <div className="inv-price-item">
          <span className="metric-label">Margin</span>
          <span
            className="inv-price-val"
            style={{ color: mg >= 20 ? 'var(--teal)' : mg > 0 ? 'var(--amber)' : 'var(--red)' }}
          >
            {mg}%
          </span>
        </div>
      </div>

      {showRestock && (
        <div className="inv-restock-row">
          <input
            type="number"
            min="1"
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Units to add"
            value={restockAmt}
            onChange={e => setRestockAmt(e.target.value)}
            autoFocus
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (+restockAmt > 0) {
                onRestock(+restockAmt);
                setShowRestock(false);
                setRestockAmt('');
              }
            }}
          >
            Confirm
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setShowRestock(false); setRestockAmt(''); }}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="inv-product-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={onSell}
          disabled={(p.quantity || 0) === 0}
        >
          Sell 1
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowRestock(v => !v)}
        >
          Restock
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

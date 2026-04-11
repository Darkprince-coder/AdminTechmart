// src/pages/SalesPage.jsx  (BRANCH APP — bug fixes)
// Fixes:
// 1. Delete: optimistically removes record from local state immediately
//    so it disappears instantly without waiting for a full re-fetch
// 2. Added 'deleting' state so button shows "Deleting…" instead of freezing
// 3. fetchSales no longer sets loading=true on refresh (only on first load)
//    so the list doesn't flash a spinner after every record/delete action

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { fmtKES, fmtDate, fmtTime, isToday } from '../lib/utils';
import NoShopAssigned from '../components/NoShopAssigned';
import '../styles/sales-scoped.css';

const EMPTY_FORM = {
  product_id:    '',
  quantity:      '1',
  unit_price:    '',
  customer_name: '',
};

export default function SalesPage({ onNavigate }) {
  const { shopId } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [sales,         setSales]         = useState([]);
  const [products,      setProducts]      = useState([]);
  const [loading,       setLoading]       = useState(true);   // only true on first load
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(false);  // FIX: loading state for delete
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [search,        setSearch]        = useState('');
  const [filterToday,   setFilterToday]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ---- Fetch sales — showLoading only on first load ----
  const fetchSales = useCallback(async (showLoading = false) => {
    if (!shopId) {
      if (showLoading) setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('id, product_name, customer_name, quantity, unit_price, buy_price, total_amount, profit, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) console.error('Sales fetch:', error.message);
    else setSales(data || []);
    if (showLoading) setLoading(false);
  }, [shopId]);

  // ---- Fetch in-stock products ----
  const fetchProducts = useCallback(async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from('products')
      .select('id, name, sell_price, buy_price, quantity')
      .eq('shop_id', shopId)
      .gt('quantity', 0)
      .order('name');
    setProducts(data || []);
    if (data && data.length > 0) {
      setForm(f => ({
        ...f,
        product_id: f.product_id || data[0].id,
        unit_price: f.product_id ? f.unit_price : String(data[0].sell_price),
      }));
    }
  }, [shopId]);

  // Initial load — show spinner
  useEffect(() => {
    fetchSales(true);
    fetchProducts();
  }, [fetchSales, fetchProducts]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => {
      const updated = { ...f, [name]: value };
      if (name === 'product_id') {
        const p = products.find(x => x.id === value);
        if (p) updated.unit_price = String(p.sell_price);
      }
      return updated;
    });
  };

  const selectedProduct = products.find(p => p.id === form.product_id) || null;

  // ---- Record sale ----
  const handleRecord = async () => {
    const { product_id, quantity, unit_price, customer_name } = form;
    if (!product_id)                    return toastRef.current.error('Select a product');
    if (!quantity || +quantity < 1)     return toastRef.current.error('Quantity must be at least 1');
    if (!unit_price || +unit_price <= 0) return toastRef.current.error('Enter a valid price');

    const product = products.find(p => p.id === product_id);
    if (!product) return toastRef.current.error('Product not found — refresh and try again');
    if (+quantity > product.quantity)
      return toastRef.current.error(`Only ${product.quantity} unit${product.quantity !== 1 ? 's' : ''} in stock`);

    setSaving(true);

    // Decrement stock
    const { error: stockErr } = await supabase
      .from('products')
      .update({ quantity: product.quantity - +quantity })
      .eq('id', product_id);

    if (stockErr) {
      toastRef.current.error('Stock update failed: ' + stockErr.message);
      setSaving(false);
      return;
    }

    // Record sale
    const { data: newSale, error: saleErr } = await supabase
      .from('sales')
      .insert({
        shop_id:       shopId,
        product_id,
        product_name:  product.name,
        customer_name: customer_name.trim() || 'Walk-in',
        quantity:      +quantity,
        unit_price:    +unit_price,
        buy_price:     product.buy_price,
      })
      .select('id, product_name, customer_name, quantity, unit_price, buy_price, total_amount, profit, created_at')
      .single();

    if (saleErr) {
      // Roll back stock
      await supabase.from('products').update({ quantity: product.quantity }).eq('id', product_id);
      toastRef.current.error('Sale record failed: ' + saleErr.message);
    } else {
      const profit = (+unit_price - product.buy_price) * +quantity;
      toastRef.current.success(`Sale recorded — Profit: ${fmtKES(profit)}`);
      // Optimistically prepend the new sale to state
      if (newSale) setSales(prev => [newSale, ...prev]);
      setForm(f => ({ ...f, quantity: '1', customer_name: '' }));
      // Refresh products list (stock changed)
      fetchProducts();
    }
    setSaving(false);
  };

// ---- Delete sale ----
// FIX: optimistic removal + deleting state + awaited properly
const handleDeleteSale = async () => {
  if (!deleteConfirm) return;
  setDeleting(true);
  // Restore stock — find product by name in this shop
  const { data: prod } = await supabase
    .from('products')
    .select('id, quantity')
    .eq('shop_id', shopId)
    .eq('name', deleteConfirm.product_name)
    .maybeSingle();

  if (prod) {
    await supabase
      .from('products')
      .update({ quantity: prod.quantity + deleteConfirm.quantity })
      .eq('id', prod.id);
  }

  // Delete the sale record
  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', deleteConfirm.id);

  if (error) {
    toastRef.current.error('Delete failed: ' + error.message);
    // Roll back stock restore on failure
    if (prod) {
      await supabase.from('products')
        .update({ quantity: prod.quantity })
        .eq('id', prod.id);
    }
  } else {
    // FIX: immediately remove from local state — no waiting for re-fetch
    setSales(prev => prev.filter(s => s.id !== deleteConfirm.id));
    toastRef.current.success('Sale deleted and stock restored');
    // Refresh products in background so stock shows correctly
    fetchProducts();
  }

  setDeleting(false);
  setDeleteConfirm(null);
};

  if (!shopId) return <NoShopAssigned />;

  // ---- Metrics ----
  const todaySales  = sales.filter(s => isToday(s.created_at));
  const todayRev    = todaySales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const todayProfit = todaySales.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const todayUnits  = todaySales.reduce((a, s) => a + (s.quantity           || 0), 0);
  const todayMargin = todayRev > 0 ? Math.round((todayProfit / todayRev) * 100) : 0;
  const allRev      = sales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const allProfit   = sales.reduce((a, s) => a + Number(s.profit       || 0), 0);

  const baseList = filterToday ? todaySales : sales;
  const visible  = search
    ? baseList.filter(s =>
        s.product_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.customer_name || '').toLowerCase().includes(search.toLowerCase()))
    : baseList;

  const priceNote = () => {
    if (!selectedProduct || !form.unit_price) return null;
    const diff = +form.unit_price - selectedProduct.sell_price;
    if (diff === 0) return null;
    if (diff > 0) return { type: 'up',   text: `${fmtKES(diff)} above standard price` };
    return             { type: 'down', text: `${fmtKES(Math.abs(diff))} below standard price` };
  };
  const note = priceNote();

  return (
    <>
    <div className="fade-up">

      {/* ---- METRICS ---- */}
      <div className="grid-4 mb-md">
        <div className="metric-card metric-brand">
          <div className="metric-label">Today's Revenue</div>
          <div className="metric-value">{fmtKES(todayRev)}</div>
          <div className="metric-sub up">{todaySales.length} transaction{todaySales.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="metric-card metric-brand">
          <div className="metric-label">Today's Profit</div>
          <div className="metric-value" style={{ color: 'var(--brand)' }}>{fmtKES(todayProfit)}</div>
          <div className="metric-sub up">{todayMargin}% margin</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Units Sold Today</div>
          <div className="metric-value">{todayUnits}</div>
          <div className="metric-sub">{todaySales.length} transactions</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">All-time Revenue</div>
          <div className="metric-value">{fmtKES(allRev)}</div>
          <div className="metric-sub">{sales.length} total sales</div>
        </div>
      </div>

      {/* ---- RECORD FORM + SUMMARY ---- */}
      <div className="sales-main-grid mb-md">

        {/* Form */}
        <div className="card sales-form-card">
          <div className="card-header">
            <span className="card-title">Record a sale</span>
          </div>

          {products.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                </svg>
              </div>
              <p>No products in stock.</p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}
                onClick={() => onNavigate('inventory')}>
                Go to Inventory
              </button>
            </div>
          ) : (
            <div className="sales-form">
              <div className="form-group">
                <label className="form-label">Product *</label>
                <select name="product_id" className="form-select"
                  value={form.product_id} onChange={handleChange}>
                  <option value="">— Select product —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.quantity} in stock)
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="sales-product-strip">
                  <div className="sales-strip-item">
                    <span className="metric-label">Standard price</span>
                    <span className="sales-strip-val">{fmtKES(selectedProduct.sell_price)}</span>
                  </div>
                  <div className="sales-strip-item">
                    <span className="metric-label">Buy price</span>
                    <span className="sales-strip-val">{fmtKES(selectedProduct.buy_price)}</span>
                  </div>
                  <div className="sales-strip-item">
                    <span className="metric-label">In stock</span>
                    <span className="sales-strip-val"
                      style={{ color: selectedProduct.quantity <= 5 ? 'var(--amber)' : 'var(--brand)' }}>
                      {selectedProduct.quantity} units
                    </span>
                  </div>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input name="quantity" type="number" min="1"
                    max={selectedProduct?.quantity}
                    className="form-input"
                    value={form.quantity} onChange={handleChange} />
                  {selectedProduct && +form.quantity > selectedProduct.quantity && (
                    <span className="form-error-msg">Only {selectedProduct.quantity} in stock</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Sale price (KSh) *</label>
                  <input name="unit_price" type="number" min="0"
                    className="form-input"
                    value={form.unit_price} onChange={handleChange} />
                  {note && (
                    <span className="form-hint"
                      style={{ color: note.type === 'up' ? 'var(--brand)' : 'var(--amber)' }}>
                      {note.text}
                    </span>
                  )}
                </div>
              </div>

              {selectedProduct && form.unit_price && form.quantity && +form.quantity > 0 && (
                <div className="sales-preview">
                  <div className="sales-preview-row">
                    <span>Total amount</span>
                    <strong>{fmtKES(+form.unit_price * +form.quantity)}</strong>
                  </div>
                  <div className="sales-preview-row profit">
                    <span>Expected profit</span>
                    <strong>{fmtKES((+form.unit_price - selectedProduct.buy_price) * +form.quantity)}</strong>
                  </div>
                  {+form.unit_price < selectedProduct.buy_price && (
                    <div className="sales-preview-row loss">
                      <span>Selling below cost — you will make a loss</span>
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Customer name</label>
                <input name="customer_name" type="text" className="form-input"
                  placeholder="Leave blank for Walk-in"
                  value={form.customer_name} onChange={handleChange} />
              </div>

              <button className="btn btn-primary btn-full" onClick={handleRecord}
                disabled={saving || !form.product_id}>
                {saving
                  ? <><span className="spinner" style={{ width:15, height:15, borderWidth:2 }}/> Recording…</>
                  : 'Record sale'}
              </button>
            </div>
          )}
        </div>

        {/* Today's summary */}
        <div className="card sales-summary-card">
          <div className="card-header">
            <span className="card-title">Today's summary</span>
            <span className="badge badge-brand">{todaySales.length} sales</span>
          </div>
          <div className="sales-summary-stats">
            {[
              { label: 'Revenue',      val: fmtKES(todayRev),                        color: 'var(--text-primary)' },
              { label: 'Profit',       val: fmtKES(todayProfit),                     color: 'var(--brand)' },
              { label: 'Units sold',   val: todayUnits,                               color: 'var(--text-primary)' },
              { label: 'Margin',       val: `${todayMargin}%`,                        color: 'var(--text-primary)' },
            ].map(item => (
              <div key={item.label} className="sales-stat-block">
                <div className="metric-label">{item.label}</div>
                <div className="sales-stat-val" style={{ color: item.color }}>{item.val}</div>
              </div>
            ))}
          </div>

          {todaySales.length > 0 && (
            <>
              <div className="divider" style={{ margin: '14px 0 12px' }}/>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>
                Today's transactions
              </div>
              <div className="sales-recent-list">
                {todaySales.slice(0, 6).map(s => (
                  <div key={s.id} className="sales-recent-row">
                    <div className="sales-recent-info">
                      <div className="sales-recent-name">{s.product_name}</div>
                      <div className="sales-recent-meta">
                        {s.customer_name || 'Walk-in'} · {s.quantity} unit{s.quantity !== 1 ? 's' : ''}
                        · {fmtTime(s.created_at)}
                      </div>
                    </div>
                    <div className="sales-recent-amounts">
                      <div className="sales-recent-total">{fmtKES(s.total_amount)}</div>
                      <div className="sales-recent-profit">+{fmtKES(s.profit)}</div>
                    </div>
                  </div>
                ))}
                {todaySales.length > 6 && (
                  <div style={{ textAlign:'center', paddingTop:8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setFilterToday(true)}>
                      View all {todaySales.length} today
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {todaySales.length === 0 && (
            <div className="empty-state" style={{ padding: '20px 0 0' }}>
              <p>No sales recorded today yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* ---- SALES HISTORY ---- */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Sales history
            <span style={{ fontSize:12, fontWeight:400, color:'var(--text-secondary)', marginLeft:8 }}>
              {visible.length} record{visible.length !== 1 ? 's' : ''}
              {filterToday ? ' (today)' : ''}
            </span>
          </span>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <button
              className={`btn btn-sm ${filterToday ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setFilterToday(v => !v)}
            >
              {filterToday ? 'Today only' : 'All sales'}
            </button>
            <button className="btn btn-ghost btn-sm"
              onClick={() => fetchSales(false)}>
              Refresh
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="search-wrap">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input placeholder="Search by product name or customer…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="sales-loading">
            <div className="spinner"/><span>Loading sales…</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/>
              </svg>
            </div>
            <p>
              {search ? 'No sales match your search.'
                : filterToday ? 'No sales recorded today yet.'
                : 'No sales yet. Use the form above to record your first sale.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sales-mobile-list">
              {visible.map((s, i) => (
                <SaleCard key={s.id} sale={s} index={visible.length - i}
                  onDelete={() => setDeleteConfirm(s)} />
              ))}
            </div>

            {/* Desktop table */}
            <div className="table-wrap sales-desktop-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th><th>Product</th><th>Customer</th>
                    <th>Qty</th><th>Unit price</th><th>Total</th><th>Profit</th>
                    <th>Date / Time</th><th style={{ textAlign:'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s, i) => (
                    <tr key={s.id}>
                      <td style={{ color:'var(--text-tertiary)', fontSize:12 }}>{visible.length - i}</td>
                      <td style={{ fontWeight:500 }}>{s.product_name}</td>
                      <td>{s.customer_name || 'Walk-in'}</td>
                      <td>{s.quantity}</td>
                      <td style={{ fontSize:12 }}>{fmtKES(s.unit_price)}</td>
                      <td style={{ fontWeight:600 }}>{fmtKES(s.total_amount)}</td>
                      <td style={{ color:'var(--brand)', fontWeight:600 }}>{fmtKES(s.profit)}</td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                        {fmtDate(s.created_at)}
                      </td>
                      <td style={{ textAlign:'right' }}>
                        <button className="btn btn-danger btn-xs"
                          onClick={() => setDeleteConfirm(s)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>

      {/* ---- DELETE CONFIRM (outside .fade-up so position:fixed is viewport-relative) ---- */}
      {deleteConfirm && (
        <div className="overlay-bg" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="overlay-card" onClick={e => e.stopPropagation()}>
            <div className="overlay-title">Delete this sale?</div>
            <div className="overlay-body">
              This will remove the sale of{' '}
              <strong>{deleteConfirm.quantity}x {deleteConfirm.product_name}</strong> to{' '}
              <strong>{deleteConfirm.customer_name || 'Walk-in'}</strong>{' '}
              ({fmtKES(deleteConfirm.total_amount)}) and restore the stock.
              This cannot be undone.
            </div>
            <div className="overlay-actions">
              <button className="btn btn-ghost" disabled={deleting}
                onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteSale} disabled={deleting}>
                {deleting
                  ? <><span className="spinner" style={{ width:14, height:14, borderWidth:2 }}/> Deleting…</>
                  : 'Delete sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SaleCard({ sale: s, index, onDelete }) {
  return (
    <div className="sale-card">
      <div className="sale-card-header">
        <div>
          <div className="sale-card-product">{s.product_name}</div>
          <div className="sale-card-meta">
            {s.customer_name || 'Walk-in'} · {s.quantity} unit{s.quantity !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div className="sale-card-total">{fmtKES(s.total_amount)}</div>
          <div className="sale-card-profit">+{fmtKES(s.profit)} profit</div>
        </div>
      </div>
      <div className="sale-card-footer">
        <span className="sale-card-time">{fmtDate(s.created_at)}</span>
        <button className="btn btn-danger btn-xs" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

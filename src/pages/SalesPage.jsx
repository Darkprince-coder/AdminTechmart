// src/pages/SalesPage.jsx  (ADMIN PROJECT)
// Schema: sales.total_amount (generated), sales.profit (generated)
//         products.quantity, buy_price, sell_price

import { useEffect, useState, useCallback, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { fmtKES, fmtDate } from '../lib/utils';
import { insertAuditLog } from '../lib/auditLog';
import '../styles/sales.css';

const EMPTY_FORM = {
  shop_id: '', product_id: '', quantity: '1', unit_price: '', customer_name: '',
};

export default function SalesPage() {
  const { shops, activeShopId } = useShop();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [sales,     setSales]     = useState([]);
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [search,    setSearch]    = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchSales = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    let q = supabase
      .from('sales')
      .select('id, shop_id, product_id, product_name, customer_name, quantity, unit_price, total_amount, profit, created_at, shops(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (activeShopId !== 'all') q = q.eq('shop_id', activeShopId);
    const { data, error } = await q;
    if (error) {
      setLoadError(true);
      setSales([]);
      if (showLoading) toastRef.current.error('Could not load sales. Try Refresh.');
    } else {
      setLoadError(false);
      setSales(data || []);
    }
    if (showLoading) setLoading(false);
  }, [activeShopId]);

  useEffect(() => { fetchSales(true); }, [fetchSales]);

  useEffect(() => {
    const defaultShop = activeShopId !== 'all' ? activeShopId : (shops[0]?.id || '');
    setForm(f => ({ ...f, shop_id: defaultShop, product_id: '', unit_price: '' }));
  }, [activeShopId, shops]);

  // ---- Fetch products when shop changes ----
  useEffect(() => {
    if (!form.shop_id) { setProducts([]); return; }
    const loadProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sell_price, buy_price, quantity')
        .eq('shop_id', form.shop_id)
        .gt('quantity', 0)
        .order('name');
      setProducts(data || []);
      if (data?.length > 0) {
        setForm(f => ({
          ...f,
          product_id: f.product_id || data[0].id,
          unit_price:  f.product_id ? f.unit_price : String(data[0].sell_price),
        }));
      } else {
        setForm(f => ({ ...f, product_id: '', unit_price: '' }));
      }
    };
    loadProducts();
  }, [form.shop_id]);

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

  // ---- Refresh products data ----
  const refreshProducts = useCallback(async () => {
    if (!form.shop_id) return;
    const { data } = await supabase
      .from('products')
      .select('id, name, sell_price, buy_price, quantity')
      .eq('shop_id', form.shop_id)
      .gt('quantity', 0)
      .order('name');
    setProducts(data || []);
  }, [form.shop_id]);

  // ---- Refresh products when page becomes visible ----
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshProducts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshProducts]);

  const handleRecord = async () => {
    const { shop_id, product_id, quantity, unit_price, customer_name } = form;
    if (!shop_id)                         return toastRef.current.error('Select a branch');
    if (!product_id)                      return toastRef.current.error('Select a product');
    if (!+quantity || +quantity < 1)      return toastRef.current.error('Enter a valid quantity');
    if (!+unit_price || +unit_price <= 0) return toastRef.current.error('Enter a valid price');

    const product = products.find(p => p.id === product_id);
    if (!product) return toastRef.current.error('Product not found');
    if (+quantity > product.quantity)
      return toastRef.current.error(`Only ${product.quantity} units in stock`);

    setSaving(true);
    const { error: stockErr } = await supabase
      .from('products').update({ quantity: product.quantity - +quantity }).eq('id', product_id);

    if (stockErr) {
      toastRef.current.error('Stock update failed');
      setSaving(false);
      return;
    }

    const { error: saleErr } = await supabase.from('sales').insert({
      shop_id, product_id,
      product_name:  product.name,
      customer_name: customer_name.trim() || 'Walk-in',
      quantity:      +quantity,
      unit_price:    +unit_price,
      buy_price:     product.buy_price,
    });

    if (saleErr) {
      // Roll back stock
      await supabase.from('products')
        .update({ quantity: product.quantity }).eq('id', product_id);
      toastRef.current.error('Sale record failed: ' + saleErr.message);
    } else {
      const profit = (+unit_price - product.buy_price) * +quantity;
      toastRef.current.success(`Sale recorded — Profit: ${fmtKES(profit)}`);
      setForm(f => ({ ...f, quantity: '1', customer_name: '' }));
      fetchSales(false);
      const { data } = await supabase
        .from('products').select('id, name, sell_price, buy_price, quantity')
        .eq('shop_id', shop_id).gt('quantity', 0).order('name');
      setProducts(data || []);
    }
    setSaving(false);
  };

  const handleDeleteSale = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const shopId = deleteConfirm.shop_id;

    let prod = null;
    if (deleteConfirm.product_id) {
      const { data } = await supabase
        .from('products')
        .select('id, quantity')
        .eq('id', deleteConfirm.product_id)
        .eq('shop_id', shopId)
        .maybeSingle();
      prod = data;
    }
    if (!prod) {
      const { data } = await supabase
        .from('products')
        .select('id, quantity')
        .eq('shop_id', shopId)
        .eq('name', deleteConfirm.product_name)
        .maybeSingle();
      prod = data;
    }

    if (prod) {
      await supabase
        .from('products')
        .update({ quantity: prod.quantity + deleteConfirm.quantity })
        .eq('id', prod.id);
    }

    const { error } = await supabase.from('sales').delete().eq('id', deleteConfirm.id);

    if (error) {
      toastRef.current.error('Delete failed: ' + error.message);
      if (prod) {
        await supabase.from('products')
          .update({ quantity: prod.quantity })
          .eq('id', prod.id);
      }
    } else {
      setSales(prev => prev.filter(s => s.id !== deleteConfirm.id));
      toastRef.current.success('Sale deleted and stock restored');
      insertAuditLog({
        action: 'sale_delete',
        entityType: 'sale',
        entityId: deleteConfirm.id,
        metadata: {
          portal: 'admin',
          shop_id: deleteConfirm.shop_id,
          product_name: deleteConfirm.product_name,
          quantity: deleteConfirm.quantity,
          total_amount: deleteConfirm.total_amount,
        },
      });
      fetchSales(false);
    }

    setDeleting(false);
    setDeleteConfirm(null);
  };

  const totalRevenue = sales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const totalProfit  = sales.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const totalQty     = sales.reduce((a, s) => a + (s.quantity           || 0), 0);
  const avgProfit    = sales.length ? totalProfit / sales.length : 0;

  const visible = search
    ? sales.filter(s =>
        (s.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.customer_name || '').toLowerCase().includes(search.toLowerCase()))
    : sales;

  const selectedProduct = products.find(p => p.id === form.product_id);

  return (
    <>
    <div className="fade-in">
      <div className="grid-4 mb-md">
        <div className="metric-card">
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value" style={{ fontSize: 18 }}>{fmtKES(totalRevenue)}</div>
          <div className="metric-sub">{sales.length} transactions</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Profit</div>
          <div className="metric-value" style={{ fontSize:18, color:'var(--teal)' }}>{fmtKES(totalProfit)}</div>
          <div className="metric-sub up">
            {totalRevenue > 0 ? `${Math.round((totalProfit/totalRevenue)*100)}% margin` : '—'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Units Sold</div>
          <div className="metric-value" style={{ fontSize: 18 }}>{totalQty}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Profit / Sale</div>
          <div className="metric-value" style={{ fontSize: 18 }}>{fmtKES(Math.round(avgProfit))}</div>
        </div>
      </div>

      <div className="grid-2 mb-md" style={{ alignItems: 'start' }}>
        {/* Record sale form */}
        <div className="card">
          <div className="card-header"><span className="card-title">Record a sale</span></div>
          <div className="sales-form">
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <select name="shop_id" className="form-select" value={form.shop_id} onChange={handleChange} disabled={saving}>
                <option value="">— Select branch —</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Product *</label>
              <select name="product_id" className="form-select" value={form.product_id}
                onChange={handleChange} disabled={saving || !form.shop_id || products.length === 0}>
                {products.length === 0
                  ? <option value="">No products in stock</option>
                  : products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.quantity} left)
                    </option>
                  ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="sales-product-hint">
                <span>Sell: <strong>{fmtKES(selectedProduct.sell_price)}</strong></span>
                <span>Buy: <strong>{fmtKES(selectedProduct.buy_price)}</strong></span>
                <span className="sales-margin-pill">
                  Margin: {fmtKES(selectedProduct.sell_price - selectedProduct.buy_price)}
                </span>
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Quantity *</label>
                <input name="quantity" type="number" min="1" className="form-input"
                  value={form.quantity} onChange={handleChange} disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit price (KSh) *</label>
                <input name="unit_price" type="number" min="0" className="form-input"
                  value={form.unit_price} onChange={handleChange} disabled={saving} />
              </div>
            </div>

            {form.quantity && form.unit_price && selectedProduct && (
              <div className="sales-total-preview">
                <div className="sales-total-row">
                  <span>Total</span>
                  <span>{fmtKES(+form.unit_price * +form.quantity)}</span>
                </div>
                <div className="sales-total-row profit">
                  <span>Profit</span>
                  <span>{fmtKES((+form.unit_price - selectedProduct.buy_price) * +form.quantity)}</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Customer name</label>
              <input name="customer_name" type="text" className="form-input"
                placeholder="Walk-in" value={form.customer_name} onChange={handleChange} disabled={saving} />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleRecord}
              disabled={saving || !form.shop_id || !form.product_id}
              style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? (
                <>
                  <span className="spinner spinner-sm" /> Processing…
                </>
              ) : (
                'Record sale'
              )}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Session summary</span>
            <span className="badge badge-teal">
              {activeShopId === 'all' ? 'All branches' : shops.find(s=>s.id===activeShopId)?.name}
            </span>
          </div>
          <div className="sales-summary-grid">
            {[
              { label: 'Revenue',      value: fmtKES(totalRevenue), color: 'var(--text-primary)' },
              { label: 'Profit',       value: fmtKES(totalProfit),  color: 'var(--teal)' },
              { label: 'Transactions', value: sales.length,          color: 'var(--text-primary)' },
              { label: 'Units sold',   value: totalQty,              color: 'var(--text-primary)' },
            ].map(item => (
              <div key={item.label} className="sales-summary-item">
                <div className="metric-label">{item.label}</div>
                <div style={{ fontSize:20, fontWeight:600,
                  fontFamily:'var(--font-mono,monospace)', color:item.color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {sales.length > 0 && (
            <>
              <div className="divider" style={{ margin: '12px 0' }}/>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>
                Recent
              </div>
              {sales.slice(0, 5).map(s => (
                <div key={s.id} className="sales-recent-row">
                  <div>
                    <div className="sales-recent-name">{s.product_name}</div>
                    <div className="sales-recent-meta">
                      {s.customer_name || 'Walk-in'} · {s.shops?.name || ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{fmtKES(s.total_amount)}</div>
                    <div style={{ fontSize:11, color:'var(--teal)' }}>+{fmtKES(s.profit)}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Sales table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            All sales
            <span style={{ color:'var(--text-secondary)', fontWeight:400, fontSize:12, marginLeft:8 }}>
              {visible.length} records
            </span>
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="search-bar" style={{ width: 220 }}>
              <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input placeholder="Search product or customer…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fetchSales(false)}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <div className="ov-loading" style={{ minHeight:100 }}>
            <div className="spinner"/><span>Loading…</span>
          </div>
        ) : loadError ? (
          <div className="empty-state" style={{ padding: '28px 16px' }}>
            <p style={{ color: 'var(--red)', marginBottom: 14 }}>Could not load sales.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchSales(true)}>
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p>{search ? 'No sales match your search' : 'No sales recorded yet'}</p>
          </div>
        ) : (
          <>
          <div className="sales-mobile-list">
            {visible.map((s, i) => (
              <AdminSaleCard
                key={s.id}
                sale={s}
                index={visible.length - i}
                showBranch={activeShopId === 'all'}
                onDelete={() => setDeleteConfirm(s)}
              />
            ))}
          </div>
          <div className="table-wrap sales-desktop-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Product</th>
                  {activeShopId === 'all' && <th>Branch</th>}
                  <th>Customer</th><th>Qty</th>
                  <th>Unit price</th><th>Total</th><th>Profit</th><th>Date</th>
                  <th style={{ textAlign: 'right' }}> </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color:'var(--text-tertiary)', fontSize:12 }}>{visible.length-i}</td>
                    <td style={{ fontWeight:500 }}>{s.product_name}</td>
                    {activeShopId === 'all' && (
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                        {s.shops?.name || '—'}
                      </td>
                    )}
                    <td>{s.customer_name || 'Walk-in'}</td>
                    <td>{s.quantity}</td>
                    <td style={{ fontSize:12 }}>{fmtKES(s.unit_price)}</td>
                    <td style={{ fontWeight:500 }}>{fmtKES(s.total_amount)}</td>
                    <td style={{ color:'var(--teal)', fontWeight:500 }}>{fmtKES(s.profit)}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                      {fmtDate(s.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        onClick={() => setDeleteConfirm(s)}
                      >
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

      {deleteConfirm && (
        <div className="overlay-bg" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="overlay-card" onClick={e => e.stopPropagation()}>
            <div className="overlay-title">Delete this sale?</div>
            <div className="overlay-body">
              This removes the sale of{' '}
              <strong>{deleteConfirm.quantity}× {deleteConfirm.product_name}</strong>
              {' '}({fmtKES(deleteConfirm.total_amount)}) for{' '}
              <strong>{deleteConfirm.customer_name || 'Walk-in'}</strong>
              {deleteConfirm.shops?.name && (
                <> at <strong>{deleteConfirm.shops.name}</strong></>
              )}
              . Stock will be restored. This cannot be undone.
            </div>
            <div className="overlay-actions">
              <button type="button" className="btn btn-ghost" disabled={deleting}
                onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" disabled={deleting}
                onClick={handleDeleteSale}>
                {deleting ? (
                  <><span className="spinner spinner-sm"/> Deleting…</>
                ) : (
                  'Delete sale'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AdminSaleCard({ sale: s, index, showBranch, onDelete }) {
  return (
    <div className="sales-mobile-card">
      <div className="sales-mobile-card-top">
        <div>
          <div className="sales-mobile-card-product">{s.product_name}</div>
          <div className="sales-mobile-card-meta">
            {s.customer_name || 'Walk-in'}
            {showBranch && s.shops?.name ? ` · ${s.shops.name}` : ''}
          </div>
        </div>
        <div className="sales-mobile-card-amt">
          <div className="sales-mobile-card-total">{fmtKES(s.total_amount)}</div>
          <div className="sales-mobile-card-profit">+{fmtKES(s.profit)}</div>
        </div>
      </div>
      <div className="sales-mobile-card-bottom">
        <span className="sales-mobile-card-date">{fmtDate(s.created_at)}</span>
        <span className="sales-mobile-card-idx">#{index}</span>
        <button type="button" className="btn btn-danger btn-xs" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

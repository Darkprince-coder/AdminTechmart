// src/pages/SalesPage.jsx  (ADMIN PROJECT)
// New feature: Bulk archive & delete — lets admin select a time period,
// preview the matching records, export a PDF archive, then permanently
// delete those records from Supabase.

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useShop }  from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { supabase }  from '../lib/supabase';
import { fmtKES, fmtDate } from '../lib/utils';
import { insertAuditLog } from '../lib/auditLog';
import { localDayStartIso, localDayEndIso, defaultCustomRangeStrings } from '../lib/reportDateRange';
import { downloadSalesArchivePdf } from '../lib/pdfExport';
import '../styles/sales.css';

// ── Period options for the bulk-delete panel ──────────────────────────────
const BULK_PERIODS = [
  { label: 'Today',      value: 'today'  },
  { label: 'This week',  value: 'week'   },
  { label: 'This month', value: 'month'  },
  { label: 'Custom',     value: 'custom' },
  { label: 'All time',   value: 'all'    },
];

function getBulkIsoRange(period, customFrom, customTo) {
  if (period === 'all') return { startIso: null, endIso: null, invalid: false };

  if (period === 'custom') {
    if (!customFrom || !customTo || customFrom > customTo)
      return { startIso: null, endIso: null, invalid: true };
    return {
      startIso: localDayStartIso(customFrom),
      endIso:   localDayEndIso(customTo),
      invalid:  false,
    };
  }

  const now = new Date();
  if (period === 'today') {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    return { startIso: d.toISOString(), endIso: null, invalid: false };
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0);
    return { startIso: d.toISOString(), endIso: null, invalid: false };
  }
  if (period === 'month') {
    return {
      startIso: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endIso:   null,
      invalid:  false,
    };
  }
  return { startIso: null, endIso: null, invalid: false };
}

function getBulkRangeLabel(period, customFrom, customTo) {
  const today = new Date().toLocaleDateString('en-KE', { dateStyle: 'medium' });
  if (period === 'all')    return `All recorded time · as at ${today}`;
  if (period === 'custom') {
    if (!customFrom || !customTo) return 'Select a valid date range';
    const a = new Date(customFrom + 'T12:00:00').toLocaleDateString('en-KE', { dateStyle: 'medium' });
    const b = new Date(customTo   + 'T12:00:00').toLocaleDateString('en-KE', { dateStyle: 'medium' });
    return customFrom > customTo ? 'Invalid range (from > to)' : `${a} — ${b}`;
  }
  const { startIso } = getBulkIsoRange(period, customFrom, customTo);
  if (!startIso) return today;
  const start = new Date(startIso).toLocaleDateString('en-KE', { dateStyle: 'medium' });
  return `${start} — ${today}`;
}

const EMPTY_FORM = { shop_id: '', product_id: '', quantity: '1', unit_price: '', customer_name: '' };

export default function SalesPage() {
  const { shops, activeShopId } = useShop();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // ── normal sale state ───────────────────────────────────────────────────
  const [sales,     setSales]     = useState([]);
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [search,    setSearch]    = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── bulk archive state ──────────────────────────────────────────────────
  const [showBulkPanel,   setShowBulkPanel]   = useState(false);
  const defRange = defaultCustomRangeStrings();
  const [bulkPeriod,      setBulkPeriod]      = useState('month');
  const [bulkCustomFrom,  setBulkCustomFrom]  = useState(defRange.from);
  const [bulkCustomTo,    setBulkCustomTo]    = useState(defRange.to);
  const [bulkRecords,     setBulkRecords]     = useState([]);   // fetched fresh (no limit)
  const [bulkLoading,     setBulkLoading]     = useState(false);
  const [pdfSaved,        setPdfSaved]        = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDeleting,    setBulkDeleting]    = useState(false);

  // ── fetch regular sales list ────────────────────────────────────────────
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

  // ── sync shop / product selectors ───────────────────────────────────────
  useEffect(() => {
    const defaultShop = activeShopId !== 'all' ? activeShopId : (shops[0]?.id || '');
    setForm(f => ({ ...f, shop_id: defaultShop, product_id: '', unit_price: '' }));
  }, [activeShopId, shops]);

  useEffect(() => {
    if (!form.shop_id) { setProducts([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sell_price, buy_price, quantity')
        .eq('shop_id', form.shop_id).gt('quantity', 0).order('name');
      setProducts(data || []);
      if (data?.length > 0) {
        setForm(f => ({
          ...f,
          product_id: f.product_id || data[0].id,
          unit_price: f.product_id  ? f.unit_price : String(data[0].sell_price),
        }));
      } else {
        setForm(f => ({ ...f, product_id: '', unit_price: '' }));
      }
    };
    load();
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

  // ── refresh products on visibility ──────────────────────────────────────
  const refreshProducts = useCallback(async () => {
    if (!form.shop_id) return;
    const { data } = await supabase
      .from('products').select('id, name, sell_price, buy_price, quantity')
      .eq('shop_id', form.shop_id).gt('quantity', 0).order('name');
    setProducts(data || []);
  }, [form.shop_id]);

  useEffect(() => {
    const handle = () => { if (document.visibilityState === 'visible') refreshProducts(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refreshProducts]);

  // ── record a sale ────────────────────────────────────────────────────────
  const handleRecord = async () => {
    const { shop_id, product_id, quantity, unit_price, customer_name } = form;
    if (!shop_id)                         return toastRef.current.error('Select a branch');
    if (!product_id)                      return toastRef.current.error('Select a product');
    if (!+quantity || +quantity < 1)      return toastRef.current.error('Enter a valid quantity');
    if (!+unit_price || +unit_price <= 0) return toastRef.current.error('Enter a valid price');

    const product = products.find(p => p.id === product_id);
    if (!product) return toastRef.current.error('Product not found');
    if (+quantity > product.quantity) return toastRef.current.error(`Only ${product.quantity} units in stock`);

    setSaving(true);
    const { error: stockErr } = await supabase
      .from('products').update({ quantity: product.quantity - +quantity }).eq('id', product_id);

    if (stockErr) { toastRef.current.error('Stock update failed'); setSaving(false); return; }

    const { error: saleErr } = await supabase.from('sales').insert({
      shop_id, product_id,
      product_name:  product.name,
      customer_name: customer_name.trim() || 'Walk-in',
      quantity:      +quantity,
      unit_price:    +unit_price,
      buy_price:     product.buy_price,
    });

    if (saleErr) {
      await supabase.from('products').update({ quantity: product.quantity }).eq('id', product_id);
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

  // ── delete a single sale ─────────────────────────────────────────────────
  const handleDeleteSale = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const shopId = deleteConfirm.shop_id;

    let prod = null;
    if (deleteConfirm.product_id) {
      const { data } = await supabase.from('products').select('id, quantity')
        .eq('id', deleteConfirm.product_id).eq('shop_id', shopId).maybeSingle();
      prod = data;
    }
    if (!prod) {
      const { data } = await supabase.from('products').select('id, quantity')
        .eq('shop_id', shopId).eq('name', deleteConfirm.product_name).maybeSingle();
      prod = data;
    }
    if (prod) {
      await supabase.from('products').update({ quantity: prod.quantity + deleteConfirm.quantity }).eq('id', prod.id);
    }

    const { error } = await supabase.from('sales').delete().eq('id', deleteConfirm.id);
    if (error) {
      toastRef.current.error('Delete failed: ' + error.message);
      if (prod) await supabase.from('products').update({ quantity: prod.quantity }).eq('id', prod.id);
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

  // ════════════════════════════════════════════════════════════════
  // BULK ARCHIVE & DELETE
  // ════════════════════════════════════════════════════════════════

  const { startIso: bulkStart, endIso: bulkEnd, invalid: bulkInvalid } =
    getBulkIsoRange(bulkPeriod, bulkCustomFrom, bulkCustomTo);

  const bulkRangeLabel = getBulkRangeLabel(bulkPeriod, bulkCustomFrom, bulkCustomTo);

  const shopLabel = activeShopId === 'all'
    ? 'All branches'
    : (shops.find(s => s.id === activeShopId)?.name || 'Branch');

  const periodLabel = BULK_PERIODS.find(p => p.value === bulkPeriod)?.label || bulkPeriod;

  // Fetch all matching records (no .limit()) for bulk operations
  const fetchBulkRecords = useCallback(async () => {
    if (bulkInvalid) { setBulkRecords([]); return; }
    setBulkLoading(true);
    setBulkRecords([]);

    let q = supabase
      .from('sales')
      .select('id, shop_id, product_name, customer_name, quantity, unit_price, buy_price, total_amount, profit, created_at, shops(name)')
      .order('created_at', { ascending: false });

    if (activeShopId !== 'all') q = q.eq('shop_id', activeShopId);
    if (bulkStart) q = q.gte('created_at', bulkStart);
    if (bulkEnd)   q = q.lte('created_at', bulkEnd);

    const { data, error } = await q;
    if (error) toastRef.current.error('Could not fetch records: ' + error.message);
    else setBulkRecords(data || []);
    setBulkLoading(false);
  }, [activeShopId, bulkStart, bulkEnd, bulkInvalid]);

  // Re-fetch whenever the panel is open and the period/scope changes
  useEffect(() => {
    if (showBulkPanel && !bulkInvalid) fetchBulkRecords();
  }, [showBulkPanel, fetchBulkRecords, bulkInvalid]);

  // Reset pdfSaved when period changes (PDF would be stale)
  useEffect(() => { setPdfSaved(false); }, [bulkPeriod, bulkCustomFrom, bulkCustomTo, activeShopId]);

  // Derived metrics for the bulk target
  const bulkRevenue = bulkRecords.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const bulkProfit  = bulkRecords.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const bulkUnits   = bulkRecords.reduce((a, s) => a + (s.quantity           || 0), 0);
  const bulkMargin  = bulkRevenue > 0 ? Math.round((bulkProfit / bulkRevenue) * 100) : null;

  // Export PDF archive
  const handleBulkExportPdf = () => {
    if (!bulkRecords.length) return toastRef.current.error('No records to export');
    try {
      downloadSalesArchivePdf({
        shopLabel,
        periodLabel,
        rangeDescription: bulkRangeLabel,
        deletedAt: new Date().toISOString(),
        metrics: {
          revenue:   bulkRevenue,
          profit:    bulkProfit,
          marginPct: bulkMargin,
          units:     bulkUnits,
          txns:      bulkRecords.length,
        },
        rows: bulkRecords.map(s => ({
          ...s,
          branch: s.shops?.name,
        })),
        showBranchColumn: activeShopId === 'all',
      });
      setPdfSaved(true);
      toastRef.current.success('Archive PDF downloaded — you can now delete the records');
    } catch (err) {
      console.error(err);
      toastRef.current.error(err?.message || 'PDF export failed');
    }
  };

  // Bulk delete — removes records in batches of 400
  const handleBulkDelete = async () => {
    if (!bulkRecords.length) return;
    setBulkDeleting(true);

    const ids = bulkRecords.map(s => s.id);
    const BATCH = 400;
    let failed = false;
    let deleted = 0;

    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const { error } = await supabase.from('sales').delete().in('id', chunk);
      if (error) { failed = true; break; }
      deleted += chunk.length;
    }

    if (failed) {
      toastRef.current.error(`Partial deletion: ${deleted} of ${ids.length} removed. Refresh and retry.`);
    } else {
      toastRef.current.success(`${ids.length} sales record${ids.length === 1 ? '' : 's'} permanently deleted`);
      // Remove deleted IDs from the live sales list
      const deletedSet = new Set(ids);
      setSales(prev => prev.filter(s => !deletedSet.has(s.id)));
      setBulkRecords([]);
      setShowBulkConfirm(false);
      setShowBulkPanel(false);
      setPdfSaved(false);
      insertAuditLog({
        action: 'bulk_sales_delete',
        entityType: 'sale',
        entityId: null,
        metadata: {
          portal: 'admin',
          period: bulkPeriod,
          range: bulkRangeLabel,
          shop_scope: activeShopId === 'all' ? 'all_branches' : activeShopId,
          records_deleted: ids.length,
          revenue_archived: bulkRevenue,
          profit_archived: bulkProfit,
          pdf_downloaded: pdfSaved,
        },
      });
    }
    setBulkDeleting(false);
  };

  // ── derived display values ───────────────────────────────────────────────
  const totalRevenue = sales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const totalProfit  = sales.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const totalQty     = sales.reduce((a, s) => a + (s.quantity           || 0), 0);
  const avgProfit    = sales.length ? totalProfit / sales.length : 0;

  const visible = search
    ? sales.filter(s =>
        (s.product_name  || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.customer_name || '').toLowerCase().includes(search.toLowerCase()))
    : sales;

  const selectedProduct = products.find(p => p.id === form.product_id);

  return (
    <>
    <div className="fade-in">

      {/* ── METRICS ─────────────────────────────────────────────────────── */}
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
            {totalRevenue > 0 ? `${Math.round((totalProfit / totalRevenue) * 100)}% margin` : '—'}
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

      {/* ── RECORD FORM + SESSION SUMMARY ────────────────────────────────── */}
      <div className="grid-2 mb-md" style={{ alignItems: 'start' }}>
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
                    <option key={p.id} value={p.id}>{p.name} ({p.quantity} left)</option>
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
              {saving ? <><span className="spinner spinner-sm" /> Processing…</> : 'Record sale'}
            </button>
          </div>
        </div>

        {/* Session summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Session summary</span>
            <span className="badge badge-teal">
              {activeShopId === 'all' ? 'All branches' : shops.find(s => s.id === activeShopId)?.name}
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
                <div style={{ fontSize:20, fontWeight:600, fontFamily:'var(--font-mono,monospace)', color:item.color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {sales.length > 0 && (
            <>
              <div className="divider" style={{ margin: '12px 0' }}/>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8 }}>Recent</div>
              {sales.slice(0, 5).map(s => (
                <div key={s.id} className="sales-recent-row">
                  <div>
                    <div className="sales-recent-name">{s.product_name}</div>
                    <div className="sales-recent-meta">{s.customer_name || 'Walk-in'} · {s.shops?.name || ''}</div>
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

      {/* ════════════════════════════════════════════════════════════════════
          BULK ARCHIVE & DELETE PANEL
      ════════════════════════════════════════════════════════════════════ */}
      <div className="card mb-md" style={{
        borderLeft: '4px solid var(--amber)',
        background: 'var(--bg-card)',
      }}>
        {/* Panel header / toggle */}
        <div
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
          onClick={() => setShowBulkPanel(v => !v)}
        >
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width: 32, height: 32,
              background: 'var(--amber-light)',
              color: 'var(--amber)',
              borderRadius: 'var(--r-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>
                Bulk archive &amp; delete
              </div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
                Export a PDF archive then permanently delete sales records for a selected period
              </div>
            </div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ transform: showBulkPanel ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform .2s', flexShrink:0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {showBulkPanel && (
          <div style={{ marginTop: 20 }}>

            {/* Period selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>
                Select period to archive
              </div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:3, width:'fit-content' }}>
                {BULK_PERIODS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setBulkPeriod(p.value)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 'var(--r-sm)',
                      border: 'none',
                      background: bulkPeriod === p.value ? 'var(--bg-card)' : 'transparent',
                      color: bulkPeriod === p.value ? 'var(--amber)' : 'var(--text-secondary)',
                      fontWeight: bulkPeriod === p.value ? 700 : 500,
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                      boxShadow: bulkPeriod === p.value ? 'var(--shadow-xs)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date pickers */}
            {bulkPeriod === 'custom' && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:14, marginBottom:14, alignItems:'flex-end' }}>
                <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                  <span>From</span>
                  <input type="date" className="form-input" style={{ minWidth:160, fontFamily:'var(--font-mono)', fontSize:13 }}
                    value={bulkCustomFrom} onChange={e => setBulkCustomFrom(e.target.value)} />
                </label>
                <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11, fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                  <span>To</span>
                  <input type="date" className="form-input" style={{ minWidth:160, fontFamily:'var(--font-mono)', fontSize:13 }}
                    value={bulkCustomTo} onChange={e => setBulkCustomTo(e.target.value)} />
                </label>
                {bulkInvalid && (
                  <span style={{ fontSize:12, color:'var(--red)', fontWeight:600, alignSelf:'flex-end', paddingBottom:10 }}>
                    "From" must be on or before "To"
                  </span>
                )}
              </div>
            )}

            {/* Preview stats */}
            {bulkInvalid ? (
              <div style={{ padding:'12px 16px', background:'var(--red-light)', color:'var(--red)', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:500, marginBottom:14 }}>
                Select a valid date range to continue.
              </div>
            ) : bulkLoading ? (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 0', color:'var(--text-secondary)', fontSize:13, marginBottom:14 }}>
                <div className="spinner"/><span>Counting records…</span>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {/* Range label */}
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:10 }}>
                  Period: <strong style={{ color:'var(--text-primary)' }}>{bulkRangeLabel}</strong>
                  &nbsp;·&nbsp;Scope: <strong style={{ color:'var(--text-primary)' }}>{shopLabel}</strong>
                </div>

                {/* Metric tiles */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:10, marginBottom:14 }}>
                  {[
                    { label:'Records',     value: bulkRecords.length,           color:'var(--amber)' },
                    { label:'Revenue',     value: fmtKES(bulkRevenue),          color:'var(--text-primary)' },
                    { label:'Profit',      value: fmtKES(bulkProfit),           color:'var(--teal)' },
                    { label:'Margin',      value: bulkMargin != null ? `${bulkMargin}%` : '—', color:'var(--text-primary)' },
                    { label:'Units sold',  value: bulkUnits,                    color:'var(--text-primary)' },
                  ].map(tile => (
                    <div key={tile.label} style={{ background:'var(--bg-secondary)', borderRadius:'var(--r-sm)', padding:'10px 14px' }}>
                      <div className="metric-label">{tile.label}</div>
                      <div style={{ fontSize:16, fontWeight:700, fontFamily:'var(--font-mono)', color:tile.color, marginTop:4 }}>
                        {tile.value}
                      </div>
                    </div>
                  ))}
                </div>

                {bulkRecords.length === 0 ? (
                  <div style={{ padding:'10px 0', fontSize:13, color:'var(--text-secondary)' }}>
                    No records found for this period and scope.
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>

                    {/* Download PDF button */}
                    <button
                      type="button"
                      onClick={handleBulkExportPdf}
                      style={{
                        display:'inline-flex', alignItems:'center', gap:8,
                        padding:'9px 18px',
                        borderRadius:'var(--r-md)',
                        border:'1.5px solid var(--amber)',
                        background: pdfSaved ? 'var(--amber-light)' : 'transparent',
                        color:'var(--amber)',
                        fontWeight:700, fontSize:13,
                        cursor:'pointer', fontFamily:'var(--font)',
                        transition:'all .15s',
                      }}
                    >
                      {pdfSaved ? (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          PDF saved
                        </>
                      ) : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Download PDF archive
                        </>
                      )}
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setShowBulkConfirm(true)}
                      style={{
                        display:'inline-flex', alignItems:'center', gap:8,
                        padding:'9px 18px',
                        borderRadius:'var(--r-md)',
                        border:'1.5px solid rgba(220,38,38,.35)',
                        background:'var(--red-light)',
                        color:'var(--red)',
                        fontWeight:700, fontSize:13,
                        cursor:'pointer', fontFamily:'var(--font)',
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      </svg>
                      Delete {bulkRecords.length} record{bulkRecords.length !== 1 ? 's' : ''}
                    </button>

                    {!pdfSaved && (
                      <span style={{ fontSize:12, color:'var(--amber)', fontWeight:500 }}>
                        ↑ Save a PDF archive before deleting
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ALL SALES TABLE ──────────────────────────────────────────────── */}
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchSales(true)}>Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p>{search ? 'No sales match your search' : 'No sales recorded yet'}</p>
          </div>
        ) : (
          <>
            <div className="sales-mobile-list">
              {visible.map((s, i) => (
                <AdminSaleCard key={s.id} sale={s} index={visible.length - i}
                  showBranch={activeShopId === 'all'} onDelete={() => setDeleteConfirm(s)} />
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
                      <td style={{ color:'var(--text-tertiary)', fontSize:12 }}>{visible.length - i}</td>
                      <td style={{ fontWeight:500 }}>{s.product_name}</td>
                      {activeShopId === 'all' && (
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{s.shops?.name || '—'}</td>
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
                        <button type="button" className="btn btn-danger btn-xs"
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

    {/* ── SINGLE DELETE CONFIRM ────────────────────────────────────────────── */}
    {deleteConfirm && (
      <div className="overlay-bg" onClick={() => !deleting && setDeleteConfirm(null)}>
        <div className="overlay-card" onClick={e => e.stopPropagation()}>
          <div className="overlay-title">Delete this sale?</div>
          <div className="overlay-body">
            This removes the sale of{' '}
            <strong>{deleteConfirm.quantity}× {deleteConfirm.product_name}</strong>
            {' '}({fmtKES(deleteConfirm.total_amount)}) for{' '}
            <strong>{deleteConfirm.customer_name || 'Walk-in'}</strong>
            {deleteConfirm.shops?.name && <> at <strong>{deleteConfirm.shops.name}</strong></>}.
            Stock will be restored. This cannot be undone.
          </div>
          <div className="overlay-actions">
            <button type="button" className="btn btn-ghost" disabled={deleting}
              onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={deleting}
              onClick={handleDeleteSale}>
              {deleting ? <><span className="spinner spinner-sm"/> Deleting…</> : 'Delete sale'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── BULK DELETE CONFIRM ───────────────────────────────────────────────── */}
    {showBulkConfirm && (
      <div className="overlay-bg" onClick={() => !bulkDeleting && setShowBulkConfirm(false)}>
        <div className="overlay-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>

          {/* Warning header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{
              width:44, height:44, borderRadius:'50%',
              background:'var(--red-light)', color:'var(--red)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-.02em' }}>
                Permanently delete records?
              </div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
                This action cannot be undone
              </div>
            </div>
          </div>

          {/* What gets deleted */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:'var(--r-md)', padding:'12px 14px', marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>
              Records to delete
            </div>
            {[
              { label:'Count',      value:`${bulkRecords.length} transaction${bulkRecords.length !== 1 ? 's' : ''}` },
              { label:'Period',     value: bulkRangeLabel },
              { label:'Scope',      value: shopLabel },
              { label:'Revenue',    value: fmtKES(bulkRevenue) },
              { label:'Profit',     value: fmtKES(bulkProfit)  },
              { label:'Units sold', value: String(bulkUnits) },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'3px 0', borderBottom:'1px solid var(--border-subtle)' }}>
                <span style={{ color:'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontWeight:600, color:'var(--text-primary)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* PDF nudge */}
          {!pdfSaved ? (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--amber-light)', border:'1px solid rgba(180,100,20,.25)', borderRadius:'var(--r-sm)', marginBottom:14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" style={{ flexShrink:0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div style={{ flex:1, fontSize:12, color:'var(--amber)', fontWeight:500 }}>
                You haven't downloaded the PDF archive yet. We strongly recommend saving it before deleting.
              </div>
              <button type="button" onClick={handleBulkExportPdf}
                style={{ padding:'6px 12px', borderRadius:'var(--r-sm)', border:'1px solid var(--amber)', background:'transparent', color:'var(--amber)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>
                Download now
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'rgba(5,150,105,.08)', border:'1px solid rgba(5,150,105,.2)', borderRadius:'var(--r-sm)', marginBottom:14 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span style={{ fontSize:12, color:'var(--teal)', fontWeight:600 }}>PDF archive saved — safe to delete</span>
            </div>
          )}

          <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:18, lineHeight:1.6 }}>
            Note: this deletes the <strong>sales records only</strong>. Stock quantities are <strong>not</strong> restored
            for bulk deletes — this is an archival operation for historical data.
          </div>

          <div className="overlay-actions">
            <button type="button" className="btn btn-ghost" disabled={bulkDeleting}
              onClick={() => setShowBulkConfirm(false)}>
              Cancel
            </button>
            <button type="button" disabled={bulkDeleting}
              onClick={handleBulkDelete}
              style={{
                display:'inline-flex', alignItems:'center', gap:8,
                padding:'10px 20px', borderRadius:'var(--r-md)',
                border:'none', background:'var(--red)',
                color:'#fff', fontWeight:700, fontSize:13,
                cursor: bulkDeleting ? 'not-allowed' : 'pointer',
                opacity: bulkDeleting ? .7 : 1,
                fontFamily:'var(--font)',
              }}>
              {bulkDeleting
                ? <><span className="spinner spinner-sm" style={{ borderTopColor:'#fff' }}/> Deleting…</>
                : <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    </svg>
                    Delete {bulkRecords.length} record{bulkRecords.length !== 1 ? 's' : ''} permanently
                  </>
              }
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
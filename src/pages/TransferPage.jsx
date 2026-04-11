// src/pages/TransferPage.jsx  (ADMIN PROJECT — drop-in replacement)
// Fix: removed toast from useCallback deps

import { useEffect, useState, useCallback, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/utils';
import '../styles/transfer.css';

const EMPTY_FORM = { from_shop_id:'', to_shop_id:'', product_id:'', quantity:'1', notes:'' };

export default function TransferPage() {
  const { shops } = useShop();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [transfers,    setTransfers]    = useState([]);
  const [fromProducts, setFromProducts] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);

  useEffect(() => {
    if (shops.length >= 1) {
      setForm(f => ({
        ...f,
        from_shop_id: f.from_shop_id || shops[0]?.id || '',
        to_shop_id:   f.to_shop_id   || shops[1]?.id || shops[0]?.id || '',
      }));
    }
  }, [shops]);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('transfers')
      .select('*, from_shop:from_shop_id(name), to_shop:to_shop_id(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setLoadError(true);
      setTransfers([]);
      toastRef.current.error('Could not load transfers: ' + error.message);
    } else {
      setTransfers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  useEffect(() => {
    if (!form.from_shop_id) { setFromProducts([]); return; }
    supabase.from('products')
      .select('id, name, quantity, buy_price, sell_price, category')
      .eq('shop_id', form.from_shop_id).gt('quantity', 0).order('name')
      .then(({ data }) => {
        setFromProducts(data || []);
        setForm(f => ({ ...f, product_id: data?.[0]?.id || '' }));
      });
  }, [form.from_shop_id]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const selectedProduct = fromProducts.find(p => p.id === form.product_id);

  const handleTransfer = async () => {
    const { from_shop_id, to_shop_id, product_id, quantity, notes } = form;
    if (!from_shop_id)                     return toastRef.current.error('Select source branch');
    if (!to_shop_id)                       return toastRef.current.error('Select destination branch');
    if (from_shop_id === to_shop_id)       return toastRef.current.error('Source and destination cannot be the same');
    if (!product_id)                       return toastRef.current.error('Select a product');
    if (!+quantity || +quantity < 1)       return toastRef.current.error('Enter a valid quantity');
    const src = fromProducts.find(p => p.id === product_id);
    if (!src)                              return toastRef.current.error('Product not found');
    if (+quantity > src.quantity)          return toastRef.current.error(`Only ${src.quantity} units available`);

    setSaving(true);
    const { error: decErr } = await supabase
      .from('products').update({ quantity: src.quantity - +quantity }).eq('id', product_id);
    if (decErr) { toastRef.current.error('Failed to update source stock'); setSaving(false); return; }

    const { data: existing } = await supabase.from('products')
      .select('id, quantity').eq('shop_id', to_shop_id).ilike('name', src.name).maybeSingle();

    if (existing) {
      await supabase.from('products').update({ quantity: existing.quantity + +quantity }).eq('id', existing.id);
    } else {
      await supabase.from('products').insert({
        shop_id: to_shop_id, name: src.name, category: src.category,
        buy_price: src.buy_price, sell_price: src.sell_price,
        quantity: +quantity, alert_qty: 5,
      });
    }

    const { error: logErr } = await supabase.from('transfers').insert({
      from_shop_id, to_shop_id, product_id,
      product_name: src.name, quantity: +quantity,
      notes: notes.trim() || null,
    });

    if (!logErr) {
      const fromName = shops.find(s => s.id === from_shop_id)?.name || 'Source';
      const toName   = shops.find(s => s.id === to_shop_id)?.name   || 'Dest';
      toastRef.current.success(`${quantity}x ${src.name} transferred to ${toName}`);
      setForm(f => ({ ...f, quantity: '1', notes: '' }));
      fetchTransfers();
      const { data } = await supabase.from('products')
        .select('id, name, quantity, buy_price, sell_price, category')
        .eq('shop_id', from_shop_id).gt('quantity', 0).order('name');
      setFromProducts(data || []);
    } else {
      toastRef.current.warning('Transfer done but log failed');
    }
    setSaving(false);
  };

  return (
    <div className="fade-in">
      <div className="card mb-14">
        <div className="card-header"><span className="card-title">Transfer stock between branches</span></div>
        {shops.length < 2 ? (
          <div className="empty-state">
            <p>You need at least 2 branches to perform a transfer.</p>
          </div>
        ) : (
          <div className="transfer-form">
            <div className="transfer-route">
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">From branch</label>
                <select name="from_shop_id" className="form-select" value={form.from_shop_id} onChange={handleChange}>
                  <option value="">— Select —</option>
                  {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="transfer-arrow-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <div className="form-group" style={{ flex:1 }}>
                <label className="form-label">To branch</label>
                <select name="to_shop_id" className="form-select" value={form.to_shop_id} onChange={handleChange}>
                  <option value="">— Select —</option>
                  {shops.filter(s => s.id !== form.from_shop_id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product</label>
                <select name="product_id" className="form-select" value={form.product_id} onChange={handleChange}
                  disabled={!form.from_shop_id || fromProducts.length === 0}>
                  {fromProducts.length === 0
                    ? <option value="">No stock available</option>
                    : fromProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity} available)</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input name="quantity" type="number" min="1"
                  max={selectedProduct?.quantity || undefined}
                  className="form-input" value={form.quantity} onChange={handleChange} />
              </div>
            </div>
            {selectedProduct && (
              <div className="transfer-availability">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span><strong>{selectedProduct.quantity}</strong> units of <strong>{selectedProduct.name}</strong> available</span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input name="notes" type="text" className="form-input"
                placeholder="e.g. Urgent restock" value={form.notes} onChange={handleChange} />
            </div>
            <button className="btn btn-primary" onClick={handleTransfer} disabled={saving}
              style={{ alignSelf:'flex-start', minWidth:160 }}>
              {saving ? 'Transferring…' : 'Execute transfer'}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Transfer log
            <span style={{ color:'var(--text-secondary)', fontWeight:400, fontSize:12, marginLeft:8 }}>
              {transfers.length} records
            </span>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={fetchTransfers}>Refresh</button>
        </div>
        {loading ? (
          <div className="ov-loading" style={{ minHeight:100 }}><div className="spinner"/><span>Loading…</span></div>
        ) : loadError ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <p style={{ color: 'var(--red)', marginBottom: 12 }}>Could not load transfer log.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchTransfers()}>Retry</button>
          </div>
        ) : transfers.length === 0 ? (
          <div className="empty-state"><p>No transfers yet</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Product</th><th>From</th><th>To</th><th>Qty</th><th>Notes</th><th>Date</th></tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={t.id}>
                    <td style={{ color:'var(--text-tertiary)', fontSize:12 }}>{transfers.length-i}</td>
                    <td style={{ fontWeight:500 }}>{t.product_name}</td>
                    <td style={{ fontSize:12 }}>{t.from_shop?.name || '—'}</td>
                    <td style={{ fontSize:12 }}>{t.to_shop?.name || '—'}</td>
                    <td style={{ fontWeight:500 }}>{t.quantity}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{t.notes || '—'}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{fmtDate(t.created_at)}</td>
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

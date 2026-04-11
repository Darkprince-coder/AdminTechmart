// src/pages/ReportsPage.jsx  (ADMIN PROJECT — with period filter)

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useShop } from '../context/ShopContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { fmtKES } from '../lib/utils';
import { localDayStartIso, localDayEndIso, defaultCustomRangeStrings } from '../lib/reportDateRange';
import {
  downloadReportSummaryPdf,
  downloadSalesRegisterPdf,
  downloadLowStockReorderPdf,
} from '../lib/pdfExport';
import '../styles/reports.css';

const PERIODS = [
  { label: 'Today',      value: 'today' },
  { label: 'This week',  value: 'week'  },
  { label: 'This month', value: 'month' },
  { label: 'Custom',     value: 'custom' },
  { label: 'All time',   value: 'all'   },
];

function periodStart(period) {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now); d.setHours(0,0,0,0); return d.toISOString();
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d.toISOString();
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null;
}

export default function ReportsPage() {
  const { shops, activeShopId } = useShop();
  const toast = useToast();
  const [sales,    setSales]    = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [period,   setPeriod]   = useState('today');
  const [pdfBusy,  setPdfBusy]  = useState(null);
  const defRange = defaultCustomRangeStrings();
  const [customFrom, setCustomFrom] = useState(defRange.from);
  const [customTo,   setCustomTo]   = useState(defRange.to);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [salesRes, productsRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, shop_id, product_id, product_name, quantity, total_amount, profit, created_at, shops(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('id, shop_id, name, category, sell_price, buy_price, quantity, alert_qty, shops(name)')
        .order('name'),
    ]);
    if (salesRes.error && productsRes.error) {
      setLoadError(true);
      setSales([]);
      setProducts([]);
      toast.error(
        salesRes.error?.message || productsRes.error?.message || 'Could not load reports data.',
      );
    } else {
      setLoadError(false);
      setSales(salesRes.data    || []);
      setProducts(productsRes.data || []);
      if (salesRes.error) toast.error('Sales: ' + salesRes.error.message);
      if (productsRes.error) toast.error('Products: ' + productsRes.error.message);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- Filter by both branch AND period ----
  const branchSales = activeShopId === 'all'
    ? sales
    : sales.filter(s => s.shop_id === activeShopId);

  const { filterStartIso, filterEndIso, customInvalid } = useMemo(() => {
    if (period === 'all') return { filterStartIso: null, filterEndIso: null, customInvalid: false };
    if (period === 'custom') {
      if (!customFrom || !customTo) return { filterStartIso: null, filterEndIso: null, customInvalid: true };
      if (customFrom > customTo) return { filterStartIso: null, filterEndIso: null, customInvalid: true };
      return {
        filterStartIso: localDayStartIso(customFrom),
        filterEndIso: localDayEndIso(customTo),
        customInvalid: false,
      };
    }
    return {
      filterStartIso: periodStart(period),
      filterEndIso: null,
      customInvalid: false,
    };
  }, [period, customFrom, customTo]);

  const periodSales = useMemo(() => {
    if (period === 'all') return branchSales;
    if (period === 'custom' && customInvalid) return [];
    return branchSales.filter(s => {
      const ts = s.created_at;
      if (filterStartIso && ts < filterStartIso) return false;
      if (filterEndIso && ts > filterEndIso) return false;
      return true;
    });
  }, [branchSales, period, filterStartIso, filterEndIso, customInvalid]);

  const filteredProducts = activeShopId === 'all'
    ? products
    : products.filter(p => p.shop_id === activeShopId);

  // ---- Key metrics ----
  const totalRevenue = periodSales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const totalProfit  = periodSales.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const totalUnits   = periodSales.reduce((a, s) => a + (s.quantity           || 0), 0);
  const avgProfit    = periodSales.length ? totalProfit / periodSales.length : 0;

  // ---- 7-day bar chart (uses branchSales, not period-filtered, always shows 7 days) ----
  const dayMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-KE', { weekday: 'short' });
    dayMap[key] = 0;
  }
  branchSales.forEach(s => {
    const d    = new Date(s.created_at);
    const now  = new Date();
    const diff = Math.floor((now - d) / 86400000);
    if (diff <= 6) {
      const key = d.toLocaleDateString('en-KE', { weekday: 'short' });
      if (key in dayMap) dayMap[key] += Number(s.total_amount || 0);
    }
  });
  const dayEntries = Object.entries(dayMap);
  const maxDay     = Math.max(...dayEntries.map(e => e[1]), 1);
  const todayKey   = new Date().toLocaleDateString('en-KE', { weekday: 'short' });

  // ---- Category breakdown ----
  const catMap = {};
  periodSales.forEach(s => {
    const p   = products.find(x => x.id === s.product_id);
    const cat = p?.category || 'Other';
    if (!catMap[cat]) catMap[cat] = { rev:0, profit:0, units:0 };
    catMap[cat].rev    += Number(s.total_amount || 0);
    catMap[cat].profit += Number(s.profit       || 0);
    catMap[cat].units  += s.quantity || 0;
  });
  const catRows   = Object.entries(catMap).sort((a,b) => b[1].rev - a[1].rev);
  const maxCatRev = catRows.length ? catRows[0][1].rev : 1;

  // ---- Branch comparison (uses all-time branchSales scoped to period) ----
  const branchRows = shops.map(shop => {
    const ss = sales.filter(s => {
      if (s.shop_id !== shop.id) return false;
      if (period === 'all') return true;
      if (period === 'custom' && customInvalid) return false;
      const ts = s.created_at;
      if (filterStartIso && ts < filterStartIso) return false;
      if (filterEndIso && ts > filterEndIso) return false;
      return true;
    });
    const sp = products.filter(p => p.shop_id === shop.id);
    return {
      ...shop,
      rev:    ss.reduce((a,s) => a + Number(s.total_amount || 0), 0),
      profit: ss.reduce((a,s) => a + Number(s.profit       || 0), 0),
      units:  ss.reduce((a,s) => a + (s.quantity           || 0), 0),
      stock:  sp.reduce((a,p) => a + (p.quantity           || 0), 0),
      txns:   ss.length,
    };
  }).sort((a,b) => b.rev - a.rev);

  // ---- Top products ----
  const prodMap = {};
  periodSales.forEach(s => {
    const k = s.product_name || 'Unknown';
    if (!prodMap[k]) prodMap[k] = { rev:0, profit:0, units:0 };
    prodMap[k].rev    += Number(s.total_amount || 0);
    prodMap[k].profit += Number(s.profit       || 0);
    prodMap[k].units  += s.quantity || 0;
  });
  const topProducts = Object.entries(prodMap).sort((a,b) => b[1].rev - a[1].rev).slice(0, 10);

  // ---- Low stock ----
  const lowStockItems = filteredProducts
    .filter(p => (p.quantity||0) <= (p.alert_qty||5))
    .sort((a,b) => (a.quantity||0) - (b.quantity||0));

  const shopLabel = activeShopId === 'all'
    ? 'All branches'
    : (shops.find(s => s.id === activeShopId)?.name || 'Branch');
  const periodLabel = period === 'custom'
    ? 'Custom range'
    : (PERIODS.find(p => p.value === period)?.label || period);
  const rangeDescription = (() => {
    const end = new Date().toLocaleDateString('en-KE', { dateStyle: 'medium' });
    if (period === 'all') return `All recorded time · as at ${end}`;
    if (period === 'custom') {
      if (customInvalid || !customFrom || !customTo) return 'Invalid custom range';
      const a = new Date(customFrom + 'T12:00:00').toLocaleDateString('en-KE', { dateStyle: 'medium' });
      const b = new Date(customTo + 'T12:00:00').toLocaleDateString('en-KE', { dateStyle: 'medium' });
      return `${a} — ${b}`;
    }
    const st = periodStart(period);
    if (!st) return end;
    const start = new Date(st).toLocaleDateString('en-KE', { dateStyle: 'medium' });
    return `${start} — ${end}`;
  })();

  const runPdfExport = kind => {
    setPdfBusy(kind);
    window.setTimeout(() => {
      try {
        if (kind === 'summary') {
          downloadReportSummaryPdf({
            shopLabel,
            periodLabel,
            rangeDescription,
            metrics: {
              revenue: totalRevenue,
              profit: totalProfit,
              marginPct: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : null,
              units: totalUnits,
              txns: periodSales.length,
            },
            categoryRows: catRows.map(([name, d]) => ({
              name, rev: d.rev, profit: d.profit, units: d.units,
            })),
            topProductRows: topProducts.map(([name, d]) => ({
              name,
              rev: d.rev,
              profit: d.profit,
              units: d.units,
              marginPct: d.rev > 0 ? Math.round((d.profit / d.rev) * 100) : 0,
            })),
            branchRows: shops.length
              ? branchRows.map(b => ({
                name: b.name,
                rev: b.rev,
                profit: b.profit,
                marginPct: b.rev > 0 ? Math.round((b.profit / b.rev) * 100) : null,
                units: b.units,
                txns: b.txns,
                stock: b.stock,
              }))
              : [],
            lowStockRows: lowStockItems.map(p => ({
              name: p.name,
              category: p.category,
              branch: p.shops?.name,
              qty: p.quantity ?? 0,
              alert: p.alert_qty ?? 5,
              status: (p.quantity || 0) === 0 ? 'Out of stock' : 'Low stock',
            })),
            showBranchColumn: activeShopId === 'all',
          });
          toast.success('Summary report PDF downloaded');
        } else if (kind === 'sales') {
          downloadSalesRegisterPdf({
            shopLabel,
            periodLabel,
            rangeDescription,
            rows: [...periodSales]
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map(s => ({ ...s, branch: s.shops?.name })),
          });
          toast.success('Sales register PDF downloaded');
        } else if (kind === 'reorder') {
          downloadLowStockReorderPdf({
            shopLabel,
            rangeNote: rangeDescription,
            rows: lowStockItems.map(p => ({
              name: p.name,
              category: p.category,
              branch: p.shops?.name,
              qty: p.quantity ?? 0,
              alert: p.alert_qty ?? 5,
              buy: p.buy_price ?? 0,
              sell: p.sell_price ?? 0,
              status: (p.quantity || 0) === 0 ? 'Out of stock' : 'Low stock',
            })),
            showBranchColumn: activeShopId === 'all',
          });
          toast.success('Supplier reorder PDF downloaded');
        }
      } catch (err) {
        console.error(err);
        toast.error(err?.message || 'PDF export failed');
      } finally {
        setPdfBusy(null);
      }
    }, 0);
  };

  if (loading) return (
    <div className="ov-loading"><div className="spinner"/><span>Loading reports…</span></div>
  );

  if (loadError && !sales.length && !products.length) return (
    <div className="fade-in">
      <div className="card" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center', padding: '32px 24px' }}>
        <p style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>Reports could not be loaded.</p>
        <button type="button" className="btn btn-secondary" onClick={() => fetchData()}>Retry</button>
      </div>
    </div>
  );

  return (
    <div className="fade-in">

      {/* ---- FILTERS ROW ---- */}
      <div className="rep-filters-row mb-16">
        <div className="rep-period-group">
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`rep-period-btn ${period === p.value ? 'active' : ''}`}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="rep-filter-right">
          {activeShopId !== 'all' && (
            <span className="badge badge-teal" style={{ fontSize: 12 }}>
              {shops.find(s=>s.id===activeShopId)?.name}
            </span>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={fetchData}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="rep-custom-range mb-16">
          <label className="rep-custom-label">
            <span>From</span>
            <input
              type="date"
              className="form-input rep-custom-input"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
            />
          </label>
          <label className="rep-custom-label">
            <span>To</span>
            <input
              type="date"
              className="form-input rep-custom-input"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
            />
          </label>
          {customInvalid && (
            <span className="rep-custom-warn">Choose a valid from/to range (from ≤ to).</span>
          )}
        </div>
      )}

      {/* ---- PDF EXPORT ---- */}
      <div className="rep-export-panel mb-16">
        <div className="rep-export-intro">
          <div className="rep-export-title">Export PDF</div>
          <p className="rep-export-desc">
            Uses the same branch and period filters as above. Summary includes metrics, categories,
            top products, branch comparison, and a low-stock snapshot. Sales register is every
            transaction line. Reorder sheet is formatted for suppliers (qty + reference prices).
          </p>
        </div>
        <div className="rep-export-actions">
          <button
            type="button"
            className="rep-export-btn"
            disabled={!!pdfBusy}
            onClick={() => runPdfExport('summary')}
          >
            <span className="rep-export-btn-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </span>
            <span className="rep-export-btn-text">
              <strong>{pdfBusy === 'summary' ? 'Building…' : 'Summary report'}</strong>
              <small>Metrics, categories, top products, branches, low stock</small>
            </span>
          </button>
          <button
            type="button"
            className="rep-export-btn"
            disabled={!!pdfBusy}
            onClick={() => runPdfExport('sales')}
          >
            <span className="rep-export-btn-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </span>
            <span className="rep-export-btn-text">
              <strong>{pdfBusy === 'sales' ? 'Building…' : 'Sales register'}</strong>
              <small>All transactions in this period (landscape)</small>
            </span>
          </button>
          <button
            type="button"
            className="rep-export-btn"
            disabled={!!pdfBusy || lowStockItems.length === 0}
            title={lowStockItems.length === 0 ? 'No low-stock items for this scope' : undefined}
            onClick={() => runPdfExport('reorder')}
          >
            <span className="rep-export-btn-icon rep-export-btn-icon-warn" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </span>
            <span className="rep-export-btn-text">
              <strong>{pdfBusy === 'reorder' ? 'Building…' : 'Supplier reorder'}</strong>
              <small>Low / out-of-stock only ({lowStockItems.length})</small>
            </span>
          </button>
        </div>
      </div>

      {/* ---- METRICS ---- */}
      <div className="grid-4 mb-16">
        <div className="metric-card metric-teal">
          <div className="metric-label">Revenue</div>
          <div className="metric-value">{fmtKES(totalRevenue)}</div>
          <div className="metric-sub">{periodSales.length} transactions</div>
        </div>
        <div className="metric-card metric-teal">
          <div className="metric-label">Profit</div>
          <div className="metric-value" style={{ color:'var(--teal)' }}>{fmtKES(totalProfit)}</div>
          <div className="metric-sub up">
            {totalRevenue > 0 ? `${Math.round((totalProfit/totalRevenue)*100)}% margin` : '—'}
          </div>
        </div>
        <div className="metric-card metric-blue">
          <div className="metric-label">Units Sold</div>
          <div className="metric-value">{totalUnits}</div>
          <div className="metric-sub">{periodSales.length} transactions</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Avg Profit / Sale</div>
          <div className="metric-value">{fmtKES(Math.round(avgProfit))}</div>
          <div className="metric-sub">per transaction</div>
        </div>
      </div>

      {/* ---- 7-DAY CHART + CATEGORY ---- */}
      <div className="grid-2 mb-16">

        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenue — last 7 days</span>
          </div>
          <div className="rep-chart">
            {dayEntries.map(([day, val]) => {
              const pct     = Math.round((val / maxDay) * 100);
              const isToday = day === todayKey;
              return (
                <div key={day} className="rep-bar-col">
                  <div className="rep-bar-amount">
                    {val > 0 ? (val >= 1000 ? `${(val/1000).toFixed(0)}k` : String(Math.round(val))) : ''}
                  </div>
                  <div className="rep-bar-track-v">
                    <div
                      className={`rep-bar-v ${isToday ? 'rep-bar-today' : ''}`}
                      style={{ height: `${Math.max(pct, val > 0 ? 5 : 0)}%` }}
                      title={`${day}: ${fmtKES(val)}`}
                    />
                  </div>
                  <div className="rep-bar-day">{day}</div>
                </div>
              );
            })}
          </div>
          {dayEntries.every(([,v]) => v === 0) && (
            <p style={{ textAlign:'center', fontSize:13, color:'var(--text-secondary)', marginTop:10 }}>
              No sales in the last 7 days
            </p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">By category</span>
            <span className="badge badge-neutral">{catRows.length}</span>
          </div>
          {catRows.length === 0 ? (
            <div className="empty-state"><p>No sales in this period</p></div>
          ) : (
            <div className="rep-cat-list">
              {catRows.map(([cat, d]) => (
                <div key={cat} className="rep-cat-row">
                  <div className="rep-cat-header">
                    <span className="rep-cat-name">{cat}</span>
                    <span className="rep-cat-rev">{fmtKES(d.rev)}</span>
                  </div>
                  <div className="rep-bar-wrap">
                    <div className="rep-bar-fill"
                      style={{ width:`${Math.round((d.rev/maxCatRev)*100)}%` }}/>
                  </div>
                  <div className="rep-cat-sub">
                    <span>Profit: {fmtKES(d.profit)}</span>
                    <span>{d.units} units</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- TOP PRODUCTS ---- */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Top products</span>
          <span className="badge badge-neutral">{topProducts.length} products</span>
        </div>
        {topProducts.length === 0 ? (
          <div className="empty-state"><p>No sales in this period</p></div>
        ) : (
          <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Product</th><th>Revenue</th><th>Profit</th><th>Margin</th><th>Units</th></tr>
            </thead>
            <tbody>
              {topProducts.map(([name, d], i) => {
                const mg = d.rev > 0 ? Math.round((d.profit/d.rev)*100) : 0;
                return (
                  <tr key={name}>
                    <td style={{ color:'var(--text-tertiary)', fontSize:12 }}>{i+1}</td>
                    <td style={{ fontWeight:500 }}>{name}</td>
                    <td>{fmtKES(d.rev)}</td>
                    <td style={{ color:'var(--teal)', fontWeight:600 }}>{fmtKES(d.profit)}</td>
                    <td>
                      <span style={{ fontSize:12, fontWeight:600,
                        color: mg>=20?'var(--teal)':mg>0?'var(--amber)':'var(--red)' }}>
                        {mg}%
                      </span>
                    </td>
                    <td>{d.units}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* ---- BRANCH COMPARISON ---- */}
      {shops.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <span className="card-title">Branch comparison</span>
            <span className="badge badge-neutral" style={{ fontSize:11 }}>
              {PERIODS.find(p=>p.value===period)?.label}
            </span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Branch</th><th>Revenue</th><th>Profit</th>
                  <th>Margin</th><th>Units</th><th>Transactions</th><th>Stock (live)</th>
                </tr>
              </thead>
              <tbody>
                {branchRows.map((b, i) => (
                  <tr key={b.id}>
                    <td>
                      <span className={`badge ${i===0?'badge-teal':i===1?'badge-info':'badge-neutral'}`}>
                        #{i+1}
                      </span>
                    </td>
                    <td style={{ fontWeight:600 }}>{b.name}</td>
                    <td>{fmtKES(b.rev)}</td>
                    <td style={{ color:'var(--teal)', fontWeight:600 }}>{fmtKES(b.profit)}</td>
                    <td style={{ fontSize:12 }}>
                      {b.rev>0?`${Math.round((b.profit/b.rev)*100)}%`:'—'}
                    </td>
                    <td>{b.units}</td>
                    <td>{b.txns}</td>
                    <td>{b.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- LOW STOCK ---- */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Low stock report</span>
          <span className={`badge ${lowStockItems.length>0?'badge-warn':'badge-ok'}`}>
            {lowStockItems.length} items
          </span>
        </div>
        {lowStockItems.length === 0 ? (
          <div className="empty-state"><p>All products are well stocked</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th><th>Category</th>
                  {activeShopId==='all' && <th>Branch</th>}
                  <th>Stock</th><th>Alert at</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight:500 }}>{p.name}</td>
                    <td><span className="badge badge-info">{p.category||'—'}</span></td>
                    {activeShopId==='all' && (
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                        {p.shops?.name||'—'}
                      </td>
                    )}
                    <td style={{ fontWeight:700,
                      color:(p.quantity||0)===0?'var(--red)':'var(--amber)' }}>
                      {p.quantity??0}
                    </td>
                    <td style={{ color:'var(--text-secondary)' }}>{p.alert_qty||5}</td>
                    <td>
                      <span className={`badge badge-${(p.quantity||0)===0?'danger':'warn'}`}>
                        {(p.quantity||0)===0?'Out of stock':'Low stock'}
                      </span>
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

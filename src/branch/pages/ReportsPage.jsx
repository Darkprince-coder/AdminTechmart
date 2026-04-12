// src/pages/ReportsPage.jsx  (BRANCH APP)
// All financial figures (revenue, profit, margin, cost) are gated behind isAdmin.
// Branch managers see operational metrics: units, transactions, stock counts, averages.

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { fmtKES, stockStatus } from '../lib/utils';
import NoShopAssigned from '../components/NoShopAssigned';
import '../styles/reports.css';

const PERIODS = [
  { label: 'Today',      value: 'today' },
  { label: 'This week',  value: 'week'  },
  { label: 'This month', value: 'month' },
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
  const { shopId, isAdmin } = useAuth();
  const [sales,    setSales]    = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState('today');

  const fetchData = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    const [salesRes, prodRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, product_name, quantity, unit_price, buy_price, total_amount, profit, created_at')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('id, name, category, sell_price, buy_price, quantity, alert_qty')
        .eq('shop_id', shopId)
        .order('name'),
    ]);
    if (!salesRes.error) setSales(salesRes.data || []);
    if (!prodRes.error)  setProducts(prodRes.data || []);
    setLoading(false);
  }, [shopId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!shopId) return <NoShopAssigned />;

  // ---- Filter sales by period ----
  const start = periodStart(period);
  const periodSales = start ? sales.filter(s => s.created_at >= start) : sales;

  // ---- Key metrics ----
  const revenue   = periodSales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const profit    = periodSales.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const unitsSold = periodSales.reduce((a, s) => a + (s.quantity           || 0), 0);
  const txnCount  = periodSales.length;
  const profitPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const avgSale   = txnCount > 0 ? revenue / txnCount : 0;
  const avgProfit = txnCount > 0 ? profit  / txnCount : 0;

  // ---- Category breakdown ----
  const catMap = {};
  periodSales.forEach(s => {
    const prod = products.find(p => p.name === s.product_name);
    const cat  = prod?.category || 'Uncategorised';
    if (!catMap[cat]) catMap[cat] = { rev: 0, profit: 0, units: 0 };
    catMap[cat].rev    += Number(s.total_amount || 0);
    catMap[cat].profit += Number(s.profit       || 0);
    catMap[cat].units  += s.quantity || 0;
  });
  // Sort: admin by revenue, manager by units
  const catRows   = Object.entries(catMap).sort((a, b) =>
    isAdmin ? b[1].rev - a[1].rev : b[1].units - a[1].units
  );
  const maxCatVal = catRows.length ? catRows[0][1][isAdmin ? 'rev' : 'units'] : 1;

  // ---- Top products ----
  const prodMap = {};
  periodSales.forEach(s => {
    const k = s.product_name || 'Unknown';
    if (!prodMap[k]) prodMap[k] = { rev: 0, profit: 0, units: 0 };
    prodMap[k].rev    += Number(s.total_amount || 0);
    prodMap[k].profit += Number(s.profit       || 0);
    prodMap[k].units  += s.quantity || 0;
  });
  const topProducts = Object.entries(prodMap)
    .sort((a, b) => isAdmin ? b[1].rev - a[1].rev : b[1].units - a[1].units)
    .slice(0, 8);
  const topCategory = catRows.length ? { cat: catRows[0][0], units: catRows[0][1].units } : null;

  // ---- Daily revenue for mini bar chart (last 7 days — always based on sales volume) ----
  const dayMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-KE', { weekday: 'short' });
    dayMap[key] = { rev: 0, units: 0 };
  }
  sales.forEach(s => {
    const d = new Date(s.created_at);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays <= 6) {
      const key = d.toLocaleDateString('en-KE', { weekday: 'short' });
      if (key in dayMap) {
        dayMap[key].rev   += Number(s.total_amount || 0);
        dayMap[key].units += s.quantity || 0;
      }
    }
  });
  const dayEntries = Object.entries(dayMap);
  // Chart value: revenue for admin, units for manager
  const dayVals = dayEntries.map(([, v]) => isAdmin ? v.rev : v.units);
  const maxDay  = Math.max(...dayVals, 1);

  // ---- Low stock / OOS ----
  const lowStock = products.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) <= (p.alert_qty || 5));
  const oos      = products.filter(p => (p.quantity || 0) === 0);

  // ---- Stock value (admin only) ----
  const stockValue = products.reduce((a, p) => a + (p.sell_price || 0) * (p.quantity || 0), 0);
  const stockCost  = products.reduce((a, p) => a + (p.buy_price  || 0) * (p.quantity || 0), 0);
  const totalUnits = products.reduce((a, p) => a + (p.quantity   || 0), 0);

  if (loading) return (
    <div className="rep-loading"><div className="spinner"/><span>Loading reports…</span></div>
  );

  return (
    <div className="fade-up">

      {/* ---- PERIOD SELECTOR ---- */}
      <div className="rep-period-bar mb-md">
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
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={fetchData}>
          Refresh
        </button>
      </div>

      {/* ---- KEY METRICS ---- */}
      <div className="grid-4 mb-md">
        {isAdmin ? (
          <>
            <div className="metric-card metric-brand">
              <div className="metric-label">Revenue</div>
              <div className="metric-value">{fmtKES(revenue)}</div>
              <div className="metric-sub up">{txnCount} transaction{txnCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="metric-card metric-brand">
              <div className="metric-label">Profit</div>
              <div className="metric-value" style={{ color: 'var(--brand)' }}>{fmtKES(profit)}</div>
              <div className="metric-sub up">{profitPct}% margin</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Units Sold</div>
              <div className="metric-value">{unitsSold}</div>
              <div className="metric-sub">{txnCount} transactions</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg Profit / Sale</div>
              <div className="metric-value">{fmtKES(Math.round(avgProfit))}</div>
              <div className="metric-sub">avg sale {fmtKES(Math.round(avgSale))}</div>
            </div>
          </>
        ) : (
          <>
            <div className="metric-card metric-brand">
              <div className="metric-label">Transactions</div>
              <div className="metric-value">{txnCount}</div>
              <div className="metric-sub up">{unitsSold} units sold</div>
            </div>
            <div className="metric-card metric-brand">
              <div className="metric-label">Units Sold</div>
              <div className="metric-value">{unitsSold}</div>
              <div className="metric-sub">{txnCount} transactions</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg Units / Sale</div>
              <div className="metric-value">
                {txnCount > 0 ? (unitsSold / txnCount).toFixed(1) : '0'}
              </div>
              <div className="metric-sub">units per transaction</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Top Category</div>
              <div className="metric-value" style={{ fontSize: 16, letterSpacing: '-.01em' }}>
                {topCategory ? topCategory.cat : '—'}
              </div>
              <div className="metric-sub">{topCategory ? `${topCategory.units} units` : 'No data'}</div>
            </div>
          </>
        )}
      </div>

      {/* ---- CHART + CATEGORY BREAKDOWN ---- */}
      <div className="grid-2 mb-md">

        {/* Bar chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {isAdmin ? 'Revenue' : 'Units sold'} — last 7 days
            </span>
          </div>
          <div className="rep-chart">
            {dayEntries.map(([day, vals]) => {
              const val     = isAdmin ? vals.rev : vals.units;
              const pct     = Math.round((val / maxDay) * 100);
              const isToday = day === new Date().toLocaleDateString('en-KE', { weekday: 'short' });
              return (
                <div key={day} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div
                      className={`rep-bar ${isToday ? 'today' : ''}`}
                      style={{ height: `${Math.max(pct, val > 0 ? 4 : 0)}%` }}
                      title={isAdmin ? fmtKES(val) : `${val} units`}
                    />
                  </div>
                  <div className="rep-bar-label">{day}</div>
                  {val > 0 && (
                    <div className="rep-bar-val">
                      {isAdmin
                        ? (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)
                        : val}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">By category</span>
            <span className="badge badge-neutral">{catRows.length} categories</span>
          </div>
          {catRows.length === 0 ? (
            <div className="empty-state"><p>No sales in this period.</p></div>
          ) : (
            <div className="rep-cat-list">
              {catRows.map(([cat, d]) => (
                <div key={cat} className="rep-cat-row">
                  <div className="rep-cat-header">
                    <span className="rep-cat-name">{cat}</span>
                    <span className="rep-cat-rev">
                      {isAdmin ? fmtKES(d.rev) : `${d.units} units`}
                    </span>
                  </div>
                  <div className="rep-bar-track">
                    <div
                      className="rep-bar-fill"
                      style={{
                        width: `${Math.round(
                          (d[isAdmin ? 'rev' : 'units'] / maxCatVal) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="rep-cat-sub">
                    {isAdmin ? (
                      <>
                        <span>Profit: <strong>{fmtKES(d.profit)}</strong></span>
                        <span>{d.units} unit{d.units !== 1 ? 's' : ''} sold</span>
                      </>
                    ) : (
                      <span>{d.units} unit{d.units !== 1 ? 's' : ''} sold</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- TOP PRODUCTS ---- */}
      <div className="card mb-md">
        <div className="card-header">
          <span className="card-title">Top products</span>
          <span className="badge badge-neutral">{topProducts.length} products</span>
        </div>
        {topProducts.length === 0 ? (
          <div className="empty-state"><p>No sales in this period.</p></div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="rep-top-mobile">
              {topProducts.map(([name, d], i) => (
                <div key={name} className="rep-top-card">
                  <div className="rep-top-rank">{i + 1}</div>
                  <div className="rep-top-info">
                    <div className="rep-top-name">{name}</div>
                    <div className="rep-top-stats">
                      <span>{d.units} units</span>
                      {isAdmin && <span className="rep-top-profit">+{fmtKES(d.profit)} profit</span>}
                    </div>
                  </div>
                  <div className="rep-top-rev">
                    {isAdmin ? fmtKES(d.rev) : `${d.units} units`}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="table-wrap rep-top-desktop">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    {isAdmin && <th>Revenue</th>}
                    {isAdmin && <th>Profit</th>}
                    {isAdmin && <th>Margin</th>}
                    <th>Units sold</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(([name, d], i) => {
                    const prodMargin = d.rev > 0 ? Math.round((d.profit / d.rev) * 100) : 0;
                    return (
                      <tr key={name}>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{name}</td>
                        {isAdmin && <td style={{ fontWeight: 600 }}>{fmtKES(d.rev)}</td>}
                        {isAdmin && (
                          <td style={{ color: 'var(--brand)', fontWeight: 600 }}>
                            {fmtKES(d.profit)}
                          </td>
                        )}
                        {isAdmin && (
                          <td>
                            <span style={{
                              fontSize: 12, fontWeight: 600,
                              color: prodMargin >= 20 ? 'var(--brand)' : prodMargin > 0 ? 'var(--amber)' : 'var(--red)',
                            }}>
                              {prodMargin}%
                            </span>
                          </td>
                        )}
                        <td>{d.units}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ---- STOCK HEALTH ---- */}
      <div className="grid-2 mb-md">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{isAdmin ? 'Stock value' : 'Inventory health'}</span>
          </div>
          <div className="rep-stock-stats">
            {isAdmin ? (
              <>
                <div className="rep-stock-item">
                  <div className="metric-label">Retail value</div>
                  <div className="rep-stock-val">{fmtKES(stockValue)}</div>
                  <div className="metric-sub">at sell price</div>
                </div>
                <div className="rep-stock-item">
                  <div className="metric-label">Cost value</div>
                  <div className="rep-stock-val">{fmtKES(stockCost)}</div>
                  <div className="metric-sub">at buy price</div>
                </div>
              </>
            ) : (
              <>
                <div className="rep-stock-item">
                  <div className="metric-label">Total products</div>
                  <div className="rep-stock-val">{products.length}</div>
                  <div className="metric-sub">SKUs</div>
                </div>
                <div className="rep-stock-item">
                  <div className="metric-label">Total units</div>
                  <div className="rep-stock-val">{totalUnits}</div>
                  <div className="metric-sub">in stock</div>
                </div>
                <div className="rep-stock-item">
                  <div className="metric-label">Low stock</div>
                  <div className="rep-stock-val">{lowStock.length}</div>
                  <div className="metric-sub">need restock</div>
                </div>
                <div className="rep-stock-item">
                  <div className="metric-label">Out of stock</div>
                  <div className="rep-stock-val">{oos.length}</div>
                  <div className="metric-sub">unavailable</div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Stock alerts</span>
            <span className={`badge ${oos.length > 0 ? 'badge-danger' : lowStock.length > 0 ? 'badge-warn' : 'badge-ok'}`}>
              {oos.length + lowStock.length} items
            </span>
          </div>
          {oos.length === 0 && lowStock.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <p>All products are well stocked.</p>
            </div>
          ) : (
            <div className="rep-alerts-list">
              {oos.map(p => (
                <div key={p.id} className="rep-alert-row rep-alert-oos">
                  <div>
                    <div className="rep-alert-name">{p.name}</div>
                    <div className="rep-alert-cat">{p.category}</div>
                  </div>
                  <span className="badge badge-danger">Out of stock</span>
                </div>
              ))}
              {lowStock.map(p => (
                <div key={p.id} className="rep-alert-row rep-alert-low">
                  <div>
                    <div className="rep-alert-name">{p.name}</div>
                    <div className="rep-alert-cat">{p.category} · {p.quantity} remaining</div>
                  </div>
                  <span className="badge badge-warn">Low stock</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
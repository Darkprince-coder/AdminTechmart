// src/pages/DashboardPage.jsx  (BRANCH APP — correct schema columns)
// products: quantity, alert_qty, buy_price, sell_price
// sales:    total_amount, profit, product_name, customer_name

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { fmtKES, fmtTime, isToday } from '../lib/utils';
import '../styles/dashboard.css';

export default function DashboardPage({ onNavigate }) {
  const { shopId } = useAuth();
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [prodRes, salesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, category, sell_price, buy_price, quantity, alert_qty')
          .eq('shop_id', shopId),
        supabase
          .from('sales')
          .select('id, product_name, customer_name, quantity, total_amount, profit, created_at')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);
      if (prodRes.error)  throw prodRes.error;
      if (salesRes.error) throw salesRes.error;
      setData({ products: prodRes.data || [], sales: salesRes.data || [] });
    } catch (err) {
      console.error('[Dashboard]', err.message);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="dash-loading">
      <div className="spinner"/>
      <span>Loading dashboard…</span>
    </div>
  );

  if (loadError || !data) return (
    <div className="dash-loading" style={{ flexDirection: 'column', gap: 14 }}>
      <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
        Could not load data. Check your connection.
      </p>
      <button className="btn btn-secondary btn-sm" onClick={load}>Retry</button>
    </div>
  );

  const { products, sales } = data;

  // Today only
  const todaySales  = sales.filter(s => isToday(s.created_at));
  const todayRev    = todaySales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const todayProfit = todaySales.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const todayUnits  = todaySales.reduce((a, s) => a + (s.quantity           || 0), 0);
  const todayMargin = todayRev > 0 ? Math.round((todayProfit / todayRev) * 100) : 0;

  // Stock
  const totalStockVal = products.reduce((a, p) => a + (p.sell_price || 0) * (p.quantity || 0), 0);
  const lowItems      = products.filter(p => (p.quantity || 0) > 0 && (p.quantity || 0) <= (p.alert_qty || 5));
  const oosItems      = products.filter(p => (p.quantity || 0) === 0);
  const alertCount    = lowItems.length + oosItems.length;
  const alertItems    = [
    ...oosItems.map(p => ({ ...p, status: 'oos' })),
    ...lowItems.map(p => ({ ...p, status: 'low' })),
  ];
  const alertPreview  = alertItems.slice(0, 4);

  // Top sellers (all time)
  const prodRevMap = {};
  sales.forEach(s => {
    const k = s.product_name || 'Unknown';
    prodRevMap[k] = (prodRevMap[k] || 0) + Number(s.total_amount || 0);
  });
  const topSellers  = Object.entries(prodRevMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const recentSales = sales.slice(0, 5);

  return (
    <div className="fade-up">

      {/* ---- METRICS ---- */}
      <div className="grid-4 mb-md">
        <div className="metric-card metric-brand">
          <div className="metric-label">Today's Revenue</div>
          <div className="metric-value">{fmtKES(todayRev)}</div>
          <div className="metric-sub up">
            {todaySales.length} transaction{todaySales.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="metric-card metric-brand">
          <div className="metric-label">Today's Profit</div>
          <div className="metric-value" style={{ color: 'var(--brand)' }}>
            {fmtKES(todayProfit)}
          </div>
          <div className="metric-sub up">{todayMargin}% margin</div>
        </div>
        <div className="metric-card metric-blue">
          <div className="metric-label">Stock Value</div>
          <div className="metric-value">{fmtKES(totalStockVal)}</div>
          <div className="metric-sub">
            {products.reduce((a, p) => a + (p.quantity || 0), 0)} units · {products.length} SKUs
          </div>
        </div>
        <div className={`metric-card ${oosItems.length > 0 ? 'metric-red' : lowItems.length > 0 ? 'metric-amber' : ''}`}>
          <div className="metric-label">Stock Alerts</div>
          <div className="metric-value" style={{
            color: oosItems.length > 0 ? 'var(--red)'
              : lowItems.length > 0 ? 'var(--amber)'
              : 'var(--brand)',
          }}>
            {oosItems.length + lowItems.length}
          </div>
          <div className={`metric-sub ${oosItems.length > 0 ? 'danger' : lowItems.length > 0 ? 'warn' : 'up'}`}>
            {oosItems.length > 0 ? `${oosItems.length} out of stock`
              : lowItems.length > 0 ? `${lowItems.length} low stock`
              : 'All stocked'}
          </div>
        </div>
      </div>

      {/* ---- STOCK ALERTS (admin-style card) ---- */}
      <div className="mb-md">
        {alertCount > 0 ? (
          <div className="card dash-stock-card">
            <div className="card-header">
              <div>
                <div className="card-title dash-stock-card-title">
                  <span className="dash-stock-alert-dot" aria-hidden />
                  Stock alerts
                </div>
                <div className="dash-stock-card-sub">
                  {alertCount} item{alertCount !== 1 ? 's' : ''} need attention
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onNavigate('inventory')}>
                View all
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
            <div className="dash-stock-list">
              {alertPreview.map(p => (
                <div key={p.id} className={`dash-stock-item ${p.status}`}>
                  <div className="dash-stock-item-left">
                    <div className={`dash-stock-badge ${p.status}`}>
                      {p.status === 'oos' ? '0' : p.quantity}
                    </div>
                    <div className="dash-stock-item-text">
                      <div className="dash-stock-name">{p.name}</div>
                      <div className="dash-stock-meta">
                        {p.category || 'Uncategorized'}
                        {p.status === 'low' && (
                          <> · alert at {p.alert_qty || 5}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${p.status === 'oos' ? 'badge-danger' : 'badge-warn'}`}>
                    {p.status === 'oos' ? 'Out of stock' : 'Low stock'}
                  </span>
                </div>
              ))}
            </div>
            {alertCount > 4 && (
              <button type="button" className="dash-stock-more" onClick={() => onNavigate('inventory')}>
                +{alertCount - 4} more — View in Inventory
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="card dash-stock-card dash-stock-all-good">
            <div className="dash-stock-good-inner">
              <div className="dash-stock-good-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="dash-stock-good-title">All stock levels healthy</div>
              <div className="dash-stock-good-desc">No products are running low right now.</div>
            </div>
          </div>
        )}
      </div>

      {/* ---- RECENT SALES + TOP SELLERS ---- */}
      <div className="grid-2 mb-md">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent sales</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('sales')}>
              View all
            </button>
          </div>
          {recentSales.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                </svg>
              </div>
              <p>No sales yet. Go to Sales to record one.</p>
            </div>
          ) : (
            <div className="dash-sales-list">
              {recentSales.map(s => (
                <div key={s.id} className="dash-sale-row">
                  <div className="dash-sale-avatar">
                    {(s.product_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="dash-sale-info">
                    <div className="dash-sale-name">
                      {s.product_name || 'Unknown product'}
                    </div>
                    <div className="dash-sale-meta">
                      {s.customer_name || 'Walk-in'} · {s.quantity} unit{s.quantity !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="dash-sale-right">
                    <div className="dash-sale-amount">{fmtKES(s.total_amount)}</div>
                    <div className="dash-sale-time">{fmtTime(s.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Top selling products</span>
            <span className="badge badge-neutral">All time</span>
          </div>
          {topSellers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6"  y1="20" x2="6"  y2="14"/>
                </svg>
              </div>
              <p>Sales data will appear here once transactions are recorded.</p>
            </div>
          ) : (
            <div className="dash-top-list">
              {topSellers.map(([name, rev], i) => {
                const pct = Math.round((rev / topSellers[0][1]) * 100);
                return (
                  <div key={name} className="dash-top-row">
                    <div className="dash-top-meta">
                      <span className="dash-top-rank">{i + 1}</span>
                      <span className="dash-top-name">{name}</span>
                    </div>
                    <div className="dash-top-bar-wrap">
                      <div className="dash-top-bar" style={{ width: `${pct}%` }}/>
                    </div>
                    <span className="dash-top-rev">{fmtKES(rev)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---- TODAY STATS + QUICK ACTIONS ---- */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Today's breakdown</span>
          </div>
          <div className="dash-today-grid">
            {[
              { label: 'Units sold',      value: todayUnits },
              { label: 'Transactions',    value: todaySales.length },
              { label: 'Avg per sale',    value: todaySales.length ? fmtKES(Math.round(todayRev    / todaySales.length)) : 'KSh 0' },
              { label: 'Avg profit/sale', value: todaySales.length ? fmtKES(Math.round(todayProfit / todaySales.length)) : 'KSh 0' },
            ].map(item => (
              <div key={item.label} className="dash-today-stat">
                <div className="metric-label">{item.label}</div>
                <div className="dash-today-val">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Quick actions</span>
          </div>
          <div className="dash-actions">
            {[
              {
                label: 'Record a sale', sub: 'Add a new transaction', page: 'sales',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>,
              },
              {
                label: 'Add product', sub: 'Stock a new item', page: 'inventory',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
              },
              {
                label: 'View reports', sub: 'Revenue and profit analysis', page: 'reports',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
              },
            ].map(item => (
              <button key={item.label} className="dash-action-btn" onClick={() => onNavigate(item.page)}>
                <div className="dash-action-icon">{item.icon}</div>
                <div>
                  <div className="dash-action-label">{item.label}</div>
                  <div className="dash-action-sub">{item.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

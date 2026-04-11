// src/pages/OverviewPage.jsx  (ADMIN PROJECT — full redesign)
// Uses recharts for area chart. Install: npm install recharts

import { useEffect, useState, useCallback } from 'react';
import { useNavigate }     from 'react-router-dom';
import { useShop }         from '../context/ShopContext';
import { useToast }        from '../context/ToastContext';
import { supabase }        from '../lib/supabase';
import { fmtKES, isToday } from '../lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import '../styles/overview.css';

export default function OverviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { shops, activeShopId, setActiveShopId } = useShop();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [prodRes, salesRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, shop_id, name, category, sell_price, buy_price, quantity, alert_qty'),
        supabase
          .from('sales')
          .select('id, shop_id, product_name, quantity, total_amount, profit, created_at'),
      ]);
      if (prodRes.error || salesRes.error) {
        setLoadError(true);
        setStats({ products: [], sales: [] });
        toast.error(prodRes.error?.message || salesRes.error?.message || 'Could not load overview.');
      } else {
        setStats({
          products: prodRes.data  || [],
          sales:    salesRes.data || [],
        });
      }
    } catch (err) {
      console.error('Overview fetch:', err);
      setLoadError(true);
      setStats({ products: [], sales: [] });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) return (
    <div className="ov-loading"><div className="spinner"/><span>Loading dashboard…</span></div>
  );

  if (loadError || !stats) return (
    <div className="ov-loading" style={{ flexDirection: 'column', gap: 14 }}>
      <p style={{ color: 'var(--red)', fontSize: 14, textAlign: 'center', maxWidth: 320 }}>
        Could not load dashboard data.
      </p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchStats()}>Retry</button>
    </div>
  );

  const { products, sales } = stats;

  // Filter by active shop
  const fp = activeShopId === 'all' ? products : products.filter(p => p.shop_id === activeShopId);
  const fs = activeShopId === 'all' ? sales    : sales.filter(s => s.shop_id === activeShopId);

  // Metrics
  const totalRev    = fs.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const totalProfit = fs.reduce((a, s) => a + Number(s.profit       || 0), 0);
  const totalStock  = fp.reduce((a, p) => a + (p.quantity           || 0), 0);
  const stockValue  = fp.reduce((a, p) => a + (p.sell_price||0) * (p.quantity||0), 0);
  const todaySales  = fs.filter(s => isToday(s.created_at));
  const todayRev    = todaySales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const lowItems    = fp.filter(p => (p.quantity||0) > 0 && (p.quantity||0) <= (p.alert_qty||5));
  const oosItems    = fp.filter(p => (p.quantity||0) === 0);
  const alertCount  = lowItems.length + oosItems.length;

  // Per-branch
  const branchStats = shops.map(shop => {
    const sp = products.filter(p => p.shop_id === shop.id);
    const ss = sales.filter(s => s.shop_id === shop.id);
    return {
      ...shop,
      rev:    ss.reduce((a,s) => a + Number(s.total_amount||0), 0),
      profit: ss.reduce((a,s) => a + Number(s.profit||0), 0),
      items:  sp.reduce((a,p) => a + (p.quantity||0), 0),
      low:    sp.filter(p => (p.quantity||0) <= (p.alert_qty||5) && (p.quantity||0) > 0).length,
      oos:    sp.filter(p => (p.quantity||0) === 0).length,
    };
  }).sort((a,b) => b.rev - a.rev);

  // Top products
  const prodRevMap = {};
  fs.forEach(s => {
    const k = s.product_name || 'Unknown';
    prodRevMap[k] = (prodRevMap[k] || 0) + Number(s.total_amount || 0);
  });
  const topProducts = Object.entries(prodRevMap).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // 7-day chart data
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-KE', { weekday: 'short' });
    const dateStr = d.toISOString().split('T')[0];
    const rev = fs.filter(s => s.created_at?.startsWith(dateStr))
                  .reduce((a,s) => a + Number(s.total_amount||0), 0);
    return { day: label, revenue: rev };
  });

  // Stock alerts (sorted worst first — OOS then low)
  const alertItems = [
    ...oosItems.map(p => ({ ...p, status: 'oos' })),
    ...lowItems.map(p => ({ ...p, status: 'low' })),
  ].slice(0, 4); // max 4 on dashboard

  return (
    <div className="fade-in">

      {/* ── METRICS ── */}
      <div className="grid-4 mb-md stagger">
        <MetricCard
          label="Today's Revenue" value={fmtKES(todayRev)}
          sub={`${todaySales.length} transactions today`}
          color="mc-emerald" subClass="up"
          icon={<RevenueIcon/>}
        />
        <MetricCard
          label="Total Profit"    value={fmtKES(totalProfit)}
          sub={totalRev > 0 ? `${Math.round((totalProfit/totalRev)*100)}% margin` : '—'}
          color="mc-blue" subClass="up"
          icon={<ProfitIcon/>}
        />
        <MetricCard
          label="Stock Value"    value={fmtKES(stockValue)}
          sub={`${fp.length} SKUs · ${totalStock} units`}
          color="mc-violet" subClass=""
          icon={<StockIcon/>}
        />
        <MetricCard
          label="Stock Alerts"   value={alertCount}
          sub={oosItems.length > 0 ? `${oosItems.length} out of stock` : `${lowItems.length} low stock`}
          color={alertCount > 0 ? (oosItems.length > 0 ? 'mc-red' : 'mc-amber') : 'mc-emerald'}
          subClass={oosItems.length > 0 ? 'danger' : alertCount > 0 ? 'warn' : 'up'}
          icon={<AlertIcon/>}
        />
      </div>

      {/* ── REVENUE CHART + STOCK ALERT CARD ── */}
      <div className="ov-chart-row mb-md">
        {/* Area chart */}
        <div className="card ov-chart-card">
          <div className="card-header">
            <div>
              <div className="card-title">Revenue — last 7 days</div>
              <div className="card-subtitle">
                {activeShopId === 'all' ? 'All branches' : shops.find(s=>s.id===activeShopId)?.name}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:20, fontWeight:800, fontFamily:'var(--font-mono)',
                color:'var(--emerald)', letterSpacing:'-.03em' }}>
                {fmtKES(totalRev)}
              </div>
              <div style={{ fontSize:12, color:'var(--text-tertiary)' }}>All-time revenue</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--emerald)" stopOpacity={.25}/>
                  <stop offset="95%" stopColor="var(--emerald)" stopOpacity={.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" />
              <XAxis dataKey="day" tick={{ fontSize:11, fill:'var(--text-tertiary)', fontFamily:'var(--font)' }}
                axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:10, fill:'var(--text-tertiary)', fontFamily:'var(--font-mono)' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}/>
              <Tooltip
                contentStyle={{
                  background:'var(--bg-card)',
                  border:'1px solid var(--border-soft)',
                  borderRadius:'var(--r-sm)',
                  boxShadow:'var(--shadow-md)',
                  fontSize:13,
                  fontFamily:'var(--font)',
                  color:'var(--text-primary)',
                }}
                formatter={v => [fmtKES(v), 'Revenue']}
                labelStyle={{ color:'var(--text-secondary)', fontWeight:600 }}
                cursor={{ stroke:'var(--emerald)', strokeWidth:1, strokeDasharray:'4 4' }}
              />
              <Area type="monotone" dataKey="revenue"
                stroke="var(--emerald)" strokeWidth={2.5}
                fill="url(#revGrad)"
                dot={{ fill:'var(--emerald)', r:3, strokeWidth:0 }}
                activeDot={{ r:5, fill:'var(--emerald)', strokeWidth:2, stroke:'var(--bg-card)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Smart stock alert card */}
        {alertCount > 0 ? (
          <div className="card ov-alert-card">
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className="ov-alert-dot"/>
                  Stock Alerts
                </div>
                <div className="card-subtitle">{alertCount} item{alertCount!==1?'s':''} need attention</div>
              </div>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => navigate('/inventory')}
              >
                View all
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
            <div className="ov-alert-list">
              {alertItems.map(p => {
                const shop = shops.find(s => s.id === p.shop_id);
                return (
                  <div key={p.id} className={`ov-alert-item ${p.status === 'oos' ? 'oos' : 'low'}`}>
                    <div className="ov-alert-item-left">
                      <div className={`ov-alert-badge ${p.status}`}>
                        {p.status === 'oos' ? '0' : p.quantity}
                      </div>
                      <div>
                        <div className="ov-alert-name">{p.name}</div>
                        <div className="ov-alert-shop">
                          {shop?.name || '—'} · {p.category}
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${p.status === 'oos' ? 'badge-danger' : 'badge-warn'}`}>
                      {p.status === 'oos' ? 'Out of stock' : 'Low stock'}
                    </span>
                  </div>
                );
              })}
            </div>
            {alertCount > 4 && (
              <button
                className="ov-alert-more"
                onClick={() => navigate('/inventory')}
              >
                +{alertCount - 4} more alerts — View in Inventory
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="card ov-alert-card ov-all-good">
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div className="ov-good-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:4 }}>
                All stock levels healthy
              </div>
              <div style={{ fontSize:12.5, color:'var(--text-tertiary)' }}>
                No products are running low right now
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BRANCH PERFORMANCE ── */}
      {shops.length > 0 && (
        <>
          <div className="section-label">Branch performance</div>
          <div className="ov-branches mb-md">
            {branchStats.map((branch, i) => (
              <BranchCard key={branch.id} branch={branch} rank={i+1}
                isActive={activeShopId === branch.id}
                showRank={activeShopId === 'all'}
                onClick={() => setActiveShopId(activeShopId === branch.id ? 'all' : branch.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── TOP PRODUCTS + BRANCH TABLE ── */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top selling products</span>
            <span className="badge badge-neutral" style={{ fontSize:11 }}>By revenue</span>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state" style={{ padding:'28px 0' }}>
              <div className="empty-state-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                </svg>
              </div>
              <p>No sales recorded yet</p>
            </div>
          ) : (
            <div className="ov-top-list">
              {topProducts.map(([name, rev], i) => {
                const pct = Math.round((rev / topProducts[0][1]) * 100);
                return (
                  <div key={name} className="ov-top-row">
                    <div className="ov-top-left">
                      <span className="ov-top-rank">{i + 1}</span>
                      <span className="ov-top-name truncate">{name}</span>
                    </div>
                    <div className="ov-top-right">
                      <div className="ov-top-bar-wrap">
                        <div className="ov-top-bar" style={{ width:`${pct}%` }}/>
                      </div>
                      <span className="ov-top-val">{fmtKES(rev)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Branch comparison</span></div>
          {shops.length === 0 ? (
            <div className="empty-state"><p>No branches configured</p></div>
          ) : (
            <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch</th><th>Revenue</th><th>Profit</th><th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {branchStats.map((b, i) => (
                  <tr key={b.id} style={{ cursor:'pointer' }}
                    onClick={() => setActiveShopId(activeShopId === b.id ? 'all' : b.id)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{
                          width:20, height:20, borderRadius:'50%',
                          background: i===0?'var(--emerald-subtle)':i===1?'var(--blue-light)':'var(--bg-secondary)',
                          color: i===0?'var(--emerald)':i===1?'var(--blue)':'var(--text-tertiary)',
                          fontSize:10.5, fontWeight:800,
                          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                        }}>
                          {i+1}
                        </span>
                        <span style={{ fontWeight:600, fontSize:13 }}>{b.name}</span>
                      </div>
                    </td>
                    <td><span style={{ fontFamily:'var(--font-mono)', fontSize:13 }}>{fmtKES(b.rev)}</span></td>
                    <td><span style={{ color:'var(--emerald)', fontWeight:700, fontFamily:'var(--font-mono)', fontSize:13 }}>{fmtKES(b.profit)}</span></td>
                    <td>
                      <span style={{ fontWeight:600 }}>{b.items}</span>
                      {/* {b.oos > 0 && <span className="badge badge-danger" style={{ marginLeft:6, fontSize:10.5 }}>{b.oos} OOS</span>}
                      {b.oos===0 && b.low>0 && <span className="badge badge-warn" style={{ marginLeft:, fontSize:10.5 }}>{b.low} low</span>} */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({ label, value, sub, subClass, color, icon }) {
  return (
    <div className={`metric-card ${color} fade-in`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className={`metric-sub ${subClass}`}>{sub}</div>}
    </div>
  );
}

/* ── Branch Card ── */
function BranchCard({ branch, rank, isActive, showRank, onClick }) {
  return (
    <div
      className={`ov-branch-card ${isActive ? 'active' : ''}`}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {showRank && <div className="ov-branch-rank">{rank}</div>}
      <div className="ov-branch-name">{branch.name}</div>
      <div className="ov-branch-loc">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        {branch.location}
      </div>
      <div className="divider" style={{ margin:'12px 0' }}/>
      <div className="ov-branch-stats">
        {[
          { label:'Revenue',  val:fmtKES(branch.rev),    color:undefined },
          { label:'Profit',   val:fmtKES(branch.profit), color:'var(--emerald)' },
          { label:'In stock', val:branch.items,           color:undefined },
          { label:'Alerts',   val:(branch.low+branch.oos)||'OK',
            color: branch.oos>0?'var(--red)':branch.low>0?'var(--amber)':'var(--emerald)' },
        ].map(s => (
          <div key={s.label} className="ov-branch-stat">
            <span className="ov-branch-stat-label">{s.label}</span>
            <span className="ov-branch-stat-val" style={{ color:s.color }}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Icons ── */
function RevenueIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>; }
function ProfitIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function StockIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>; }
function AlertIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }

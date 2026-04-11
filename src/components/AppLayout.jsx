// src/components/AppLayout.jsx  (ADMIN PROJECT — drop-in replacement)

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { useTheme } from '../context/ThemeContext';
import { getInitials } from '../lib/utils';
import '../styles/layout.css';

const NAV_ITEMS = [
  { id: 'overview',   label: 'Overview',        path: '/',          icon: DashIcon   },
  { id: 'inventory',  label: 'Inventory',       path: '/inventory', icon: BoxIcon    },
  { id: 'sales',      label: 'Sales',           path: '/sales',     icon: SalesIcon  },
  { id: 'transfer',   label: 'Stock Transfer',  path: '/transfer',  icon: SwapIcon   },
  { id: 'reports',    label: 'Reports',         path: '/reports',   icon: ChartIcon  },
];

const ADMIN_NAV = [
  { id: 'users', label: 'Users & Branches', path: '/users', icon: TeamIcon },
];

const PAGE_META = {
  '/':          { title: 'Network Overview',   sub: 'All branches at a glance' },
  '/inventory': { title: 'Inventory',          sub: 'Products & stock levels'  },
  '/sales':     { title: 'Sales',              sub: 'Transactions & revenue'   },
  '/transfer':  { title: 'Stock Transfer',     sub: 'Move stock between branches' },
  '/reports':   { title: 'Reports',            sub: 'Analytics & summaries'    },
  '/users':     { title: 'Users & Branches',   sub: 'Manage team access'       },
};

export default function AppLayout({ children }) {
  const { session, signOut }                     = useAuth();
  const { shops, activeShopId, setActiveShopId } = useShop();
  const { isDark, toggleTheme }                  = useTheme();
  const navigate    = useNavigate();
  const location    = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const meta    = PAGE_META[location.pathname] || { title: 'TechMart', sub: '' };
  const email   = session?.user?.email || '';
  const close   = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={close}/>

      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/><path d="M7 8h2M11 8h6M7 12h4M15 12h2"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-brand-name">TechMart Admin</div>
            <div className="sidebar-brand-sub">Network Control</div>
          </div>
        </div>

        {/* Branch filter */}
        <div className="shop-selector-block">
          <div className="shop-selector-label">Branch filter</div>
          <div className="shop-chip-wrap">
            <button
              className={`shop-chip ${activeShopId === 'all' ? 'active' : ''}`}
              onClick={() => setActiveShopId('all')}
            >
              <span className="shop-dot"/>
              All branches
            </button>
            {shops.map(s => (
              <button
                key={s.id}
                className={`shop-chip ${activeShopId === s.id ? 'active' : ''}`}
                onClick={() => setActiveShopId(s.id)}
              >
                <span className="shop-dot"/>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Dashboard</div>
          {NAV_ITEMS.map(Item => (
            <button
              key={Item.id}
              className={`nav-item ${location.pathname === Item.path ? 'active' : ''}`}
              onClick={() => { navigate(Item.path); close(); }}
            >
              <Item.icon />
              {Item.label}
            </button>
          ))}

          <div className="nav-section-label" style={{ marginTop: 12 }}>Admin</div>
          {ADMIN_NAV.map(Item => (
            <button
              key={Item.id}
              className={`nav-item ${location.pathname === Item.path ? 'active' : ''}`}
              onClick={() => { navigate(Item.path); close(); }}
            >
              <Item.icon />
              {Item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-row">
            <div className="user-avatar">{getInitials(email)}</div>
            <div>
              <div className="user-name">{email.split('@')[0]}</div>
              <div className="user-role">Administrator</div>
            </div>
          </div>

          {/* Dark mode toggle */}
          <div className="sidebar-theme-row">
            <span className="sidebar-theme-label">{isDark ? 'Dark mode' : 'Light mode'}</span>
            <ThemeSwitch isDark={isDark} onToggle={toggleTheme} />
          </div>

          <button className="signout-btn" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6"  x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <div className="topbar-title">{meta.title}</div>
              {meta.sub && <div className="topbar-sub">{meta.sub}</div>}
            </div>
          </div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <span className="badge badge-teal" style={{ fontSize: 11.5 }}>Admin</span>
          </div>
        </header>

        {/* Page content */}
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}

/* ── Toggle switch ── */
function ThemeSwitch({ isDark, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width: 40, height: 22, borderRadius: 11,
      border: 'none', cursor: 'pointer',
      background: isDark ? 'var(--emerald)' : 'rgba(148,163,184,.25)',
      position: 'relative', transition: 'background .2s', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 3,
        left: isDark ? 21 : 3,
        width: 16, height: 16,
        borderRadius: '50%', background: '#fff',
        transition: 'left .2s cubic-bezier(.4,0,.2,1)',
        boxShadow: '0 1px 4px rgba(0,0,0,.3)',
      }}/>
    </button>
  );
}

/* ── Icon components ── */
function DashIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function BoxIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function SalesIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>; }
function SwapIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>; }
function ChartIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function TeamIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>; }
function SunIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function MoonIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>; }

// src/components/AppShell.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getInitials } from '../lib/utils';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/>
      </svg>
    ),
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
  },
];

const PAGE_META = {
  dashboard: { title: 'Dashboard',  sub: "Today's overview" },
  inventory: { title: 'Inventory',  sub: 'Products & stock levels' },
  sales:     { title: 'Sales',      sub: 'Record & view transactions' },
  reports:   { title: 'Reports',    sub: 'Analytics & summaries' },
};

export default function AppShell({ activePage, onNavigate, children }) {
  const { session, profile, signOut } = useAuth();
  const { isDark, toggleTheme }       = useTheme();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const email    = session?.user?.email || '';
  const meta     = PAGE_META[activePage] || { title: 'Ezekii Electronics', sub: '' };

  return (
    <div className="app-shell">

      {/* ===== SIDEBAR (desktop) ===== */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-icon">
            <svg viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
              <path d="M7 8h2M11 8h6M7 12h4M15 12h2"/>
            </svg>
          </div>
          <div>
            <div className="sidebar-shop-name">Ezekii Electronics</div>
            <div className="sidebar-shop-sub">Isinet Branch</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-row">
            <div className="sidebar-avatar">{getInitials(email)}</div>
            <div>
              <div className="sidebar-user-name">
                {profile?.full_name || email.split('@')[0]}
              </div>
              <div className="sidebar-user-email">
                {profile?.role === 'admin' ? 'Administrator' : 'Branch Manager'}
              </div>
            </div>
          </div>

          <div className="sidebar-theme-row">
            <span className="sidebar-theme-label">
              {isDark ? 'Dark mode' : 'Light mode'}
            </span>
            <ThemeToggleSwitch isDark={isDark} onToggle={toggleTheme} />
          </div>

          <button className="sidebar-signout" onClick={() => setConfirmSignOut(true)}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ===== MAIN AREA ===== */}
      <div className="main-area">

        {/* Mobile topbar */}
        <header className="topbar">
          <div className="topbar-brand">
            <div className="topbar-brand-icon">
              <svg viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
                <path d="M7 8h2M11 8h6M7 12h4M15 12h2"/>
              </svg>
            </div>
            <div>
              <div className="topbar-shop-name">Ezekii Electronics</div>
              <div className="topbar-shop-sub">Isinet</div>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              className="user-avatar-btn"
              onClick={() => setConfirmSignOut(true)}
              title="Sign out"
            >
              {getInitials(email)}
            </button>
          </div>
        </header>

        {/* Desktop topbar (inside main area) */}
        <header className="desktop-topbar">
          <div>
            <div className="dt-title">{meta.title}</div>
            <div className="dt-sub">{meta.sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-brand" style={{ fontSize: 11.5 }}>
              {profile?.full_name || email.split('@')[0]}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="page-body">
          {children}
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="bottom-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-tab ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ===== SIGN OUT CONFIRM ===== */}
      {confirmSignOut && (
        <div className="overlay-bg" onClick={() => setConfirmSignOut(false)}>
          <div className="overlay-card" onClick={e => e.stopPropagation()}>
            <div className="overlay-title">Sign out?</div>
            <div className="overlay-body">
              You will be returned to the login screen.
            </div>
            <div className="overlay-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmSignOut(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Icon helpers ---- */
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1"  y1="12" x2="3"  y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  );
}

/* ---- Toggle switch for sidebar ---- */
function ThemeToggleSwitch({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 40, height: 22,
        borderRadius: 11,
        border: 'none',
        background: isDark ? 'var(--brand)' : 'var(--border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background .2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3, left: isDark ? 21 : 3,
        width: 16, height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      }} />
    </button>
  );
}

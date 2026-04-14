// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }     from './context/AuthContext';
import { ShopProvider }              from './context/ShopContext';
import { ToastProvider }             from './context/ToastContext';
import { ThemeProvider }             from './context/ThemeContext';
import { ErrorBoundary, NetworkGuard } from './components/ErrorBoundary';
import PWAInstallPrompt              from './components/PWAInstallPrompt';
import AdminLayout                   from './components/AdminLayout';
import LoginPage                     from './pages/LoginPage';
import RoleSelectPage                from './pages/RoleSelectPage';
import OverviewPage                  from './pages/OverviewPage';
import InventoryPage                 from './pages/InventoryPage';
import SalesPage                     from './pages/SalesPage';
import TransferPage                  from './pages/TransferPage';
import ReportsPage                   from './pages/ReportsPage';
import UserManagementPage            from './pages/UserManagementPage';
import AuditLogsPage                 from './pages/AuditLogsPage';
import BranchApp                     from './branch/BranchApp';

import './styles/globals.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/error.css';
import './styles/role-select.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner"/>
      <p>Loading TechMart…</p>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, profileError, loading, signOut } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (profileError) return (
    <div className="error-screen">
      <div className="error-card">
        <div className="error-icon-wrap error-icon-crash">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="error-title">Could not load account</h2>
        <p className="error-desc">
          Your profile could not be loaded. Make sure a user_profiles row exists for your account, then refresh.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button className="error-btn" onClick={() => window.location.reload()}>Refresh</button>
          <button className="error-btn" style={{ background:'transparent', color:'var(--emerald)',
            border:'1px solid var(--emerald)' }} onClick={signOut}>Sign out</button>
        </div>
      </div>
    </div>
  );
  if (!profile) return <LoadingScreen />;
  if (profile.is_active === false) return (
    <div className="error-screen">
      <div className="error-card">
        <h2 className="error-title">Account deactivated</h2>
        <p className="error-desc">Contact the administrator.</p>
        <button className="error-btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={profile?.role === 'manager' ? '/branch' : '/admin'} replace />;
  }
  return children;
}

function AdminRoutes() {
  return (
    <ShopProvider>
      <ToastProvider>
        <AdminLayout>
          <Routes>
            <Route path="/"          element={<OverviewPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/sales"     element={<SalesPage />} />
            <Route path="/transfer"  element={<TransferPage />} />
            <Route path="/reports"   element={<ReportsPage />} />
            <Route path="/users"     element={<UserManagementPage />} />
            <Route path="/audit"     element={<AuditLogsPage />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </AdminLayout>
      </ToastProvider>
    </ShopProvider>
  );
}

function AuthGate({ children }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session && profile) {
    return <Navigate to={profile.role === 'manager' ? '/branch' : '/admin'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <NetworkGuard>
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<RoleSelectPage />} />
                <Route path="/login" element={<AuthGate><LoginPage /></AuthGate>} />
                <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AdminRoutes /></ProtectedRoute>} />
                <Route path="/branch/*" element={<ProtectedRoute allowedRoles={['manager']}><BranchApp /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>

              {/* PWA install prompt — shown once after 3s, dismissed state persists */}
              <PWAInstallPrompt />
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </NetworkGuard>
    </ErrorBoundary>
  );
}
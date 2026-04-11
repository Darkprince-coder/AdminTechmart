// src/App.jsx  (ADMIN PROJECT — drop-in replacement, adds ThemeProvider)

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }     from './context/AuthContext';
import { ShopProvider }              from './context/ShopContext';
import { ToastProvider }             from './context/ToastContext';
import { ThemeProvider }             from './context/ThemeContext';
import { ErrorBoundary, NetworkGuard } from './components/ErrorBoundary';
import AppLayout         from './components/AppLayout';
import LoginPage         from './pages/LoginPage';
import OverviewPage      from './pages/OverviewPage';
import InventoryPage     from './pages/InventoryPage';
import SalesPage         from './pages/SalesPage';
import TransferPage      from './pages/TransferPage';
import ReportsPage       from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';

import './styles/globals.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/error.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="spinner"/>
      <p>Loading TechMart…</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { session, profile, profileError, isAdmin, loading, signOut } = useAuth();
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
  if (profile.role === 'manager') return (
    <div className="error-screen">
      <div className="error-card">
        <h2 className="error-title">Wrong portal</h2>
        <p className="error-desc">This is the admin panel. Branch managers should use the Ezekii branch app.</p>
        <button className="error-btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
  return children;
}

function AdminRoutes() {
  return (
    <ShopProvider>
      <ToastProvider>
        <AppLayout>
          <Routes>
            <Route path="/"          element={<OverviewPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/sales"     element={<SalesPage />} />
            <Route path="/transfer"  element={<TransferPage />} />
            <Route path="/reports"   element={<ReportsPage />} />
            <Route path="/users"     element={<UserManagementPage />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </ToastProvider>
    </ShopProvider>
  );
}

function AuthGate({ children }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (session && profile?.role === 'admin') return <Navigate to="/" replace />;
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
                <Route path="/login" element={<AuthGate><LoginPage /></AuthGate>} />
                <Route path="/*" element={<ProtectedRoute><AdminRoutes /></ProtectedRoute>} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </NetworkGuard>
    </ErrorBoundary>
  );
}

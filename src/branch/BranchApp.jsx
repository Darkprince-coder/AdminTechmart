import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import AppShell from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';
import './styles/globals.css';
import './styles/layout.css';

export default function BranchApp() {
  const [activePage, setActivePage] = useState('dashboard');
  const { theme } = useTheme();

  return (
    <ToastProvider>
      <div className="branch-theme" data-theme={theme}>
        <AppShell activePage={activePage} onNavigate={setActivePage}>
          {activePage === 'dashboard' && <DashboardPage />}
          {activePage === 'inventory' && <InventoryPage />}
          {activePage === 'sales' && <SalesPage />}
          {activePage === 'reports' && <ReportsPage />}
        </AppShell>
      </div>
    </ToastProvider>
  );
}

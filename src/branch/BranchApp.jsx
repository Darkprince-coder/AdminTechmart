import { useState } from 'react';
import { ToastProvider } from '../context/ToastContext';
import AppShell from './components/AppShell';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ReportsPage from './pages/ReportsPage';

export default function BranchApp() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <ToastProvider>
      <AppShell activePage={activePage} onNavigate={setActivePage}>
        {activePage === 'dashboard' && <DashboardPage />}
        {activePage === 'inventory' && <InventoryPage />}
        {activePage === 'sales' && <SalesPage />}
        {activePage === 'reports' && <ReportsPage />}
      </AppShell>
    </ToastProvider>
  );
}

// src/context/ShopContext.jsx  (ADMIN PROJECT — drop-in replacement)
// Fix: was fetching shops even with no session (before auth settled),
// causing RLS-denied requests to flood the console.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const { session, isAdmin } = useAuth();
  const [shops,        setShops]        = useState([]);
  const [activeShopId, setActiveShopId] = useState('all');
  const [loading,      setLoading]      = useState(false);

  const fetchShops = useCallback(async () => {
    // Only fetch when we have a confirmed session
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('is_active', true)
      .order('created_at');

    if (!error && data) {
      setShops(data);
    }
    // Silently ignore RLS errors here — ProtectedRoute handles auth errors
    setLoading(false);
  }, [session]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const activeShop = activeShopId === 'all'
    ? null
    : shops.find(s => s.id === activeShopId) || null;

  return (
    <ShopContext.Provider value={{
      shops,
      activeShopId,
      setActiveShopId,
      activeShop,
      loading,
      refetchShops: fetchShops,
    }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}

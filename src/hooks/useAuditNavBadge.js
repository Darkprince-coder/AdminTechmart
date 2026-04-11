import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getAuditUnseenThreshold } from '../lib/auditNavBadge';

const POLL_MS = 45_000;
const PULSE_MS = 880;

/**
 * @param {{ isOnAuditRoute: boolean }} opts
 */
export function useAuditNavBadge({ isOnAuditRoute }) {
  const [unseenCount, setUnseenCount] = useState(0);
  const [badgePulse, setBadgePulse] = useState(false);
  const prevCountRef = useRef(null);

  const refresh = useCallback(async () => {
    if (isOnAuditRoute) {
      setUnseenCount(0);
      return;
    }
    const threshold = getAuditUnseenThreshold();
    const { count, error } = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', threshold);

    if (error) {
      console.warn('[audit badge] count failed', error.message);
      return;
    }
    setUnseenCount(typeof count === 'number' ? count : 0);
  }, [isOnAuditRoute]);

  useEffect(() => {
    refresh();
  }, [refresh, isOnAuditRoute]);

  useEffect(() => {
    if (isOnAuditRoute) {
      prevCountRef.current = unseenCount;
      return;
    }
    if (prevCountRef.current !== null && unseenCount > prevCountRef.current) {
      setBadgePulse(true);
      const t = window.setTimeout(() => setBadgePulse(false), PULSE_MS);
      prevCountRef.current = unseenCount;
      return () => window.clearTimeout(t);
    }
    prevCountRef.current = unseenCount;
  }, [unseenCount, isOnAuditRoute]);

  useEffect(() => {
    const onFocus = () => refresh();
    const onViewed = () => {
      setUnseenCount(0);
      setBadgePulse(false);
      prevCountRef.current = 0;
      refresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('techmart-audit-viewed', onViewed);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('techmart-audit-viewed', onViewed);
      clearInterval(id);
    };
  }, [refresh]);

  return { unseenCount, badgePulse, refreshUnseenAuditCount: refresh };
}

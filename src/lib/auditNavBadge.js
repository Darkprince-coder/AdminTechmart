/**
 * Tracks when the admin last viewed the audit log so the sidebar can show unseen counts.
 * If they have never opened Audit log, we use a per-tab session "floor" so old history
 * does not flood the badge — only activity since that floor counts until first visit.
 */

export const AUDIT_LAST_VIEWED_KEY = 'techmart_audit_last_viewed_at';
const AUDIT_SESSION_FLOOR_KEY = 'techmart_audit_session_floor';

export function getAuditUnseenThreshold() {
  const last = localStorage.getItem(AUDIT_LAST_VIEWED_KEY);
  if (last) return last;
  let floor = sessionStorage.getItem(AUDIT_SESSION_FLOOR_KEY);
  if (!floor) {
    floor = new Date().toISOString();
    sessionStorage.setItem(AUDIT_SESSION_FLOOR_KEY, floor);
  }
  return floor;
}

/** Call when the admin opens the Audit log page. */
export function markAuditLogViewed() {
  const now = new Date().toISOString();
  localStorage.setItem(AUDIT_LAST_VIEWED_KEY, now);
  window.dispatchEvent(new CustomEvent('techmart-audit-viewed', { detail: { at: now } }));
}

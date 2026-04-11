// src/lib/utils.js  (ADMIN PROJECT — drop-in replacement)

/** Format as Kenya Shillings */
export function fmtKES(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'KSh 0';
  return 'KSh ' + Number(amount).toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Stock status from quantity and alert threshold */
export function stockStatus(qty, alertQty = 5) {
  if (qty === 0)       return { status: 'danger', label: 'Out of stock' };
  if (qty <= alertQty) return { status: 'warn',   label: 'Low stock'   };
  return                      { status: 'ok',     label: 'In stock'    };
}

/**
 * Stock fill % for progress bar.
 * Named stockPct — also exported as stockPercent for backward compatibility
 * with any file that still imports the old name.
 */
export function stockPct(qty, alertQty = 5) {
  const max = Math.max(qty, alertQty * 3, 10);
  return Math.min(100, Math.round((qty / max) * 100));
}
// Backward-compatible alias
export const stockPercent = stockPct;

/** Profit margin % */
export function margin(buyPrice, sellPrice) {
  if (!sellPrice || sellPrice <= 0) return 0;
  return Math.round(((sellPrice - buyPrice) / sellPrice) * 100);
}

/** ISO date → readable string */
export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** ISO date → time only */
export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-KE', {
    hour: '2-digit', minute: '2-digit',
  });
}

/** ISO date → short date */
export function fmtDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/** User initials from email or name */
export function getInitials(str) {
  if (!str) return 'A';
  return str.charAt(0).toUpperCase();
}

/** Check if an ISO date string is today */
export function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.getDate()     === t.getDate()  &&
         d.getMonth()    === t.getMonth() &&
         d.getFullYear() === t.getFullYear();
}

/** Debounce */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

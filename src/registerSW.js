/**
 * TechMart Network — Service Worker & PWA install management
 *
 * WHY module-level capture:
 *   Chrome fires `beforeinstallprompt` during early page load on mobile —
 *   before React mounts any component or runs any useEffect. By listening
 *   here (module scope, imported at the very top of index.js) we guarantee
 *   we never miss the event.
 *
 * WHY we clear tm_pwa_dismissed in the beforeinstallprompt handler:
 *   The browser only fires this event when the app is NOT currently installed.
 *   So receiving it is proof that a previous install has been removed (or never
 *   happened). Clearing the flag here lets the install prompt show again
 *   automatically — no manual cache-clearing needed by the user.
 */

// ─── Module-level install-event store ────────────────────────────────────────
let _deferredEvent = null;
let _listeners     = [];

function _emit() {
  _listeners.forEach(fn => fn(_deferredEvent));
}

// Runs synchronously on import — before any React rendering.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); // suppress the browser's own mini-infobar

  // KEY FIX: the browser only fires this when the app is installable (not yet
  // installed). If it fires, any stale "dismissed" flag must be cleared so the
  // prompt shows again — this is exactly what re-enables it after uninstall.
  localStorage.removeItem('tm_pwa_dismissed');

  _deferredEvent = e;
  _emit();
});

window.addEventListener('appinstalled', () => {
  // App just installed — mark dismissed so prompt won't nag while installed.
  // When user uninstalls, browser fires beforeinstallprompt again and we
  // clear this flag in that handler above.
  localStorage.setItem('tm_pwa_dismissed', '1');
  _deferredEvent = null;
  _emit();
});

/** Read the captured deferred prompt event (null if not yet fired). */
export function getInstallEvent() { return _deferredEvent; }

/** Discard the event after prompting so it can't be replayed. */
export function clearInstallEvent() { _deferredEvent = null; }

/**
 * Subscribe to install-event changes.
 * The callback is fired immediately with the current value so late subscribers
 * (React components) never miss an already-captured event.
 * Returns an unsubscribe function.
 */
export function onInstallEvent(fn) {
  _listeners.push(fn);
  fn(_deferredEvent); // fire right away with current value
  return () => { _listeners = _listeners.filter(f => f !== fn); };
}

// ─── Service worker registration ──────────────────────────────────────────────
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // No production guard: mobile Chrome requires an *active* service worker
  // before it fires beforeinstallprompt. The SW is safe in dev — it only
  // intercepts same-origin GETs and passes everything else through.

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        reg.update(); // check for a newer SW on every page load

        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              _showUpdateToast(() => {
                next.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              });
            }
          });
        });
      })
      .catch(err => console.warn('[TechMart SW]', err.message));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  });
}

// ─── iOS / iPadOS "Add to Home Screen" manual hint ───────────────────────────
// iOS Safari does not support beforeinstallprompt so we show a manual guide.
export function showIOSInstallHint() {
  const ua         = navigator.userAgent;
  const isIOS      = /iphone|ipod/i.test(ua) ||
                     /ipad/i.test(ua) ||
                     (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1); // iPadOS 13+
  const isSafari   = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const standalone = window.navigator.standalone === true ||
                     window.matchMedia('(display-mode: standalone)').matches;
  const dismissed  = localStorage.getItem('tm_ios_hint_dismissed') === '1';

  if (!isIOS || !isSafari || standalone || dismissed) return;

  const style = document.createElement('style');
  style.textContent = `@keyframes _tm_up{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(style);

  setTimeout(() => {
    if (document.getElementById('_tm_ios')) return;
    const el = document.createElement('div');
    el.id = '_tm_ios';
    Object.assign(el.style, {
      position:'fixed', bottom:'0', left:'0', right:'0', zIndex:'99999',
      background:'#111827', borderTop:'1px solid #1E293B',
      padding:`16px 20px calc(20px + env(safe-area-inset-bottom, 0px))`,
      fontFamily:'system-ui,-apple-system,sans-serif', color:'#F1F5F9',
      display:'flex', flexDirection:'column', gap:'12px',
      boxShadow:'0 -8px 32px rgba(0,0,0,.6)',
      animation:'_tm_up .3s ease forwards',
    });
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="/icons/apple-touch-icon.png" width="40" height="40"
          style="border-radius:9px;flex-shrink:0;" alt="">
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">Install TechMart</div>
          <div style="color:#94A3B8;font-size:12px;margin-top:2px;">Add to Home Screen for quick access</div>
        </div>
        <button id="_tm_ios_x" style="background:none;border:none;color:#64748B;font-size:24px;cursor:pointer;padding:0;">&times;</button>
      </div>
      <div style="background:#1E293B;border-radius:10px;padding:11px 14px;color:#94A3B8;font-size:12.5px;line-height:1.6;">
        Tap <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"
          style="vertical-align:middle;margin:0 3px;">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg> then <strong style="color:#F1F5F9;">"Add to Home Screen"</strong>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('_tm_ios_x').onclick = () => {
      el.remove();
      localStorage.setItem('tm_ios_hint_dismissed', '1');
    };
  }, 4000);
}

// ─── Update-available toast ───────────────────────────────────────────────────
function _showUpdateToast(onUpdate) {
  if (document.getElementById('_tm_toast')) return;
  const style = document.createElement('style');
  style.textContent = `@keyframes _tm_toast{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = '_tm_toast';
  Object.assign(el.style, {
    position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
    zIndex:'99999', display:'flex', alignItems:'center', gap:'12px',
    background:'#111827', border:'1px solid #1E293B', borderRadius:'12px',
    padding:'13px 18px', boxShadow:'0 12px 40px rgba(0,0,0,.65)',
    fontFamily:'system-ui,sans-serif', fontSize:'13.5px', color:'#F1F5F9',
    maxWidth:'calc(100vw - 32px)', animation:'_tm_toast .28s ease forwards',
  });
  el.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="flex-shrink:0">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
    <span style="flex:1;white-space:normal;">A new version of TechMart is ready.</span>
    <button id="_tm_toast_ok" style="background:#059669;color:#fff;border:none;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;flex-shrink:0;">Update now</button>
    <button id="_tm_toast_x"  style="background:none;color:#64748B;border:none;font-size:20px;cursor:pointer;padding:0 4px;flex-shrink:0;">&times;</button>`;
  document.body.appendChild(el);
  document.getElementById('_tm_toast_ok').onclick = () => { el.remove(); onUpdate(); };
  document.getElementById('_tm_toast_x').onclick  = () => el.remove();
}
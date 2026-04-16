/**
 * TechMart Network — Service Worker & PWA registration
 *
 * KEY DESIGN DECISION: The `beforeinstallprompt` event is captured at MODULE
 * LEVEL, not inside a React useEffect. On mobile Chrome, this event fires
 * during early page load — before React has a chance to mount components and
 * run useEffect hooks. Capturing it here (which runs synchronously as soon as
 * the module is imported at the top of index.js) ensures we never miss it.
 *
 * The stored event is then consumed by PWAInstallPrompt.jsx via the exported
 * getStoredInstallEvent() / clearStoredInstallEvent() helpers.
 */

// ── Capture beforeinstallprompt immediately (module-level) ────────────────────
// This runs synchronously when the module is first imported — well before
// any React component mounts — so we never miss the event on fast mobile loads.
let _installEvent = null;
let _installListeners = [];

function _notifyListeners() {
  _installListeners.forEach(fn => fn(_installEvent));
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();               // suppress browser's own mini-infobar
  _installEvent = e;
  _notifyListeners();
});

window.addEventListener('appinstalled', () => {
  _installEvent = null;
  localStorage.setItem('tm_pwa_dismissed', '1');
  _notifyListeners();
});

/** Returns the stored deferred install event (or null if not yet fired / already used). */
export function getStoredInstallEvent() {
  return _installEvent;
}

/** Call after prompting so the event isn't replayed. */
export function clearStoredInstallEvent() {
  _installEvent = null;
}

/**
 * Subscribe to changes in the install event.
 * Returns an unsubscribe function.
 */
export function onInstallEventChange(fn) {
  _installListeners.push(fn);
  // Immediately call with current value so late subscribers don't miss it
  fn(_installEvent);
  return () => {
    _installListeners = _installListeners.filter(f => f !== fn);
  };
}

// ── Service worker registration ────────────────────────────────────────────────
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // FIX: removed the `process.env.NODE_ENV !== 'production'` guard.
  // That guard was the primary reason mobile Chrome never fired
  // `beforeinstallprompt` — Chrome requires an *active* service worker
  // before it considers a site installable. Desktop Chrome is more lenient
  // with engagement heuristics; mobile Chrome is not.
  //
  // The SW is safe to register in all environments: it only intercepts
  // same-origin GET requests and gracefully falls through for everything else.

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(registration => {
        // Poll for updates on every page load
        registration.update();

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(() => {
                worker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              });
            }
          });
        });
      })
      .catch(err => {
        // SW registration can legitimately fail in certain browser privacy
        // modes — log silently and continue; the app still works without it.
        console.warn('[TechMart SW] Registration failed:', err.message);
      });

    // When a new SW takes control, reload to pick up fresh assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  });
}

// ── iOS / iPadOS "Add to Home Screen" hint ────────────────────────────────────
export function showIOSInstallHint() {
  // FIX: iPadOS 13+ reports as "Macintosh" not "iPad", so the old check missed
  // all modern iPads. We now use the additional `maxTouchPoints` heuristic.
  const ua           = navigator.userAgent;
  const isIPhoneIPod = /iphone|ipod/i.test(ua);
  const isIPad       = /ipad/i.test(ua) ||
                       (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isIOS        = isIPhoneIPod || isIPad;
  const isSafari     = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isStandalone = window.navigator.standalone === true ||
                       window.matchMedia('(display-mode: standalone)').matches;
  const dismissed    = localStorage.getItem('tm_ios_hint_dismissed') === '1';

  if (!isIOS || !isSafari || isStandalone || dismissed) return;

  // Inject keyframe style once
  if (!document.getElementById('__tm_sw_style')) {
    const s = document.createElement('style');
    s.id = '__tm_sw_style';
    s.textContent = `
      @keyframes tm_slide_up {
        from { opacity:0; transform:translateY(100%); }
        to   { opacity:1; transform:translateY(0); }
      }
    `;
    document.head.appendChild(s);
  }

  setTimeout(() => {
    if (document.getElementById('__tm_ios_hint')) return;

    const hint = document.createElement('div');
    hint.id = '__tm_ios_hint';
    hint.setAttribute('role', 'dialog');
    hint.setAttribute('aria-label', 'Install TechMart app');
    Object.assign(hint.style, {
      position:      'fixed',
      bottom:        '0',
      left:          '0',
      right:         '0',
      zIndex:        '99998',
      background:    '#111827',
      color:         '#F1F5F9',
      borderTop:     '1px solid #1E293B',
      padding:       '16px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
      fontFamily:    'system-ui, -apple-system, sans-serif',
      fontSize:      '13.5px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '12px',
      boxShadow:     '0 -8px 32px rgba(0,0,0,.6)',
      animation:     'tm_slide_up .3s ease forwards',
    });

    hint.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="/icons/apple-touch-icon.png" width="40" height="40"
          style="border-radius:9px;flex-shrink:0;" alt="" />
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;color:#F1F5F9;">
            Install TechMart
          </div>
          <div style="color:#94A3B8;font-size:12px;margin-top:2px;">
            Add to Home Screen for instant access
          </div>
        </div>
        <button id="__tm_ios_close" aria-label="Close"
          style="background:transparent;border:none;color:#64748B;font-size:24px;
                 cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0;">
          &times;
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;
                  background:#1E293B;border-radius:10px;padding:11px 14px;">
        <div style="flex:1;color:#94A3B8;font-size:12.5px;line-height:1.5;">
          Tap
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#10B981" stroke-width="2" style="vertical-align:middle;margin:0 3px;">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          then tap
          <strong style="color:#F1F5F9;">&nbsp;"Add to Home Screen"</strong>
        </div>
      </div>
    `;

    document.body.appendChild(hint);
    document.getElementById('__tm_ios_close').addEventListener('click', () => {
      hint.remove();
      localStorage.setItem('tm_ios_hint_dismissed', '1');
    });
  }, 4500);
}

// ── Update toast (no external dependencies) ───────────────────────────────────
function showUpdateToast(onAccept) {
  if (document.getElementById('__tm_update_toast')) return;

  if (!document.getElementById('__tm_sw_style')) {
    const s = document.createElement('style');
    s.id = '__tm_sw_style';
    s.textContent = `
      @keyframes tm_slide_up {
        from { opacity:0; transform:translateX(-50%) translateY(20px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(s);
  }

  const toast = document.createElement('div');
  toast.id = '__tm_update_toast';
  toast.setAttribute('role', 'alert');
  Object.assign(toast.style, {
    position:    'fixed',
    bottom:      '24px',
    left:        '50%',
    transform:   'translateX(-50%)',
    zIndex:      '99999',
    display:     'flex',
    alignItems:  'center',
    gap:         '12px',
    background:  '#111827',
    color:       '#F1F5F9',
    border:      '1px solid #1E293B',
    borderRadius:'12px',
    padding:     '13px 18px',
    boxShadow:   '0 12px 40px rgba(0,0,0,.65)',
    fontFamily:  'system-ui, -apple-system, sans-serif',
    fontSize:    '13.5px',
    fontWeight:  '500',
    whiteSpace:  'nowrap',
    animation:   'tm_slide_up .28s cubic-bezier(0.34,1.56,0.64,1) forwards',
    maxWidth:    'calc(100vw - 32px)',
  });

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#10B981" stroke-width="2" style="flex-shrink:0;">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
    <span style="flex:1;white-space:normal;">A new version of TechMart is ready.</span>
    <button id="__tm_update_btn"
      style="background:#059669;color:#fff;border:none;padding:7px 14px;
             border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;
             font-family:inherit;flex-shrink:0;">
      Update now
    </button>
    <button id="__tm_dismiss_btn" aria-label="Dismiss"
      style="background:transparent;color:#64748B;border:none;
             font-size:20px;cursor:pointer;padding:0 4px;line-height:1;flex-shrink:0;">
      &times;
    </button>
  `;

  document.body.appendChild(toast);
  document.getElementById('__tm_update_btn').addEventListener('click', () => { toast.remove(); onAccept(); });
  document.getElementById('__tm_dismiss_btn').addEventListener('click', () => toast.remove());
}
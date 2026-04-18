/**
 * TechMart Network — registerSW.js
 *
 * This is the BROWSER-SIDE module (runs in the page, not in the SW).
 * It must NOT contain any `self.addEventListener` calls.
 *
 * Exports:
 *   registerSW()        — registers /sw.js as the service worker
 *   onInstallEvent(cb)  — subscribes to the beforeinstallprompt event
 *   clearInstallEvent() — clears the stored install event (after accept/dismiss)
 *   showIOSInstallHint()— shows a one-time hint for iOS/Safari users
 */

// ── Internal state ────────────────────────────────────────────────────────────

let _deferredPrompt = null;           // the BeforeInstallPromptEvent
const _subscribers  = new Set();      // components listening for the event

// ── beforeinstallprompt — capture as early as possible ───────────────────────
//
// This listener is attached at module-evaluation time (before React even loads)
// because ES module imports are hoisted and run in declaration order.
// index.js imports this module FIRST to guarantee we never miss the event.

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();   // stop the browser's default mini-infobar

  // Don't show if the user already dismissed this session
  if (localStorage.getItem('tm_pwa_dismissed') === '1') return;

  _deferredPrompt = e;
  _subscribers.forEach(cb => cb(e));
});

// Clear the dismissed flag if the prompt fires again (e.g. after uninstall)
window.addEventListener('beforeinstallprompt', () => {
  // If we reach here it means the app is installable again — clear old flag
  localStorage.removeItem('tm_pwa_dismissed');
}, { once: false });   // we handle the flag reset in the first listener above

// Track successful install
window.addEventListener('appinstalled', () => {
  _deferredPrompt = null;
  localStorage.setItem('tm_pwa_dismissed', '1');
  _subscribers.forEach(cb => cb(null));
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register /sw.js as the service worker.
 * Safe to call multiple times — skips if SW is already registered.
 */
export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  const doRegister = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // If there's a waiting SW (new version deployed), activate it immediately
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW waiting — tell it to skip waiting
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    } catch (err) {
      console.error('[TechMart SW] Registration failed:', err);
    }
  };

  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister, { once: true });
  }
}

/**
 * Subscribe to BeforeInstallPromptEvent updates.
 * The callback receives the event object, or null when it has been cleared.
 * Returns an unsubscribe function.
 *
 * @param {(event: BeforeInstallPromptEvent | null) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onInstallEvent(cb) {
  _subscribers.add(cb);

  // Fire immediately if we already have a captured event
  if (_deferredPrompt) cb(_deferredPrompt);

  return () => _subscribers.delete(cb);
}

/**
 * Clear the stored install event and notify subscribers.
 * Call this after the user accepts or permanently dismisses the prompt.
 */
export function clearInstallEvent() {
  _deferredPrompt = null;
  _subscribers.forEach(cb => cb(null));
}

/**
 * Show a one-time "Add to Home Screen" guide for iOS/Safari.
 * Safari does not support beforeinstallprompt, so we show a manual hint.
 *
 * Conditions for showing:
 *   - iOS device (iPhone/iPad)
 *   - Running in Safari (not already installed as a PWA)
 *   - Not already shown this session
 */
export function showIOSInstallHint() {
  const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari     = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const alreadySeen  = sessionStorage.getItem('tm_ios_hint_shown') === '1';

  if (!isIOS || !isSafari || isStandalone || alreadySeen) return;

  sessionStorage.setItem('tm_ios_hint_shown', '1');

  // Create a simple non-blocking banner
  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.style.cssText = `
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 9999;
    background: #111827;
    color: #F1F5F9;
    border-top: 1px solid #1E293B;
    border-radius: 20px 20px 0 0;
    padding: 18px 20px calc(18px + env(safe-area-inset-bottom, 0px));
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 -12px 40px rgba(0,0,0,.5);
    animation: _tm_ios_up .3s cubic-bezier(0.34,1.3,0.64,1) forwards;
  `;

  banner.innerHTML = `
    <style>
      @keyframes _tm_ios_up {
        from { opacity:0; transform:translateY(100%); }
        to   { opacity:1; transform:translateY(0);    }
      }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <strong style="font-size:15px;">Install TechMart</strong>
      <button id="_tm_ios_close" aria-label="Dismiss"
        style="background:none;border:none;color:#64748B;font-size:22px;line-height:1;
               cursor:pointer;padding:0 4px;">×</button>
    </div>
    <p style="margin:0;color:#94A3B8;">
      Tap the <strong style="color:#F1F5F9;">Share</strong> button
      <span style="font-size:16px;">⎙</span> below, then choose
      <strong style="color:#059669;">"Add to Home Screen"</strong>
      to install this app.
    </p>
  `;

  document.body.appendChild(banner);

  const close = () => {
    if (banner.parentNode) banner.parentNode.removeChild(banner);
  };

  banner.querySelector('#_tm_ios_close').addEventListener('click', close);

  // Auto-dismiss after 12 seconds
  setTimeout(close, 12000);
}
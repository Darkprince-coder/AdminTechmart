// src/registerSW.js
// Registers the service worker and shows a non-intrusive update prompt
// when a new version of the app is available.

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV !== 'production') return; // only in prod

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(registration => {
        // Check for updates on each page load
        registration.update();

        // New service worker waiting to activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New version ready — show update toast
              showUpdateToast(() => {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              });
            }
          });
        });
      })
      .catch(err => {
        console.warn('[SW] Registration failed:', err);
      });

    // When a new SW takes control, reload to get fresh assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

// ── Minimal update toast (no external dependencies) ──────────────────────────
function showUpdateToast(onAccept) {
  // Avoid duplicates
  if (document.getElementById('__tm_update_toast')) return;

  const toast = document.createElement('div');
  toast.id = '__tm_update_toast';
  toast.setAttribute('role', 'alert');
  toast.style.cssText = [
    'position:fixed', 'bottom:24px', 'left:50%',
    'transform:translateX(-50%)',
    'z-index:99999',
    'display:flex', 'align-items:center', 'gap:14px',
    'background:#111827',
    'color:#F1F5F9',
    'border:1px solid #1E293B',
    'border-radius:12px',
    'padding:13px 18px',
    'box-shadow:0 12px 32px rgba(0,0,0,.6)',
    'font-family:system-ui,sans-serif',
    'font-size:13.5px',
    'font-weight:500',
    'white-space:nowrap',
    'animation:tm_slide_up .28s cubic-bezier(.34,1.56,.64,1) forwards',
  ].join(';');

  // Inject keyframe once
  if (!document.getElementById('__tm_sw_style')) {
    const style = document.createElement('style');
    style.id = '__tm_sw_style';
    style.textContent = `
      @keyframes tm_slide_up {
        from { opacity:0; transform:translateX(-50%) translateY(20px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#10B981" stroke-width="2" style="flex-shrink:0">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
    <span>A new version of TechMart is ready.</span>
    <button id="__tm_update_btn"
      style="
        background:#059669;color:#fff;border:none;
        padding:7px 14px;border-radius:8px;
        font-size:12.5px;font-weight:700;cursor:pointer;
        font-family:inherit;flex-shrink:0;
      ">
      Update now
    </button>
    <button id="__tm_dismiss_btn"
      style="
        background:transparent;color:#64748B;border:none;
        font-size:18px;cursor:pointer;padding:0 4px;line-height:1;
        flex-shrink:0;
      "
      aria-label="Dismiss">&times;</button>
  `;

  document.body.appendChild(toast);

  document.getElementById('__tm_update_btn').addEventListener('click', () => {
    toast.remove();
    onAccept();
  });
  document.getElementById('__tm_dismiss_btn').addEventListener('click', () => {
    toast.remove();
  });
}

// ── iOS "Add to Home Screen" install prompt helper ────────────────────────────
// Shows a one-time banner on iOS Safari where the native prompt isn't available.
export function showIOSInstallHint() {
  const isIOS      = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari   = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const dismissed  = localStorage.getItem('tm_ios_hint_dismissed');

  if (!isIOS || !isSafari || isStandalone || dismissed) return;

  // Wait a moment so it doesn't flash immediately on load
  setTimeout(() => {
    if (document.getElementById('__tm_ios_hint')) return;

    const hint = document.createElement('div');
    hint.id = '__tm_ios_hint';
    hint.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'z-index:99998',
      'background:#111827',
      'color:#F1F5F9',
      'border-top:1px solid #1E293B',
      'padding:16px 20px 20px',
      'font-family:system-ui,sans-serif',
      'font-size:13.5px',
      'display:flex', 'flex-direction:column', 'gap:10px',
      'box-shadow:0 -8px 24px rgba(0,0,0,.5)',
      'animation:tm_slide_up .28s ease forwards',
    ].join(';');

    hint.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="/icons/icon-72x72.png" width="36" height="36"
            style="border-radius:8px;flex-shrink:0;" alt="TechMart icon" />
          <div>
            <div style="font-weight:700;font-size:14px;">Install TechMart</div>
            <div style="color:#94A3B8;font-size:12px;margin-top:2px;">Add to your Home Screen for quick access</div>
          </div>
        </div>
        <button id="__tm_ios_close"
          style="background:transparent;color:#64748B;border:none;font-size:22px;cursor:pointer;padding:0;line-height:1;"
          aria-label="Close">&times;</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;background:#1E293B;border-radius:10px;padding:10px 14px;font-size:12.5px;color:#94A3B8;">
        <span>Tap</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        <span>then tap <strong style="color:#F1F5F9;">"Add to Home Screen"</strong></span>
      </div>
    `;

    document.body.appendChild(hint);

    document.getElementById('__tm_ios_close').addEventListener('click', () => {
      hint.remove();
      localStorage.setItem('tm_ios_hint_dismissed', '1');
    });
  }, 4000);
}
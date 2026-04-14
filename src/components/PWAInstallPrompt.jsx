// src/components/PWAInstallPrompt.jsx
// Shows a polished install banner when the browser fires the
// 'beforeinstallprompt' event (Chrome / Edge / Android).
// Dismissed state persists in localStorage.

import { useEffect, useState } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible]               = useState(false);
  const [installed, setInstalled]           = useState(false);

  useEffect(() => {
    // Already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return; // iOS standalone

    // User already dismissed
    if (localStorage.getItem('tm_pwa_dismissed') === '1') return;

    const handler = e => {
      e.preventDefault();          // stop the mini-infobar
      setDeferredPrompt(e);
      // Slight delay so it doesn't appear instantly on first load
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.setItem('tm_pwa_dismissed', '1');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('tm_pwa_dismissed', '1');
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install TechMart app"
      style={{
        position:      'fixed',
        bottom:        24,
        left:          '50%',
        transform:     'translateX(-50%)',
        zIndex:        9998,
        width:         'calc(100% - 32px)',
        maxWidth:      420,
        background:    'var(--bg-card, #111827)',
        border:        '1px solid var(--border-soft, #1E293B)',
        borderRadius:  16,
        boxShadow:     '0 20px 60px rgba(0,0,0,.55)',
        padding:       '18px 20px',
        display:       'flex',
        flexDirection: 'column',
        gap:           14,
        animation:     'tm_pwa_slide 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}
    >
      <style>{`
        @keyframes tm_pwa_slide {
          from { opacity:0; transform:translateX(-50%) translateY(28px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Header row */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <img
          src="/icons/icon-72x72.png"
          alt="TechMart icon"
          width={44}
          height={44}
          style={{ borderRadius:10, flexShrink:0 }}
        />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontFamily: 'var(--font, system-ui)',
            fontSize:   14,
            fontWeight: 700,
            color:      'var(--text-primary, #F1F5F9)',
            letterSpacing: '-.02em',
          }}>
            Install TechMart Network
          </div>
          <div style={{
            fontFamily: 'var(--font, system-ui)',
            fontSize:   12,
            color:      'var(--text-secondary, #94A3B8)',
            marginTop:  3,
          }}>
            Add to your home screen for instant access
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          style={{
            background:  'transparent',
            border:      'none',
            color:       'var(--text-tertiary, #64748B)',
            fontSize:    22,
            lineHeight:  1,
            cursor:      'pointer',
            padding:     '0 2px',
            flexShrink:  0,
          }}
        >
          ×
        </button>
      </div>

      {/* Feature bullets */}
      <div style={{
        background:   'var(--bg-secondary, #1E293B)',
        borderRadius: 10,
        padding:      '10px 14px',
        display:      'flex',
        flexDirection:'column',
        gap:           6,
      }}>
        {[
          { icon:'⚡', text: 'Faster than opening in a browser' },
          { icon:'📴', text: 'Works offline — view data without internet' },
          { icon:'🔔', text: 'No browser chrome — full-screen experience' },
        ].map(({ icon, text }) => (
          <div key={text} style={{
            display:    'flex',
            alignItems: 'center',
            gap:         8,
            fontSize:   12.5,
            color:      'var(--text-secondary, #94A3B8)',
            fontFamily: 'var(--font, system-ui)',
          }}>
            <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{icon}</span>
            {text}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display:'flex', gap:10 }}>
        <button
          onClick={handleInstall}
          style={{
            flex:        1,
            background:  'var(--emerald, #059669)',
            color:       '#fff',
            border:      'none',
            borderRadius:10,
            padding:     '11px 0',
            fontSize:    13.5,
            fontWeight:  700,
            cursor:      'pointer',
            fontFamily:  'var(--font, system-ui)',
            boxShadow:   '0 2px 8px rgba(5,150,105,.4)',
          }}
        >
          Install app
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background:  'transparent',
            color:       'var(--text-secondary, #94A3B8)',
            border:      '1px solid var(--border-soft, #1E293B)',
            borderRadius:10,
            padding:     '11px 18px',
            fontSize:    13.5,
            cursor:      'pointer',
            fontFamily:  'var(--font, system-ui)',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
// src/components/PWAInstallPrompt.jsx
//
// Reads the install event captured at MODULE LEVEL in registerSW.js.
// A single useEffect subscribes immediately — no early-exit checks that
// would prevent hearing the event when it fires after uninstall.

import { useEffect, useState } from 'react';
import { onInstallEvent, clearInstallEvent } from '../registerSW';

export default function PWAInstallPrompt() {
  const [evt,     setEvt]     = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Never show if already running in standalone (installed) mode
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return; // iOS standalone check

    // Subscribe — callback fires immediately with any already-captured event,
    // then again whenever beforeinstallprompt or appinstalled fires.
    // We do NOT check tm_pwa_dismissed before subscribing — registerSW.js
    // already clears that flag when the browser fires beforeinstallprompt,
    // so by the time we receive the event here it is always safe to show.
    const unsub = onInstallEvent(e => {
      setEvt(e);
      if (e) {
        // Small delay so the UI has settled before the sheet appears
        setTimeout(() => setVisible(true), 2000);
      } else {
        setVisible(false);
      }
    });

    return unsub;
  }, []);

  const handleInstall = async () => {
    if (!evt) return;
    setVisible(false);
    evt.prompt();
    const { outcome } = await evt.userChoice;
    clearInstallEvent();
    setEvt(null);
    // appinstalled event will set tm_pwa_dismissed via registerSW.js
    // If user declined, don't set dismissed — let them see it again next visit
  };

  const handleDismiss = () => {
    setVisible(false);
    // Mark dismissed for this session. If user uninstalls later, registerSW.js
    // clears this flag automatically when beforeinstallprompt fires again.
    localStorage.setItem('tm_pwa_dismissed', '1');
  };

  if (!visible || !evt) return null;

  return (
    <>
      {/* Scrim — tap outside to dismiss */}
      <div
        onClick={handleDismiss}
        aria-hidden="true"
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         9997,
          background:     'rgba(0,0,0,.45)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          animation:      '_tm_pwa_fade .22s ease forwards',
        }}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install TechMart app"
        style={{
          position:      'fixed',
          bottom:        0,
          left:          0,
          right:         0,
          zIndex:        9998,
          background:    'var(--bg-card, #111827)',
          borderTop:     '1px solid var(--border-soft, #1E293B)',
          borderRadius:  '20px 20px 0 0',
          boxShadow:     '0 -24px 60px rgba(0,0,0,.6)',
          padding:       '20px 22px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          display:       'flex',
          flexDirection: 'column',
          gap:           16,
          animation:     '_tm_pwa_up .3s cubic-bezier(0.34,1.3,0.64,1) forwards',
          maxWidth:      500,
          margin:        '0 auto',
        }}
      >
        <style>{`
          @keyframes _tm_pwa_up   { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
          @keyframes _tm_pwa_fade { from{opacity:0} to{opacity:1} }
        `}</style>

        {/* Drag handle */}
        <div style={{
          width:40, height:4, borderRadius:2,
          background:'var(--border-soft,#1E293B)',
          margin:'-6px auto 0', flexShrink:0,
        }}/>

        {/* App identity row */}
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <img
            src="/icons/icon-72x72.png"
            alt="TechMart"
            width={52} height={52}
            style={{ borderRadius:13, flexShrink:0, boxShadow:'0 4px 14px rgba(0,0,0,.35)' }}
          />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:16, fontWeight:700, letterSpacing:'-.02em',
              color:'var(--text-primary,#F1F5F9)', lineHeight:1.2,
            }}>
              Install TechMart Network
            </div>
            <div style={{
              fontSize:12.5, marginTop:4, lineHeight:1.4,
              color:'var(--text-secondary,#94A3B8)',
            }}>
              Add to your home screen — no app store needed
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              width:32, height:32, borderRadius:'50%', border:'none',
              background:'var(--bg-secondary,#1E293B)',
              color:'var(--text-tertiary,#64748B)',
              fontSize:20, cursor:'pointer', display:'flex',
              alignItems:'center', justifyContent:'center', flexShrink:0,
            }}
          >×</button>
        </div>

        {/* Benefits */}
        <div style={{
          background:'var(--bg-secondary,#1E293B)', borderRadius:12,
          padding:'12px 16px', display:'flex', flexDirection:'column', gap:10,
        }}>
          {[
            ['⚡', 'Opens instantly — no browser search needed'],
            ['📴', 'Browse your data even without internet'],
            ['🖥️', 'Full-screen, no browser address bar'],
            ['🔗', 'Quick shortcuts to Sales, Inventory & Reports'],
          ].map(([icon, text]) => (
            <div key={text} style={{
              display:'flex', alignItems:'flex-start', gap:10,
              fontSize:13, color:'var(--text-secondary,#94A3B8)', lineHeight:1.45,
            }}>
              <span style={{ fontSize:15, lineHeight:1.2, flexShrink:0 }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={handleInstall}
            style={{
              flex:1, background:'var(--emerald,#059669)', color:'#fff',
              border:'none', borderRadius:12, padding:'13px 0',
              fontSize:14, fontWeight:700, cursor:'pointer',
              boxShadow:'0 4px 14px rgba(5,150,105,.4)', letterSpacing:'-.01em',
            }}
          >
            Install app
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background:'transparent', border:'1.5px solid var(--border-soft,#1E293B)',
              borderRadius:12, padding:'13px 20px',
              fontSize:13.5, cursor:'pointer',
              color:'var(--text-secondary,#94A3B8)', letterSpacing:'-.01em',
            }}
          >
            Not now
          </button>
        </div>

        <p style={{
          fontSize:11, textAlign:'center', margin:'-4px 0 0',
          color:'var(--text-tertiary,#475569)', lineHeight:1.5,
        }}>
          No app store · Installs directly from your browser
        </p>
      </div>
    </>
  );
}
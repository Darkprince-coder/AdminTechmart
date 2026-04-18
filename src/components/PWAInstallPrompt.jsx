// src/components/PWAInstallPrompt.jsx
//
// Fix vs previous version:
//   The setTimeout(() => setVisible(true), 2000) was never cleared in the
//   useEffect cleanup. If the component unmounted within 2 seconds of
//   receiving the install event (React Strict Mode remount, route change, etc.)
//   the timeout fired on a dead component and the state update was silently
//   discarded — so the prompt never appeared.
//
//   Now the timeout ID is stored in a ref and cleared on cleanup.

import { useEffect, useRef, useState } from 'react';
import { onInstallEvent, clearInstallEvent } from '../registerSW';

export default function PWAInstallPrompt() {
  const [evt,     setEvt]     = useState(null);
  const [visible, setVisible] = useState(false);
  const timerRef              = useRef(null);   // ← stores pending setTimeout id

  useEffect(() => {
    // Already running as an installed PWA — don't show the prompt
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return;

    const unsub = onInstallEvent(e => {
      setEvt(e);

      // Clear any pending timer before scheduling a new one
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (e) {
        // Short delay so the page UI settles before the sheet slides up
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setVisible(true);
        }, 1500);
      } else {
        setVisible(false);
      }
    });

    // Cleanup: unsubscribe AND cancel any pending show-timer
    return () => {
      unsub();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleInstall = async () => {
    if (!evt) return;
    setVisible(false);
    try {
      evt.prompt();
      const { outcome } = await evt.userChoice;
      clearInstallEvent();
      setEvt(null);
      // Note: if outcome === 'accepted', the 'appinstalled' event fires in
      // registerSW.js which sets tm_pwa_dismissed. If declined, we leave the
      // flag unset so the prompt can appear again on the next visit.
    } catch {
      // prompt() can throw if called more than once — handle gracefully
      clearInstallEvent();
      setEvt(null);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    // Record dismissal for this session. If user later uninstalls the PWA,
    // registerSW.js clears this flag when beforeinstallprompt fires again.
    localStorage.setItem('tm_pwa_dismissed', '1');
  };

  if (!visible || !evt) return null;

  return (
    <>
      {/* Scrim — tapping outside dismisses the sheet */}
      <div
        aria-hidden="true"
        onClick={handleDismiss}
        style={{
          position:             'fixed',
          inset:                0,
          zIndex:               9997,
          background:           'rgba(0,0,0,.5)',
          backdropFilter:       'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          animation:            '_tm_fade .22s ease forwards',
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
          animation:     '_tm_up .3s cubic-bezier(0.34,1.3,0.64,1) forwards',
        }}
      >
        <style>{`
          @keyframes _tm_up   { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
          @keyframes _tm_fade { from{opacity:0}                            to{opacity:1}                         }
        `}</style>

        {/* Drag handle */}
        <div style={{
          width:48, height:4, borderRadius:2, margin:'-6px auto 0', flexShrink:0,
          background:'var(--border-soft, #334155)',
        }}/>

        {/* App header row */}
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <img
            src="/icons/icon-72x72.png"
            alt="TechMart"
            width={52}
            height={52}
            style={{ borderRadius:13, flexShrink:0, boxShadow:'0 4px 14px rgba(0,0,0,.35)' }}
          />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:      16,
              fontWeight:    700,
              letterSpacing: '-.02em',
              lineHeight:    1.2,
              color:         'var(--text-primary, #F1F5F9)',
            }}>
              Install TechMart Network
            </div>
            <div style={{
              fontSize:   12.5,
              marginTop:  4,
              lineHeight: 1.4,
              color:      'var(--text-secondary, #94A3B8)',
            }}>
              Add to your home screen — no app store needed
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              width:30, height:30, borderRadius:'50%', border:'none',
              background:'var(--bg-secondary, #1E293B)',
              color:'var(--text-tertiary, #64748B)',
              fontSize:20, lineHeight:1, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
            }}
          >
            ×
          </button>
        </div>

        {/* Benefits list */}
        <div style={{
          background:   'var(--bg-secondary, #1E293B)',
          borderRadius: 12,
          padding:      '12px 16px',
          display:      'flex',
          flexDirection:'column',
          gap:          10,
        }}>
          {[
            ['⚡', 'Opens instantly — no browser needed'],
            ['📴', 'Works offline — browse data without internet'],
            ['🖥️', 'Full-screen, no address bar in the way'],
            ['🔗', 'Quick shortcuts to Sales, Inventory & Reports'],
          ].map(([icon, text]) => (
            <div key={text} style={{
              display:    'flex',
              alignItems: 'flex-start',
              gap:        10,
              fontSize:   13,
              lineHeight: 1.45,
              color:      'var(--text-secondary, #94A3B8)',
            }}>
              <span style={{ fontSize:15, lineHeight:1.2, flexShrink:0 }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={handleInstall}
            style={{
              flex:          1,
              background:    'var(--emerald, #059669)',
              color:         '#fff',
              border:        'none',
              borderRadius:  12,
              padding:       '13px 0',
              fontSize:      14,
              fontWeight:    700,
              cursor:        'pointer',
              letterSpacing: '-.01em',
              boxShadow:     '0 4px 14px rgba(5,150,105,.4)',
            }}
          >
            Install app
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background:   'transparent',
              color:        'var(--text-secondary, #94A3B8)',
              border:       '1.5px solid var(--border-soft, #1E293B)',
              borderRadius: 12,
              padding:      '13px 20px',
              fontSize:     13.5,
              cursor:       'pointer',
              letterSpacing:'-.01em',
            }}
          >
            Not now
          </button>
        </div>

        <p style={{
          margin:     '-4px 0 0',
          fontSize:   11,
          textAlign:  'center',
          lineHeight: 1.5,
          color:      'var(--text-tertiary, #475569)',
        }}>
          No app store · Installs directly from your browser
        </p>
      </div>
    </>
  );
}
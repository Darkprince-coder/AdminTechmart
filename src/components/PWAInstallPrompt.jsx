// src/components/PWAInstallPrompt.jsx
//
// IMPORTANT — why this works differently from the naive pattern:
//
// The naive approach (addEventListener inside useEffect) FAILS on mobile because
// Chrome fires `beforeinstallprompt` during early page load — before React
// components mount and useEffect runs. By then the event is gone.
//
// This component instead reads the event that was captured at MODULE LEVEL
// in registerSW.js (via onInstallEventChange / getStoredInstallEvent).
// That module-level listener runs synchronously on import, so it always fires
// before any React rendering.

import { useEffect, useState } from 'react';
import {
  onInstallEventChange,
  getStoredInstallEvent,
  clearStoredInstallEvent,
} from '../registerSW';

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(() => getStoredInstallEvent());
  const [visible,      setVisible]      = useState(false);

  // ── Subscribe to the module-level event store ─────────────────────────────
  useEffect(() => {
    // Already installed / dismissed
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return;
    if (localStorage.getItem('tm_pwa_dismissed') === '1') return;

    const unsub = onInstallEventChange(evt => {
      setInstallEvent(evt);
      if (evt) {
        // Show after a short delay so the app has finished loading
        setTimeout(() => setVisible(true), 2500);
      } else {
        setVisible(false);
      }
    });

    return unsub;
  }, []);

  // ── Trigger visibility if event was already captured before mount ──────────
  useEffect(() => {
    if (!installEvent) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return;
    if (localStorage.getItem('tm_pwa_dismissed') === '1') return;
    // Event was already captured before this component mounted
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally on mount only

  const handleInstall = async () => {
    const evt = installEvent || getStoredInstallEvent();
    if (!evt) return;
    setVisible(false);
    evt.prompt();
    const { outcome } = await evt.userChoice;
    clearStoredInstallEvent();
    setInstallEvent(null);
    if (outcome === 'accepted') {
      localStorage.setItem('tm_pwa_dismissed', '1');
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('tm_pwa_dismissed', '1');
  };

  if (!visible || !installEvent) return null;

  return (
    <>
      {/* Backdrop blur on mobile */}
      <div
        onClick={handleDismiss}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     9997,
          background: 'rgba(0,0,0,.35)',
          backdropFilter: 'blur(2px)',
          animation:  'tm_pwa_fade .25s ease forwards',
        }}
      />

      {/* Install card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Install TechMart app"
        style={{
          position:       'fixed',
          bottom:         0,
          left:           0,
          right:          0,
          zIndex:         9998,
          background:     'var(--bg-card, #111827)',
          borderTop:      '1px solid var(--border-soft, #1E293B)',
          borderRadius:   '20px 20px 0 0',
          boxShadow:      '0 -20px 60px rgba(0,0,0,.55)',
          padding:        'clamp(18px, 4vw, 24px) clamp(18px, 5vw, 28px)',
          paddingBottom:  'calc(clamp(18px, 4vw, 24px) + env(safe-area-inset-bottom, 0px))',
          display:        'flex',
          flexDirection:  'column',
          gap:            16,
          animation:      'tm_pwa_slide .32s cubic-bezier(0.34,1.56,0.64,1) forwards',
          maxWidth:       480,
          margin:         '0 auto',
        }}
      >
        <style>{`
          @keyframes tm_pwa_slide {
            from { opacity:0; transform:translateY(100%); }
            to   { opacity:1; transform:translateY(0); }
          }
          @keyframes tm_pwa_fade {
            from { opacity:0; }
            to   { opacity:1; }
          }
        `}</style>

        {/* Drag handle */}
        <div style={{
          width:        40,
          height:       4,
          borderRadius: 2,
          background:   'var(--border, #1E293B)',
          margin:       '-4px auto 2px',
          flexShrink:   0,
        }} />

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <img
            src="/icons/icon-72x72.png"
            alt="TechMart icon"
            width={52}
            height={52}
            style={{ borderRadius:12, flexShrink:0, boxShadow:'0 4px 12px rgba(0,0,0,.3)' }}
          />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:    'var(--font, system-ui)',
              fontSize:      16,
              fontWeight:    700,
              color:         'var(--text-primary, #F1F5F9)',
              letterSpacing: '-.02em',
              lineHeight:    1.25,
            }}>
              Install TechMart Network
            </div>
            <div style={{
              fontFamily: 'var(--font, system-ui)',
              fontSize:   12.5,
              color:      'var(--text-secondary, #94A3B8)',
              marginTop:  4,
              lineHeight: 1.4,
            }}>
              Add to your home screen for instant access — no browser needed
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              background:   'var(--bg-secondary, #1E293B)',
              border:       'none',
              borderRadius: '50%',
              width:        32,
              height:       32,
              display:      'flex',
              alignItems:   'center',
              justifyContent:'center',
              color:        'var(--text-tertiary, #64748B)',
              fontSize:     20,
              cursor:       'pointer',
              flexShrink:   0,
              lineHeight:   1,
            }}
          >
            ×
          </button>
        </div>

        {/* Feature list */}
        <div style={{
          background:   'var(--bg-secondary, #1E293B)',
          borderRadius: 12,
          padding:      '12px 16px',
          display:      'flex',
          flexDirection:'column',
          gap:          10,
        }}>
          {[
            { emoji: '⚡', text: 'Opens instantly — faster than a browser bookmark' },
            { emoji: '📴', text: 'Works offline — browse data without internet' },
            { emoji: '🖥️', text: 'Full-screen experience with no browser chrome' },
            { emoji: '🔗', text: 'Deep shortcuts to Sales, Inventory & Reports' },
          ].map(({ emoji, text }) => (
            <div key={text} style={{
              display:    'flex',
              alignItems: 'flex-start',
              gap:        10,
              fontFamily: 'var(--font, system-ui)',
              fontSize:   13,
              color:      'var(--text-secondary, #94A3B8)',
              lineHeight: 1.45,
            }}>
              <span style={{ fontSize:16, lineHeight:1.2, flexShrink:0 }}>{emoji}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={handleInstall}
            style={{
              flex:         1,
              background:   'var(--emerald, #059669)',
              color:        '#fff',
              border:       'none',
              borderRadius: 12,
              padding:      '13px 0',
              fontSize:     14,
              fontWeight:   700,
              cursor:       'pointer',
              fontFamily:   'var(--font, system-ui)',
              boxShadow:    '0 4px 12px rgba(5,150,105,.45)',
              letterSpacing:'-.01em',
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
              fontFamily:   'var(--font, system-ui)',
              letterSpacing:'-.01em',
            }}
          >
            Not now
          </button>
        </div>

        {/* Reassurance footnote */}
        <p style={{
          fontFamily: 'var(--font, system-ui)',
          fontSize:   11,
          color:      'var(--text-tertiary, #475569)',
          textAlign:  'center',
          margin:     '-4px 0 0',
          lineHeight: 1.5,
        }}>
          No app store required · Installs directly from your browser
        </p>
      </div>
    </>
  );
}
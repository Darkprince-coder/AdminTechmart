// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW, showIOSInstallHint } from './registerSW';

// NOTE: registerSW.js is imported *above* App — the module-level
// beforeinstallprompt listener runs as soon as this file is parsed,
// before any React rendering begins. This ensures mobile Chrome's
// early-fired event is never missed.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker (enables offline support + install eligibility)
registerSW();

// Show the manual "Add to Home Screen" guide on iOS Safari
showIOSInstallHint();
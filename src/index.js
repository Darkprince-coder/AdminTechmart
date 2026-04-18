// src/index.js
//
// IMPORT ORDER MATTERS:
//   registerSW must be imported FIRST. ES module imports are hoisted and
//   executed in declaration order. By placing it before React and App,
//   the module-level window.addEventListener('beforeinstallprompt', ...)
//   in registerSW.js runs before any other code — including React's own
//   initialization. This guarantees we never miss the event on mobile Chrome
//   even if it fires extremely early in the page lifecycle.

import { registerSW, showIOSInstallHint } from './registerSW'; // ← MUST BE FIRST
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker — required for Chrome to fire beforeinstallprompt.
// registerSW() handles the readyState check internally, so it's safe to call
// at any point after the module is imported.
registerSW();

// Show the iOS "Add to Home Screen" manual guide (Safari doesn't support the
// beforeinstallprompt API — this is the only way to guide iOS users).
showIOSInstallHint();
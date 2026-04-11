// src/components/ErrorBoundary.jsx
// Wraps the whole app — catches JS errors AND offline state

import { Component } from 'react';
import '../styles/error.css';

// ---- Online/Offline detector (functional wrapper) ----
import { useState, useEffect } from 'react';

export function NetworkGuard({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOnline  = () => { setIsOnline(true); };
    const goOffline = () => { setIsOnline(false); setWasOffline(true); };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <div className="error-icon-wrap error-icon-offline">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/>
              <path d="M5 12.55a10.94 10.94 0 015.17-2.39"/>
              <path d="M10.71 5.05A16 16 0 0122.56 9"/>
              <path d="M1.42 9a15.91 15.91 0 014.7-2.88"/>
              <path d="M8.53 16.11a6 6 0 016.95 0"/>
              <circle cx="12" cy="20" r="1" fill="currentColor"/>
            </svg>
          </div>
          <h2 className="error-title">No internet connection</h2>
          <p className="error-desc">
            Please check your network connection and try again.
            The app needs internet to sync data.
          </p>
          <button
            className="error-btn"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Back online banner
  if (wasOffline && isOnline) {
    // Auto-clear after showing briefly — handled via CSS animation
  }

  return children;
}

// ---- React error boundary (catches JS crashes) ----
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <div className="error-icon-wrap error-icon-crash">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2 className="error-title">Something went wrong</h2>
            <p className="error-desc">
              An unexpected error occurred. Please refresh the page.
              If the problem persists, contact support.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="error-detail">
                {this.state.error?.message}
              </pre>
            )}
            <button
              className="error-btn"
              onClick={() => window.location.reload()}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

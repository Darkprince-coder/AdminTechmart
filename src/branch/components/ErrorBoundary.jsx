// src/components/ErrorBoundary.jsx
import { Component, useState, useEffect } from 'react';
import '../styles/error.css';

/* ---- Network / offline guard ---- */
export function NetworkGuard({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="err-screen">
        <div className="err-card">
          <div className="err-icon err-icon-offline">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
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
          <h2 className="err-title">No internet connection</h2>
          <p className="err-desc">
            Check your network and try again. The app needs internet to load and save data.
          </p>
          <button className="err-btn" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return children;
}

/* ---- JS crash boundary ---- */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Ezekii] Unhandled error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="err-screen">
        <div className="err-card">
          <div className="err-icon err-icon-crash">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8"  x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="err-title">Something went wrong</h2>
          <p className="err-desc">
            An unexpected error occurred. Please refresh and try again.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="err-detail">{this.state.error?.message}</pre>
          )}
          <button className="err-btn" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      </div>
    );
  }
}

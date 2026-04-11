// src/pages/LoginPage.jsx  (ADMIN PROJECT — redesigned)

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/login.css';

export default function LoginPage() {
  const { signIn }              = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!email.trim())    { setError('Enter your email address'); return; }
    if (!password.trim()) { setError('Enter your password'); return; }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(
        error.message?.includes('Invalid login')
          ? 'Incorrect email or password.'
          : error.message || 'Sign in failed.'
      );
    }
    setLoading(false);
  };

  return (
    <div className="login-bg">
      <div className="login-page">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <div className="login-left-brand">
          <div className="login-left-logo">
            <svg viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
              <path d="M7 8h2M11 8h6M7 12h4M15 12h2"/>
            </svg>
          </div>
          <div>
            <div className="login-left-brand-name">TechMart Admin</div>
            <div className="login-left-brand-sub">Network Control</div>
          </div>
        </div>

        <div className="login-left-hero">
          <h1 className="login-left-headline">
            Manage every branch<br/>
            from <span>one place</span>
          </h1>
          <p className="login-left-sub">
            Real-time inventory, sales tracking, stock transfers, and branch performance all in a single dashboard built for electronics retailers.
          </p>
        </div>

        <div className="login-left-stats">
          <div className="login-stat">
            <span className="login-stat-val">100%</span>
            <span className="login-stat-label">Real-time sync</span>
          </div>
          <div className="login-stat">
            <span className="login-stat-val">Multi</span>
            <span className="login-stat-label">Branch support</span>
          </div>
          <div className="login-stat">
            <span className="login-stat-val">Live</span>
            <span className="login-stat-label">Profit tracking</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <button className="login-theme-btn" onClick={toggleTheme} title="Toggle theme">
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          )}
        </button>

        <div className="login-form-wrap">
          <div className="login-form-header">
            <h2 className="login-form-title">Welcome back</h2>
            <p className="login-form-sub">Sign in to the admin panel to manage your network.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email" type="email" className="form-input"
                placeholder="admin@techmart.co.ke"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                autoComplete="email" autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="login-pass-wrap">
                <input
                  id="password" type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                />
                <button type="button" className="login-pass-eye"
                  onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? (
                <><span className="spinner spinner-sm"/> Signing in…</>
              ) : 'Sign in to admin panel'}
            </button>
          </form>

          <p className="login-footer-text">
            Authorised access only. This portal is monitored.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

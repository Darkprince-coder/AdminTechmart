import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/role-select.css';

function ChevronRight() {
  return (
    <svg className="role-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function RoleSelectPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [portalError, setPortalError] = useState('');
  const { session, profile, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (location.state?.portalError) {
      setPortalError(location.state.portalError);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleRoleSelect = async (role) => {
    if (session && profile && profile.role !== role) {
      await signOut();
    }
    navigate(`/login?role=${role}`);
  };

  return (
    <div className="role-select-screen">
      <div className="role-select-inner">
        <div className="role-select-topbar">
          <button
            type="button"
            className="role-select-theme-btn"
            onClick={toggleTheme}
            title={isDark ? 'Light mode' : 'Dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>
        </div>

        <div className="role-select-card">
          <div className="role-select-brand">
            <div className="role-select-brand-icon" aria-hidden>
              <svg viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
                <path d="M7 8h2M11 8h6M7 12h4M15 12h2" />
              </svg>
            </div>
            <div className="role-select-brand-text">
              <div className="role-select-brand-name">TechMart</div>
              <div className="role-select-brand-tag">Network</div>
            </div>
          </div>

          <div className="role-select-header">
            <h1>Choose how you sign in</h1>
            <p>Select the portal that matches your account. You can switch this later by signing out.</p>
          </div>

          {portalError && (
            <div className="role-select-alert" role="alert">
              <strong>Wrong portal:</strong> {portalError}
            </div>
          )}

          <div className="role-select-options">
            <button type="button" className="role-btn role-admin" onClick={() => handleRoleSelect('admin')}>
              <div className="role-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <div className="role-text">
                <h3>Administrator</h3>
                <p>All branches, users, transfers, reports, and network overview.</p>
              </div>
              <ChevronRight />
            </button>

            <button type="button" className="role-btn role-manager" onClick={() => handleRoleSelect('manager')}>
              <div className="role-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div className="role-text">
                <h3>Branch manager</h3>
                <p>Inventory, sales, and reports for your assigned branch only.</p>
              </div>
              <ChevronRight />
            </button>
          </div>

          <p className="role-select-foot">
            Use the portal that matches the role on your TechMart account. If you are unsure, ask your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

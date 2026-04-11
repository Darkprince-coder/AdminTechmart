// src/pages/RoleSelectPage.jsx
import { useNavigate } from 'react-router-dom';
import '../styles/role-select.css';

export default function RoleSelectPage() {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    // Navigate to login with role param
    navigate(`/login?role=${role}`);
  };

  return (
    <div className="role-select-screen">
      <div className="role-select-card">
        <div className="role-select-header">
          <h1>Welcome to TechMart</h1>
          <p>Select your role to continue</p>
        </div>
        <div className="role-select-options">
          <button
            className="role-btn role-admin"
            onClick={() => handleRoleSelect('admin')}
          >
            <div className="role-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <div className="role-text">
              <h3>Admin</h3>
              <p>Manage branches, users, and reports</p>
            </div>
          </button>
          <button
            className="role-btn role-manager"
            onClick={() => handleRoleSelect('manager')}
          >
            <div className="role-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="role-text">
              <h3>Branch Manager</h3>
              <p>Manage inventory and sales at your branch</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
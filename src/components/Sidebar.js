import React from 'react';
import authService from '../authService';

const Sidebar = ({ 
  logo, 
  currentUser, 
  activeTab, 
  onTabChange, 
  onLogout 
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-wrapper">
          <img src={logo} alt="Aayu Well" className="logo-image" />
        </div>
        <div className="sidebar-title">Aayu Well</div>
        <div className="sidebar-subtitle">AI SCRIBE</div>
        {currentUser && (
          <div className="user-info-sidebar">
            {currentUser.name || 'Unknown User'}
            <br />
            <span className="user-role">
              {(currentUser.role || '').replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <nav className="sidebar-nav">
        <button 
          className={`nav-button ${activeTab === 'scribe' ? 'active' : ''}`}
          onClick={() => onTabChange('scribe')}
          disabled={!authService?.hasPermission('scribe')}
        >
          Scribe
        </button>

        <button 
          className={`nav-button ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => onTabChange('training')}
          disabled={!authService?.hasPermission('scribe')}
        >
          Training
        </button>

        <button 
          className={`nav-button ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => onTabChange('patients')}
        >
          Patients
        </button>
        
        <button 
          className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          Settings
        </button>

        {authService?.hasPermission('add_users') && (
          <button 
            className={`nav-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => onTabChange('users')}
          >
            Users
          </button>
        )}

        <button 
          className="nav-button logout-button"
          onClick={onLogout}
        >
          Logout
        </button>
      </nav>
      
      <div className="sidebar-footer">
        Secure • HIPAA Compliant
        <br />
        Medical Scribe AI v2.3
      </div>
    </div>
  );
};

export default Sidebar;

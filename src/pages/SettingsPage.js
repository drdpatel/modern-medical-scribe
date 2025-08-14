import React from 'react';

const SettingsPage = () => {
  return (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">System Settings</h2>
      </div>

      <div className="card glass-card">
        <h3 className="card-title">System Configuration Status</h3>
        <p className="settings-description">
          All AI services are configured securely on the server. Contact your administrator to update configurations.
        </p>

        <div className="settings-form">
          <div style={{ 
            padding: '24px', 
            backgroundColor: 'rgba(186, 230, 55, 0.1)', 
            borderRadius: '12px',
            border: '2px solid rgba(186, 230, 55, 0.3)'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--primary-navy)' }}>
              ✅ System Status - All Services Operational
            </h4>
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(186, 230, 55, 0.2)' }}>
                <strong>🎤 Speech Service:</strong>
                <span style={{ float: 'right', color: '#10b981' }}>✓ Configured (Azure)</span>
              </div>
              <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(186, 230, 55, 0.2)' }}>
                <strong>🤖 AI Service:</strong>
                <span style={{ float: 'right', color: '#10b981' }}>✓ Configured (GPT-4)</span>
              </div>
              <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(186, 230, 55, 0.2)' }}>
                <strong>👥 User Management:</strong>
                <span style={{ float: 'right', color: '#10b981' }}>✓ Active</span>
              </div>
              <div style={{ padding: '8px 0' }}>
                <strong>💾 Data Storage:</strong>
                <span style={{ float: 'right', color: '#10b981' }}>✓ Azure Tables</span>
              </div>
            </div>
          </div>

          <div style={{ 
            marginTop: '20px', 
            padding: '20px', 
            backgroundColor: 'rgba(155, 47, 205, 0.05)', 
            borderRadius: '12px',
            border: '1px solid rgba(155, 47, 205, 0.2)'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--accent-purple)' }}>
              🔒 Security Information
            </h4>
            <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
              All API keys and sensitive configurations are managed securely through Azure Portal 
              and are never exposed to the client application.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--gray-dark)' }}>
              <strong>For configuration changes, contact:</strong><br/>
              IT Administrator: admin@aayuwell.com<br/>
              Azure Portal: <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" 
                style={{ color: 'var(--accent-purple)' }}>portal.azure.com</a>
            </p>
          </div>

          <div style={{ 
            marginTop: '20px', 
            padding: '20px', 
            backgroundColor: 'rgba(59, 130, 246, 0.05)', 
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '12px', color: '#3b82f6' }}>
              📊 System Information
            </h4>
            <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>API Endpoint:</span>
                <span style={{ fontSize: '12px', color: 'var(--gray-dark)' }}>
                  aayuscribe-api.azurewebsites.net
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Speech Region:</span>
                <span style={{ fontSize: '12px', color: 'var(--gray-dark)' }}>East US</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>Model Version:</span>
                <span style={{ fontSize: '12px', color: 'var(--gray-dark)' }}>GPT-4 (Latest)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>App Version:</span>
                <span style={{ fontSize: '12px', color: 'var(--gray-dark)' }}>v2.5.0</span>
              </div>
            </div>
          </div>

          <div style={{ 
            marginTop: '20px', 
            padding: '16px', 
            backgroundColor: 'rgba(245, 158, 11, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '13px',
            color: 'var(--gray-dark)'
          }}>
            <strong>ℹ️ Note:</strong> All speech processing and AI services are configured at the server level 
            for maximum security. No API keys are stored or transmitted through the browser.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

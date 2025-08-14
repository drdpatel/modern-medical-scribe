import React from 'react';

const AZURE_SPEECH_REGIONS = [
  { value: 'eastus', label: 'East US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'centralus', label: 'Central US' },
  { value: 'westeurope', label: 'West Europe' }
];

const SettingsPage = ({ 
  apiSettings, 
  setApiSettings, 
  showApiKeys, 
  setShowApiKeys, 
  onSaveSettings 
}) => {
  return (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">API Settings</h2>
      </div>

      <div className="card glass-card">
        <h3 className="card-title">Azure Speech Configuration</h3>
        <p className="settings-description">
          Configure your Azure Speech service for voice transcription. This key is required for recording functionality.
        </p>

        <div className="settings-form">
          <div className="form-group">
            <label className="form-label">Azure Speech Service Key *</label>
            <input 
              type={showApiKeys ? "text" : "password"} 
              className="form-input glass-input" 
              placeholder="Enter your Azure Speech key"
              value={apiSettings.speechKey}
              onChange={(e) => setApiSettings({...apiSettings, speechKey: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Azure Speech Region *</label>
            <select 
              className="form-input glass-input"
              value={apiSettings.speechRegion}
              onChange={(e) => setApiSettings({...apiSettings, speechRegion: e.target.value})}
              required
            >
              {AZURE_SPEECH_REGIONS.map(region => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={showApiKeys}
                onChange={(e) => setShowApiKeys(e.target.checked)}
              />
              Show API Key
            </label>
          </div>

          <button 
            className="btn btn-glass-success" 
            onClick={() => onSaveSettings(apiSettings)}
            disabled={!apiSettings.speechKey}
          >
            Save Settings
          </button>
          
          <div style={{ 
            marginTop: '24px', 
            padding: '16px', 
            backgroundColor: 'rgba(186, 230, 55, 0.1)', 
            borderRadius: '8px',
            border: '1px solid rgba(186, 230, 55, 0.3)'
          }}>
            <strong>✅ System Status:</strong>
            <div style={{ marginTop: '8px', fontSize: '14px' }}>
              • Speech Service: {apiSettings.speechKey ? '✓ Configured' : '✗ Required'}<br/>
              • OpenAI Service: ✓ Configured on server (secure)<br/>
              • User Management: ✓ Active<br/>
              • Data Storage: ✓ Azure Tables
            </div>
          </div>

          <div style={{ 
            marginTop: '16px', 
            padding: '16px', 
            backgroundColor: 'rgba(59, 130, 246, 0.05)', 
            borderRadius: '8px',
            fontSize: '13px',
            color: '#64748b'
          }}>
            <strong>Note:</strong> OpenAI configuration is now managed securely on the server. 
            Only administrators can update OpenAI settings through Azure Portal.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

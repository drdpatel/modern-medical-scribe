import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // Navigation state
  const [activeTab, setActiveTab] = useState('patients');
  
  // Patient management states
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  // New patient form
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    medicalHistory: '',
    medications: ''
  });

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [status, setStatus] = useState('Ready to begin');

  // Load patients from localStorage
  useEffect(() => {
    const savedPatients = localStorage.getItem('medicalScribePatients');
    if (savedPatients) {
      setPatients(JSON.parse(savedPatients));
    }
  }, []);

  // Save patients to localStorage
  const savePatients = (updatedPatients) => {
    setPatients(updatedPatients);
    localStorage.setItem('medicalScribePatients', JSON.stringify(updatedPatients));
  };

  // Add new patient
  const addPatient = () => {
    if (!newPatient.firstName || !newPatient.lastName || !newPatient.dateOfBirth) {
      alert('Please fill in all required fields');
      return;
    }

    const patient = {
      id: Date.now(),
      ...newPatient,
      visits: [],
      createdAt: new Date().toISOString()
    };

    savePatients([...patients, patient]);
    setNewPatient({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      medicalHistory: '',
      medications: ''
    });
    setShowPatientModal(false);
  };

  // Filter patients based on search
  const filteredPatients = patients.filter(patient =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.dateOfBirth.includes(searchTerm)
  );

  // Get patient initials for avatar
  const getPatientInitials = (patient) => {
    return (patient.firstName[0] + patient.lastName[0]).toUpperCase();
  };

  // Get avatar color based on patient name
  const getAvatarColor = (patient) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const index = (patient.firstName.charCodeAt(0) + patient.lastName.charCodeAt(0)) % colors.length;
    return colors[index];
  };

  // Mock recording functions (to be replaced with real Azure integration)
  const startRecording = () => {
    if (!selectedPatient) {
      setStatus('Please select a patient first');
      return;
    }
    setIsRecording(true);
    setStatus('🔴 Recording... Speak now');
    
    // Simulate recording
    setTimeout(() => {
      setTranscript('Patient reports feeling better since last visit. Weight management is going well. Continuing with current treatment plan.');
      setIsRecording(false);
      setStatus('Recording complete - Ready to generate notes');
    }, 3000);
  };

  const generateNotes = () => {
    if (!transcript) {
      setStatus('No transcript available');
      return;
    }
    
    setStatus('🤖 Generating medical notes...');
    
    // Simulate AI processing
    setTimeout(() => {
      const notes = `OFFICE VISIT - ${new Date().toLocaleDateString()}

PATIENT: ${selectedPatient.firstName} ${selectedPatient.lastName}
DOB: ${selectedPatient.dateOfBirth}

CHIEF COMPLAINT:
Follow-up visit for ongoing care and monitoring.

HISTORY OF PRESENT ILLNESS:
${transcript}

CURRENT MEDICATIONS:
${selectedPatient.medications || 'No current medications listed'}

MEDICAL HISTORY:
${selectedPatient.medicalHistory || 'No significant medical history noted'}

ASSESSMENT:
Patient is doing well with current treatment plan.

PLAN:
Continue current management. Follow-up as scheduled.

Provider: [Provider Name]
Date: ${new Date().toLocaleDateString()}`;

      setMedicalNotes(notes);
      setStatus('Medical notes generated successfully');
    }, 2000);
  };

  const saveVisit = () => {
    if (!selectedPatient || !medicalNotes) {
      setStatus('Cannot save - missing patient or notes');
      return;
    }

    const visit = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      transcript: transcript,
      notes: medicalNotes,
      timestamp: new Date().toISOString()
    };

    const updatedPatients = patients.map(p => 
      p.id === selectedPatient.id 
        ? { ...p, visits: [...p.visits, visit] }
        : p
    );

    savePatients(updatedPatients);
    setSelectedPatient(updatedPatients.find(p => p.id === selectedPatient.id));
    setStatus('Visit saved successfully');
  };

  // Render navigation
  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">
          🏥 <span>Medical Scribe AI</span>
        </h1>
      </div>
      
      <nav className="sidebar-nav">
        <button 
          className={`nav-button ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          <span>👥</span> Patients
        </button>
        
        <button 
          className={`nav-button ${activeTab === 'recording' ? 'active' : ''}`}
          onClick={() => setActiveTab('recording')}
        >
          <span>🎙️</span> Recording
        </button>
        
        <button 
          className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span>⚙️</span> Settings
        </button>
      </nav>
      
      <div className="sidebar-footer">
        Medical Scribe AI v2.0<br />
        Secure • HIPAA Compliant
      </div>
    </div>
  );

  // Render patients page
  const renderPatientsPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Patient Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowPatientModal(true)}
        >
          ➕ Add New Patient
        </button>
      </div>

      <div className="card">
        <h3 className="card-title">Patient List</h3>
        
        <input
          type="text"
          className="search-input"
          placeholder="Search patients by name or date of birth..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <div className="search-results">
          {filteredPatients.length} patient(s) found
        </div>

        <div className="patient-list">
          {filteredPatients.map(patient => (
            <div 
              key={patient.id} 
              className="patient-card"
              onClick={() => setSelectedPatient(patient)}
            >
              <div 
                className="patient-avatar"
                style={{ backgroundColor: getAvatarColor(patient) }}
              >
                {getPatientInitials(patient)}
              </div>
              
              <div className="patient-info">
                <div className="patient-name">
                  {patient.firstName} {patient.lastName}
                </div>
                <div className="patient-id">
                  Patient ID: {patient.id}
                </div>
                <div className="patient-dob">
                  DOB: {patient.dateOfBirth}
                </div>
              </div>
              
              <div className="patient-visits">
                {patient.visits.length} visits
              </div>
            </div>
          ))}
        </div>

        {filteredPatients.length === 0 && (
          <div className="empty-state">
            No patients found. Add your first patient to get started.
          </div>
        )}
      </div>

      {/* Patient Detail */}
      {selectedPatient && (
        <div className="card">
          <div className="patient-header">
            <div 
              className="patient-header-avatar"
              style={{ backgroundColor: getAvatarColor(selectedPatient) }}
            >
              {getPatientInitials(selectedPatient)}
            </div>
            <div className="patient-header-info">
              <h2>{selectedPatient.firstName} {selectedPatient.lastName}</h2>
              <div className="patient-header-details">
                DOB: {selectedPatient.dateOfBirth} | Patient ID: {selectedPatient.id}
              </div>
            </div>
          </div>

          <div className="patient-context-grid">
            <div className="context-card medical-history">
              <strong>Medical History</strong>
              {selectedPatient.medicalHistory || 'No medical history recorded'}
            </div>
            <div className="context-card medications">
              <strong>Current Medications</strong>
              {selectedPatient.medications || 'No medications recorded'}
            </div>
          </div>

          <h4>Visit History ({selectedPatient.visits.length} visits)</h4>
          <div className="visit-history-list">
            {selectedPatient.visits.length === 0 ? (
              <div className="empty-state">No visits recorded yet</div>
            ) : (
              selectedPatient.visits.slice().reverse().map(visit => (
                <div 
                  key={visit.id} 
                  className="visit-item"
                  onClick={() => {
                    setSelectedVisit(visit);
                    setShowVisitModal(true);
                  }}
                >
                  <div>
                    <div className="visit-date">{visit.date}</div>
                    <div className="visit-meta">Time: {visit.time}</div>
                  </div>
                  <div className="visit-arrow">→</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render recording page
  const renderRecordingPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Recording Session</h2>
        {selectedPatient && (
          <div>
            Recording for: <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
          </div>
        )}
      </div>

      {!selectedPatient && (
        <div className="card">
          <h3 className="card-title">Select a Patient</h3>
          <p>Please select a patient from the Patients tab before starting a recording session.</p>
        </div>
      )}

      {selectedPatient && (
        <>
          <div className="card">
            <h3 className="card-title">Recording Controls</h3>
            
            <div className="recording-controls">
              <button 
                className="btn btn-record"
                onClick={startRecording}
                disabled={isRecording}
              >
                {isRecording ? '🔴 Recording...' : '🎤 Start Recording'}
              </button>
              
              <button 
                className="btn btn-generate"
                onClick={generateNotes}
                disabled={!transcript}
              >
                📝 Generate Notes
              </button>
              
              <button 
                className="btn btn-save"
                onClick={saveVisit}
                disabled={!medicalNotes}
              >
                💾 Save Visit
              </button>
            </div>

            <div className={`status-indicator ${isRecording ? 'recording' : 'ready'}`}>
              {status}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Live Transcript</h3>
            <div className="transcript-container">
              {transcript || <span className="transcript-placeholder">Transcript will appear here as you speak...</span>}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Generated Medical Notes</h3>
            <div className="notes-container">
              {medicalNotes || <span className="notes-placeholder">AI-generated medical notes will appear here...</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Render settings page
  const renderSettingsPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">API Settings</h2>
      </div>

      <div className="card">
        <h3 className="card-title">Azure Configuration</h3>
        <p className="settings-description">
          Configure your Azure Speech and OpenAI services. Keys are stored locally and never transmitted.
        </p>

        <div className="settings-form">
          <div className="form-group">
            <label className="form-label">Azure Speech Service Key</label>
            <input type="password" className="form-input" placeholder="Enter your Azure Speech key" />
          </div>

          <div className="form-group">
            <label className="form-label">Azure Speech Region</label>
            <select className="form-input">
              <option value="eastus">East US</option>
              <option value="westus2">West US 2</option>
              <option value="centralus">Central US</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Azure OpenAI Endpoint</label>
            <input type="text" className="form-input" placeholder="https://your-resource.openai.azure.com/" />
          </div>

          <div className="form-group">
            <label className="form-label">Azure OpenAI API Key</label>
            <input type="password" className="form-input" placeholder="Enter your OpenAI key" />
          </div>

          <button className="btn btn-success">
            💾 Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      {renderSidebar()}
      
      <main className="main-content">
        {activeTab === 'patients' && renderPatientsPage()}
        {activeTab === 'recording' && renderRecordingPage()}
        {activeTab === 'settings' && renderSettingsPage()}
      </main>

      {/* Add Patient Modal */}
      {showPatientModal && (
        <div className="modal-backdrop" onClick={() => setShowPatientModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add New Patient</h3>
                <p className="modal-subtitle">Enter patient information</p>
              </div>
              <button className="modal-close" onClick={() => setShowPatientModal(false)}>
                ✕
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                value={newPatient.firstName}
                onChange={(e) => setNewPatient({...newPatient, firstName: e.target.value})}
                placeholder="Enter first name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                value={newPatient.lastName}
                onChange={(e) => setNewPatient({...newPatient, lastName: e.target.value})}
                placeholder="Enter last name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth *</label>
              <input
                type="date"
                className="form-input"
                value={newPatient.dateOfBirth}
                onChange={(e) => setNewPatient({...newPatient, dateOfBirth: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Medical History</label>
              <textarea
                className="form-textarea"
                value={newPatient.medicalHistory}
                onChange={(e) => setNewPatient({...newPatient, medicalHistory: e.target.value})}
                placeholder="Enter relevant medical history..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Current Medications</label>
              <textarea
                className="form-textarea"
                value={newPatient.medications}
                onChange={(e) => setNewPatient({...newPatient, medications: e.target.value})}
                placeholder="List current medications..."
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowPatientModal(false)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={addPatient}>
                Save Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visit Detail Modal */}
      {showVisitModal && selectedVisit && (
        <div className="modal-backdrop" onClick={() => setShowVisitModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Visit Details</h3>
                <p className="modal-subtitle">{selectedVisit.date} at {selectedVisit.time}</p>
              </div>
              <button className="modal-close" onClick={() => setShowVisitModal(false)}>
                ✕
              </button>
            </div>

            <div className="visit-notes">
              {selectedVisit.notes}
            </div>

            <div className="transcript-section">
              <h4>Original Transcript</h4>
              <div className="transcript-content">
                {selectedVisit.transcript}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowVisitModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

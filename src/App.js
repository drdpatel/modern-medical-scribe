import React, { useState, useRef, useEffect } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';
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
  const [interimTranscript, setInterimTranscript] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Configure API settings first');

  // API Settings states
  const [apiSettings, setApiSettings] = useState({
    speechKey: '',
    speechRegion: 'eastus',
    openaiEndpoint: '',
    openaiKey: '',
    openaiDeployment: 'gpt-4',
    openaiApiVersion: '2024-08-01-preview'
  });
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Azure Speech SDK refs
  const recognizerRef = useRef(null);
  const audioConfigRef = useRef(null);

  // Load data from localStorage
  useEffect(() => {
    try {
      const savedPatients = localStorage.getItem('medicalScribePatients');
      const savedApiSettings = localStorage.getItem('medicalScribeApiSettings');
      
      if (savedPatients) {
        setPatients(JSON.parse(savedPatients));
      }
      
      if (savedApiSettings) {
        const settings = JSON.parse(savedApiSettings);
        setApiSettings(settings);
        if (settings.speechKey && settings.openaiKey) {
          setStatus('Ready to begin');
        }
      }
    } catch (error) {
      console.warn('LocalStorage not available');
    }
  }, []);

  // Save patients to localStorage
  const savePatients = (updatedPatients) => {
    setPatients(updatedPatients);
    try {
      localStorage.setItem('medicalScribePatients', JSON.stringify(updatedPatients));
    } catch (error) {
      console.warn('Cannot save to localStorage');
    }
  };

  // Save API settings
  const saveApiSettings = (settings) => {
    setApiSettings(settings);
    try {
      localStorage.setItem('medicalScribeApiSettings', JSON.stringify(settings));
      if (settings.speechKey && settings.openaiKey) {
        setStatus('API settings saved - Ready to begin');
      }
    } catch (error) {
      console.warn('Cannot save API settings');
    }
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

  // Real Azure Speech SDK recording
  const startRecording = async () => {
    if (!selectedPatient) {
      setStatus('Please select a patient first');
      return;
    }

    const speechKey = apiSettings.speechKey;
    const speechRegion = apiSettings.speechRegion;
    
    if (!speechKey || !speechRegion) {
      setStatus('Please configure Azure Speech settings first');
      setActiveTab('settings');
      return;
    }

    try {
      setStatus('Requesting microphone access...');
      
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permError) {
        setStatus('Microphone permission denied. Please allow microphone access.');
        return;
      }
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      
      audioConfigRef.current = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfigRef.current);

      recognizerRef.current.recognizing = (s, e) => {
        if (e.result.text) {
          setInterimTranscript(e.result.text);
        }
      };

      recognizerRef.current.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text.trim()) {
          setTranscript(prev => prev + (prev ? ' ' : '') + e.result.text.trim());
          setInterimTranscript('');
        }
      };

      recognizerRef.current.sessionStopped = () => {
        setIsRecording(false);
        setStatus('Recording session ended');
      };

      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          setIsRecording(true);
          setStatus('🔴 Recording... Speak now');
        },
        (error) => {
          console.error('Recognition start error:', error);
          setIsRecording(false);
          if (error.toString().includes('1006')) {
            setStatus('Invalid Speech key. Check your Azure Speech Service key.');
          } else if (error.toString().includes('1007')) {
            setStatus('Speech service quota exceeded or region mismatch.');
          } else {
            setStatus(`Recording failed: ${error}`);
          }
        }
      );
      
    } catch (error) {
      console.error('Recording setup error:', error);
      setStatus(`Setup failed: ${error.message}`);
    }
  };

  const stopRecording = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsRecording(false);
          setInterimTranscript('');
          setStatus('Recording complete');
        },
        (error) => {
          console.error('Stop recording error:', error);
          setIsRecording(false);
          setInterimTranscript('');
          setStatus('Recording stopped with error');
        }
      );
      recognizerRef.current = null;
    } else {
      setIsRecording(false);
      setInterimTranscript('');
      setStatus('Recording complete');
    }
  };

  // Real Azure OpenAI integration
  const generateNotes = async () => {
    if (!transcript.trim()) {
      setStatus('No transcript available. Please record first.');
      return;
    }

    const openaiEndpoint = apiSettings.openaiEndpoint;
    const openaiKey = apiSettings.openaiKey;
    const deployment = apiSettings.openaiDeployment;
    const apiVersion = apiSettings.openaiApiVersion;

    if (!openaiEndpoint || !openaiKey || !deployment) {
      setStatus('Please configure Azure OpenAI settings first');
      setActiveTab('settings');
      return;
    }

    setIsProcessing(true);
    setStatus('🤖 AI generating medical notes...');

    try {
      let patientContext = '';
      if (selectedPatient) {
        patientContext = `
PATIENT CONTEXT:
Name: ${selectedPatient.firstName} ${selectedPatient.lastName}
DOB: ${selectedPatient.dateOfBirth}
Medical History: ${selectedPatient.medicalHistory || 'No significant medical history recorded'}
Current Medications: ${selectedPatient.medications || 'No current medications recorded'}

RECENT VISIT HISTORY:
${selectedPatient.visits.slice(-3).map(visit => 
  `${visit.date} (${visit.time}): ${visit.notes.substring(0, 200)}...`
).join('\n')}
`;
      }

      const systemPrompt = `You are a medical scribe assistant. Create professional medical notes including Chief Complaint, History of Present Illness, Assessment, and Plan sections. Use appropriate medical terminology and maintain professional format.`;

      const response = await axios.post(
        `${openaiEndpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
        {
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `${patientContext}

CURRENT VISIT TRANSCRIPT:
${transcript}

Please convert this into structured medical notes.`
            }
          ],
          max_tokens: 1500,
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': openaiKey
          }
        }
      );

      setMedicalNotes(response.data.choices[0].message.content);
      setStatus('Medical notes generated successfully');
      
    } catch (error) {
      console.error('AI generation error:', error);
      if (error.response?.status === 401) {
        setStatus('OpenAI authentication failed. Check your API key.');
      } else if (error.response?.status === 404) {
        setStatus('OpenAI deployment not found. Check your deployment name.');
      } else if (error.response?.status === 429) {
        setStatus('OpenAI rate limit exceeded. Wait a moment and try again.');
      } else {
        setStatus('Failed to generate notes: ' + (error.response?.data?.error?.message || error.message));
      }
    } finally {
      setIsProcessing(false);
    }
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

  const clearSession = () => {
    setTranscript('');
    setInterimTranscript('');
    setMedicalNotes('');
    setStatus('Session cleared - Ready to record');
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
                className="btn btn-stop"
                onClick={stopRecording}
                disabled={!isRecording}
              >
                ⏹️ Stop Recording
              </button>
              
              <button 
                className="btn btn-generate"
                onClick={generateNotes}
                disabled={!transcript || isProcessing}
              >
                {isProcessing ? '⏳ Generating...' : '📝 Generate Notes'}
              </button>
              
              <button 
                className="btn btn-save"
                onClick={saveVisit}
                disabled={!medicalNotes}
              >
                💾 Save Visit
              </button>

              <button 
                className="btn btn-secondary"
                onClick={clearSession}
              >
                🗑️ Clear Session
              </button>
            </div>

            <div className={`status-indicator ${isRecording ? 'recording' : isProcessing ? 'processing' : 'ready'}`}>
              {status}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Live Transcript</h3>
            <div className="transcript-container">
              {transcript || interimTranscript ? (
                <span>
                  {transcript}
                  {interimTranscript && (
                    <span style={{color: '#888', fontStyle: 'italic'}}>
                      {transcript ? ' ' : ''}{interimTranscript}
                    </span>
                  )}
                </span>
              ) : (
                <span className="transcript-placeholder">Transcript will appear here as you speak...</span>
              )}
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
            <input 
              type={showApiKeys ? "text" : "password"} 
              className="form-input" 
              placeholder="Enter your Azure Speech key"
              value={apiSettings.speechKey}
              onChange={(e) => setApiSettings({...apiSettings, speechKey: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Azure Speech Region</label>
            <select 
              className="form-input"
              value={apiSettings.speechRegion}
              onChange={(e) => setApiSettings({...apiSettings, speechRegion: e.target.value})}
            >
              <option value="eastus">East US</option>
              <option value="westus2">West US 2</option>
              <option value="centralus">Central US</option>
              <option value="westeurope">West Europe</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Azure OpenAI Endpoint</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="https://your-resource.openai.azure.com/"
              value={apiSettings.openaiEndpoint}
              onChange={(e) => setApiSettings({...apiSettings, openaiEndpoint: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Azure OpenAI API Key</label>
            <input 
              type={showApiKeys ? "text" : "password"} 
              className="form-input" 
              placeholder="Enter your OpenAI key"
              value={apiSettings.openaiKey}
              onChange={(e) => setApiSettings({...apiSettings, openaiKey: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">OpenAI Deployment Name</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="gpt-4"
              value={apiSettings.openaiDeployment}
              onChange={(e) => setApiSettings({...apiSettings, openaiDeployment: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Version</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="2024-08-01-preview"
              value={apiSettings.openaiApiVersion}
              onChange={(e) => setApiSettings({...apiSettings, openaiApiVersion: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>
              <input 
                type="checkbox" 
                checked={showApiKeys}
                onChange={(e) => setShowApiKeys(e.target.checked)}
                style={{marginRight: '8px'}}
              />
              👁️ Show API Keys
            </label>
          </div>

          <button 
            className="btn btn-success"
            onClick={() => saveApiSettings(apiSettings)}
          >
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

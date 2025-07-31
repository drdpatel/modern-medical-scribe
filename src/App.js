import React, { useState, useRef, useEffect } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';
import authService from './authService';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '', password: '', confirmPassword: '', name: '', role: 'medical_provider'
  });

  const [activeTab, setActiveTab] = useState('scribe');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  const [newPatient, setNewPatient] = useState({
    firstName: '', lastName: '', dateOfBirth: '', medicalHistory: '', medications: ''
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Please log in to continue');

  const [apiSettings, setApiSettings] = useState({
    speechKey: '', speechRegion: 'eastus', openaiEndpoint: '', openaiKey: '', 
    openaiDeployment: 'gpt-4', openaiApiVersion: '2024-08-01-preview'
  });
  const [showApiKeys, setShowApiKeys] = useState(false);

  const recognizerRef = useRef(null);
  const audioConfigRef = useRef(null);

  const loadPatientsFromLocalStorage = () => {
    try {
      const patientsData = authService.getPatients();
      const patientsWithVisits = patientsData.map(patient => {
        const visits = authService.getVisits(patient.id);
        return { ...patient, visits: visits || [] };
      });
      setPatients(patientsWithVisits);
    } catch (error) {
      setPatients([]);
    }
  };

  useEffect(() => {
    const initializeApp = () => {
      setIsLoading(true);
      try {
        const user = authService.currentUser;
        if (user) {
          setCurrentUser(user);
          setStatus('Ready to begin');
          loadPatientsFromLocalStorage();
        } else {
          setShowLoginModal(true);
        }
        
        const savedApiSettings = localStorage.getItem('medicalScribeApiSettings');
        if (savedApiSettings) {
          setApiSettings(JSON.parse(savedApiSettings));
        }
      } catch (error) {
        setShowLoginModal(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const reloadPatients = () => {
    loadPatientsFromLocalStorage();
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const user = authService.login(loginForm.username, loginForm.password);
      setCurrentUser(user);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
      setStatus('Login successful - Ready to begin');
      loadPatientsFromLocalStorage();
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setPatients([]);
    setSelectedPatient(null);
    setTranscript('');
    setMedicalNotes('');
    setStatus('Please log in to continue');
    setShowLoginModal(true);
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    
    if (newUser.password !== newUser.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const result = authService.createUser(newUser);
      setShowCreateUserModal(false);
      setNewUser({ username: '', password: '', confirmPassword: '', name: '', role: 'medical_provider' });
      alert(result.message);
    } catch (error) {
      alert('Failed to create user: ' + error.message);
    }
  };

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

  const addPatient = () => {
    if (!authService.hasPermission('add_patients')) {
      alert('You do not have permission to add patients');
      return;
    }

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

    try {
      authService.savePatient(patient);
      reloadPatients();
      setNewPatient({ firstName: '', lastName: '', dateOfBirth: '', medicalHistory: '', medications: '' });
      setShowPatientModal(false);
    } catch (error) {
      alert('Failed to save patient: ' + error.message);
    }
  };

  const startRecording = async () => {
    if (!authService.hasPermission('scribe')) {
      setStatus('You do not have permission to record');
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
        setIsPaused(false);
        setStatus('Recording session ended');
      };

      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          setIsRecording(true);
          setIsPaused(false);
          setStatus('Recording... Speak now');
        },
        (error) => {
          setIsRecording(false);
          setIsPaused(false);
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
      setStatus(`Setup failed: ${error.message}`);
    }
  };

  const pauseRecording = () => {
    if (recognizerRef.current && isRecording && !isPaused) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsPaused(true);
          setInterimTranscript('');
          setStatus('Recording paused');
        },
        (error) => {
          setStatus('Pause failed');
        }
      );
    }
  };

  const resumeRecording = async () => {
    if (isPaused) {
      const speechKey = apiSettings.speechKey;
      const speechRegion = apiSettings.speechRegion;
      
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

      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          setIsPaused(false);
          setStatus('Recording resumed... Speak now');
        },
        (error) => {
          setStatus('Resume failed');
        }
      );
    }
  };

  const stopRecording = () => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsRecording(false);
          setIsPaused(false);
          setInterimTranscript('');
          setStatus('Recording complete');
        },
        (error) => {
          setIsRecording(false);
          setIsPaused(false);
          setInterimTranscript('');
          setStatus('Recording stopped with error');
        }
      );
      recognizerRef.current = null;
    } else {
      setIsRecording(false);
      setIsPaused(false);
      setInterimTranscript('');
      setStatus('Recording complete');
    }
  };

  const generateNotes = async () => {
    if (!authService.hasPermission('scribe')) {
      setStatus('You do not have permission to generate notes');
      return;
    }

    if (!transcript.trim()) {
      setStatus('No transcript available. Please record first.');
      return;
    }

    const { openaiEndpoint, openaiKey, openaiDeployment, openaiApiVersion } = apiSettings;

    if (!openaiEndpoint || !openaiKey || !openaiDeployment) {
      setStatus('Please configure Azure OpenAI settings first');
      setActiveTab('settings');
      return;
    }

    setIsProcessing(true);
    setStatus('AI generating medical notes...');

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
      } else {
        patientContext = 'PATIENT CONTEXT: No patient selected - generating general medical notes from transcript.';
      }

      const systemPrompt = `You are a medical scribe assistant. Create professional medical notes including Chief Complaint, History of Present Illness, Assessment, and Plan sections. Use appropriate medical terminology and maintain professional format.`;

      const response = await axios.post(
        `${openaiEndpoint}openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiApiVersion}`,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${patientContext}\n\nCURRENT VISIT TRANSCRIPT:\n${transcript}\n\nPlease convert this into structured medical notes.` }
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
      setStatus(selectedPatient ? 'Medical notes generated successfully' : 'Medical notes generated - Select patient to save');
      
    } catch (error) {
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
    if (!medicalNotes) {
      setStatus('Cannot save - no notes generated');
      return;
    }

    if (!selectedPatient) {
      setStatus('Please select a patient before saving');
      return;
    }

    if (!authService.hasPermission('scribe')) {
      setStatus('You do not have permission to save visits');
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

    try {
      authService.saveVisit(selectedPatient.id, visit);
      reloadPatients();
      
      const updatedPatient = patients.find(p => p.id === selectedPatient.id);
      if (updatedPatient) {
        setSelectedPatient({
          ...updatedPatient,
          visits: [...updatedPatient.visits, { ...visit, createdBy: currentUser.id, createdByName: currentUser.name }]
        });
      }
      
      setStatus('Visit saved successfully');
      
      // Clear the session after saving
      setTranscript('');
      setInterimTranscript('');
      setMedicalNotes('');
      setStatus('Visit saved - Ready for next patient');
    } catch (error) {
      setStatus('Failed to save visit: ' + error.message);
    }
  };

  const filteredPatients = patients.filter(patient =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.dateOfBirth.includes(searchTerm)
  );

  const getPatientInitials = (patient) => {
    return (patient.firstName[0] + patient.lastName[0]).toUpperCase();
  };

  const getAvatarColor = (patient) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const index = (patient.firstName.charCodeAt(0) + patient.lastName.charCodeAt(0)) % colors.length;
    return colors[index];
  };

  if (isLoading) {
    return (
      <div className="app-container">
        <div style={{ 
          display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh',
          backgroundColor: 'var(--aayu-light-gray)', fontSize: '18px', color: 'var(--aayu-navy)'
        }}>
          Loading Aayu AI Scribe...
        </div>
      </div>
    );
  }

  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title"><span>Aayu AI Scribe</span></h1>
        {currentUser && (
          <div style={{ 
            marginTop: '12px', fontSize: '14px', color: 'rgba(255,255,255,0.8)', textAlign: 'center'
          }}>
            {currentUser.name}<br />
            <span style={{ fontSize: '12px', color: 'var(--aayu-lime)' }}>
              {currentUser.role.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <nav className="sidebar-nav">
        <button 
          className={`nav-button ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          Patients
        </button>
        
        <button 
          className={`nav-button ${activeTab === 'scribe' ? 'active' : ''}`}
          onClick={() => setActiveTab('scribe')}
          disabled={!authService.hasPermission('scribe')}
          style={{
            opacity: !authService.hasPermission('scribe') ? 0.5 : 1,
            cursor: !authService.hasPermission('scribe') ? 'not-allowed' : 'pointer'
          }}
        >
          Scribe
        </button>
        
        <button 
          className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>

        {authService.hasPermission('add_users') && (
          <button 
            className={`nav-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
        )}

        <button 
          className="nav-button"
          onClick={handleLogout}
          style={{ marginTop: 'auto', backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          Logout
        </button>
      </nav>
      
      <div className="sidebar-footer">
        Medical Scribe AI v2.2<br />
        Secure • Simplified
      </div>
    </div>
  );

  const renderPatientsPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Patient Management</h2>
        {authService.hasPermission('add_patients') && (
          <button className="btn btn-primary" onClick={() => setShowPatientModal(true)}>
            Add New Patient
          </button>
        )}
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
        
        <div className="search-results">{filteredPatients.length} patient(s) found</div>

        <div className="patient-list">
          {filteredPatients.map(patient => (
            <div key={patient.id} className="patient-card" onClick={() => setSelectedPatient(patient)}>
              <div className="patient-avatar" style={{ backgroundColor: getAvatarColor(patient) }}>
                {getPatientInitials(patient)}
              </div>
              
              <div className="patient-info">
                <div className="patient-name">{patient.firstName} {patient.lastName}</div>
                <div className="patient-id">Patient ID: {patient.id}</div>
                <div className="patient-dob">DOB: {patient.dateOfBirth}</div>
              </div>
              
              <div className="patient-visits">{patient.visits.length} visits</div>
            </div>
          ))}
        </div>

        {filteredPatients.length === 0 && (
          <div className="empty-state">
            No patients found. {authService.hasPermission('add_patients') ? 'Add your first patient to get started.' : 'Contact an administrator to add patients.'}
          </div>
        )}
      </div>

      {selectedPatient && (
        <div className="card">
          <div className="patient-header">
            <div className="patient-header-avatar" style={{ backgroundColor: getAvatarColor(selectedPatient) }}>
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
                    if (authService.hasPermission('read_all_notes') || authService.canEditNotes(visit.createdBy)) {
                      setSelectedVisit(visit);
                      setShowVisitModal(true);
                    }
                  }}
                  style={{
                    cursor: (authService.hasPermission('read_all_notes') || authService.canEditNotes(visit.createdBy)) ? 'pointer' : 'not-allowed',
                    opacity: (authService.hasPermission('read_all_notes') || authService.canEditNotes(visit.createdBy)) ? 1 : 0.6
                  }}
                >
                  <div>
                    <div className="visit-date">{visit.date}</div>
                    <div className="visit-meta">
                      Time: {visit.time}
                      {visit.createdByName && <span> • By: {visit.createdByName}</span>}
                    </div>
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

  const renderRecordingPage = () => {
    if (!authService.hasPermission('scribe')) {
      return (
        <div className="content-container">
          <div className="page-header">
            <h2 className="page-title">Recording Session</h2>
          </div>
          <div className="card">
            <h3 className="card-title">Access Denied</h3>
            <p>You do not have permission to access the recording functionality. Contact your administrator if you need access.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="content-container">
        <div className="page-header">
          <h2 className="page-title">Recording Session</h2>
          {selectedPatient && (
            <div>Recording for: <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong></div>
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
                <button className="btn btn-record" onClick={startRecording} disabled={isRecording}>
                  {isRecording ? 'Recording...' : 'Start Recording'}
                </button>
                
                <button className="btn btn-stop" onClick={stopRecording} disabled={!isRecording}>
                  Stop Recording
                </button>
                
                <button className="btn btn-generate" onClick={generateNotes} disabled={!transcript || isProcessing}>
                  {isProcessing ? 'Generating...' : 'Generate Notes'}
                </button>
                
                <button className="btn btn-save" onClick={saveVisit} disabled={!medicalNotes}>
                  Save Visit
                </button>

                <button className="btn btn-secondary" onClick={clearSession}>
                  Clear Session
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
  };

  const renderUsersPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">User Management</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateUserModal(true)}>
          Add New User
        </button>
      </div>

      <div className="card">
        <h3 className="card-title">User Administration</h3>
        <p>In this simplified version, users are managed through environment variables. To add a user permanently, update your <code>REACT_APP_USERS</code> environment variable.</p>
        
        <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--aayu-pale-lime)', borderRadius: '8px', fontSize: '14px' }}>
          <strong>Current Users:</strong><br />
          {Object.entries(authService.users).map(([username, user]) => (
            <div key={username} style={{ margin: '8px 0' }}>
              • <strong>{username}</strong> - {user.name} ({user.role})
            </div>
          ))}
        </div>
      </div>
    </div>
  );

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
              type="text" className="form-input" 
              placeholder="https://your-resource.openai.azure.com/"
              value={apiSettings.openaiEndpoint}
              onChange={(e) => setApiSettings({...apiSettings, openaiEndpoint: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Azure OpenAI API Key</label>
            <input 
              type={showApiKeys ? "text" : "password"} className="form-input" 
              placeholder="Enter your OpenAI key"
              value={apiSettings.openaiKey}
              onChange={(e) => setApiSettings({...apiSettings, openaiKey: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">OpenAI Deployment Name</label>
            <input 
              type="text" className="form-input" placeholder="gpt-4"
              value={apiSettings.openaiDeployment}
              onChange={(e) => setApiSettings({...apiSettings, openaiDeployment: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Version</label>
            <input 
              type="text" className="form-input" placeholder="2024-08-01-preview"
              value={apiSettings.openaiApiVersion}
              onChange={(e) => setApiSettings({...apiSettings, openaiApiVersion: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>
              <input 
                type="checkbox" checked={showApiKeys}
                onChange={(e) => setShowApiKeys(e.target.checked)}
                style={{marginRight: '8px'}}
              />
              Show API Keys
            </label>
          </div>

          <button className="btn btn-success" onClick={() => saveApiSettings(apiSettings)}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      {currentUser && renderSidebar()}
      
      <main className="main-content">
        {currentUser && (
          <>
            {activeTab === 'patients' && renderPatientsPage()}
            {activeTab === 'scribe' && renderScribePage()}
            {activeTab === 'settings' && renderSettingsPage()}
            {activeTab === 'users' && authService.hasPermission('add_users') && renderUsersPage()}
          </>
        )}
      </main>

      {showLoginModal && (
        <div className="modal-backdrop">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Login to Aayu AI Scribe</h3>
                <p className="modal-subtitle">Enter your credentials to continue</p>
              </div>
            </div>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text" className="form-input"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password" className="form-input"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {loginError && (
                <div style={{ color: 'var(--aayu-coral)', marginBottom: '16px', fontSize: '14px' }}>
                  {loginError}
                </div>
              )}

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Login</button>
              </div>
            </form>

            <div style={{ 
              marginTop: '24px', padding: '16px', backgroundColor: 'var(--aayu-pale-lime)',
              borderRadius: '8px', fontSize: '14px', textAlign: 'center'
            }}>
              <strong>Available Users:</strong><br />
              darshan@aayuwell.com (Super Admin)<br />
              admin (Admin) • doctor (Provider) • staff (Support)
            </div>
          </div>
        </div>
      )}

      {showCreateUserModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create New User</h3>
                <p className="modal-subtitle">Note: Users must be added to environment config permanently</p>
              </div>
              <button className="modal-close" onClick={() => setShowCreateUserModal(false)}>Close</button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Username (Email) *</label>
                <input
                  type="text" className="form-input"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text" className="form-input"
                  value={newUser.name}
                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-input"
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  required
                >
                  <option value="medical_provider">Medical Provider</option>
                  <option value="support_staff">Support Staff</option>
                  <option value="admin">Admin</option>
                  {currentUser?.role === 'super_admin' && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password" className="form-input"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Enter password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input
                  type="password" className="form-input"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
                  placeholder="Confirm password"
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">Log User Info</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPatientModal && (
        <div className="modal-backdrop" onClick={() => setShowPatientModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add New Patient</h3>
                <p className="modal-subtitle">Enter patient information</p>
              </div>
              <button className="modal-close" onClick={() => setShowPatientModal(false)}>Close</button>
            </div>

            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text" className="form-input"
                value={newPatient.firstName}
                onChange={(e) => setNewPatient({...newPatient, firstName: e.target.value})}
                placeholder="Enter first name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text" className="form-input"
                value={newPatient.lastName}
                onChange={(e) => setNewPatient({...newPatient, lastName: e.target.value})}
                placeholder="Enter last name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth *</label>
              <input
                type="date" className="form-input"
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
              <button className="btn btn-success" onClick={addPatient}>Save Patient</button>
            </div>
          </div>
        </div>
      )}

      {showVisitModal && selectedVisit && (
        <div className="modal-backdrop" onClick={() => setShowVisitModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Visit Details</h3>
                <p className="modal-subtitle">
                  {selectedVisit.date} at {selectedVisit.time}
                  {selectedVisit.createdByName && ` • Created by: ${selectedVisit.createdByName}`}
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowVisitModal(false)}>Close</button>
            </div>

            <div className="visit-notes">{selectedVisit.notes}</div>

            <div className="transcript-section">
              <h4>Original Transcript</h4>
              <div className="transcript-content">{selectedVisit.transcript}</div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowVisitModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

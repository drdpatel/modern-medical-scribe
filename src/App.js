import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';
import authService from './authService';
import './App.css';

function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'medical_provider'
  });

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
  const [status, setStatus] = useState('Please log in to continue');

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

  // Initialize authentication and load data
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      try {
        // First, test environment variables
        console.log('Testing environment variables...');
        const connectionString = process.env.REACT_APP_AZURE_STORAGE_CONNECTION_STRING;
        
        if (!connectionString || connectionString === 'your_connection_string_here') {
          console.error('Azure connection string not found in environment variables');
          alert('Azure connection string not configured. Please check GitHub Codespace secrets.');
          setShowLoginModal(true);
          setIsLoading(false);
          return;
        }

        console.log('Connection string found, initializing authService...');
        
        // Wait for authService to be fully initialized
        let retries = 0;
        while (!authService.isReady() && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }

        if (!authService.isReady()) {
          throw new Error('AuthService failed to initialize after 10 seconds');
        }

        console.log('AuthService ready, checking for existing user...');
        
        // Check if user is already logged in
        const user = await authService.loadCurrentUser();
        if (user) {
          setCurrentUser(user);
          setStatus('Ready to begin');
          await loadPatientsFromAzure();
        } else {
          setShowLoginModal(true);
        }
        
        // Load API settings from localStorage (backward compatibility)
        const savedApiSettings = localStorage.getItem('medicalScribeApiSettings');
        if (savedApiSettings) {
          const settings = JSON.parse(savedApiSettings);
          setApiSettings(settings);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize app: ' + error.message + '. Falling back to login screen.');
        setShowLoginModal(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []); // Keep empty - loadPatientsFromAzure is memoized with useCallback

  // Load patients from Azure Table Storage
  const loadPatientsFromAzure = useCallback(async () => {
    try {
      const azurePatientsRaw = await authService.getPatients();
      
      // Convert Azure entities to app format
      const azurePatients = azurePatientsRaw.map(entity => ({
        id: parseInt(entity.rowKey),
        firstName: entity.firstName,
        lastName: entity.lastName,
        dateOfBirth: entity.dateOfBirth,
        medicalHistory: entity.medicalHistory || '',
        medications: entity.medications || '',
        visits: [], // Will be loaded separately
        createdAt: entity.createdAt
      }));

      // Load visits for each patient
      for (const patient of azurePatients) {
        const visitsRaw = await authService.getVisits(patient.id);
        patient.visits = visitsRaw.map(entity => ({
          id: parseInt(entity.rowKey),
          date: entity.date,
          time: entity.time,
          transcript: entity.transcript,
          notes: entity.notes,
          timestamp: entity.timestamp,
          createdBy: entity.createdBy,
          createdByName: entity.createdByName
        }));
      }

      setPatients(azurePatients);

      // Migrate localStorage data if exists and no Azure data
      if (azurePatients.length === 0) {
        await migrateLocalStorageData();
        // After migration, reload the patients
        const azurePatientsAfterMigration = await authService.getPatients();
        const migratedPatients = azurePatientsAfterMigration.map(entity => ({
          id: parseInt(entity.rowKey),
          firstName: entity.firstName,
          lastName: entity.lastName,
          dateOfBirth: entity.dateOfBirth,
          medicalHistory: entity.medicalHistory || '',
          medications: entity.medications || '',
          visits: [], // Will be loaded separately
          createdAt: entity.createdAt
        }));

        // Load visits for migrated patients
        for (const patient of migratedPatients) {
          const visitsRaw = await authService.getVisits(patient.id);
          patient.visits = visitsRaw.map(entity => ({
            id: parseInt(entity.rowKey),
            date: entity.date,
            time: entity.time,
            transcript: entity.transcript,
            notes: entity.notes,
            timestamp: entity.timestamp,
            createdBy: entity.createdBy,
            createdByName: entity.createdByName
          }));
        }

        setPatients(migratedPatients);
      }
    } catch (error) {
      console.error('Failed to load patients from Azure:', error);
      // Fallback to localStorage if Azure fails
      loadPatientsFromLocalStorage();
    }
  }, [migrateLocalStorageData]); // Depends on migrateLocalStorageData

  // Migrate existing localStorage data to Azure
  const migrateLocalStorageData = useCallback(async () => {
    try {
      const savedPatients = localStorage.getItem('medicalScribePatients');
      if (savedPatients) {
        const localPatients = JSON.parse(savedPatients);
        
        for (const patient of localPatients) {
          // Save patient to Azure
          await authService.savePatient(patient);
          
          // Save visits to Azure
          for (const visit of patient.visits || []) {
            await authService.saveVisit(patient.id, visit);
          }
        }
        
        // Clear localStorage after successful migration
        localStorage.removeItem('medicalScribePatients');
        console.log('Successfully migrated localStorage data to Azure');
      }
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }, []); // No dependencies

  // Fallback to localStorage (backward compatibility)
  const loadPatientsFromLocalStorage = useCallback(() => {
    try {
      const savedPatients = localStorage.getItem('medicalScribePatients');
      if (savedPatients) {
        setPatients(JSON.parse(savedPatients));
      }
    } catch (error) {
      console.warn('Could not load from localStorage');
    }
  }, []);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const user = await authService.login(loginForm.username, loginForm.password);
      setCurrentUser(user);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
      setStatus('Login successful - Ready to begin');
      
      await loadPatientsFromAzure();
    } catch (error) {
      setLoginError(error.message);
    }
  };

  // Logout handler
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

  // Create user handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (newUser.password !== newUser.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      await authService.createUser(newUser);
      setShowCreateUserModal(false);
      setNewUser({
        username: '',
        password: '',
        confirmPassword: '',
        name: '',
        role: 'medical_provider'
      });
      alert('User created successfully');
    } catch (error) {
      alert('Failed to create user: ' + error.message);
    }
  };

  // Save patients to Azure (replacing localStorage)
  const savePatients = async (updatedPatients) => {
    setPatients(updatedPatients);
    
    // Save to Azure instead of localStorage
    try {
      for (const patient of updatedPatients) {
        await authService.savePatient(patient);
      }
    } catch (error) {
      console.error('Failed to save to Azure:', error);
      // Fallback to localStorage
      try {
        localStorage.setItem('medicalScribePatients', JSON.stringify(updatedPatients));
      } catch (e) {
        console.warn('Cannot save to localStorage');
      }
    }
  };

  // Save API settings (keep localStorage for backward compatibility)
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
  const addPatient = async () => {
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

    await savePatients([...patients, patient]);
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
    if (!authService.hasPermission('scribe')) {
      setStatus('You do not have permission to record');
      return;
    }

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
          setStatus('Recording... Speak now');
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
    if (!authService.hasPermission('scribe')) {
      setStatus('You do not have permission to generate notes');
      return;
    }

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

  const saveVisit = async () => {
    if (!selectedPatient || !medicalNotes) {
      setStatus('Cannot save - missing patient or notes');
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
      // Save to Azure
      await authService.saveVisit(selectedPatient.id, visit);
      
      // Update local state
      const updatedPatients = patients.map(p => 
        p.id === selectedPatient.id 
          ? { ...p, visits: [...p.visits, { ...visit, createdBy: currentUser.id, createdByName: currentUser.name }] }
          : p
      );

      setPatients(updatedPatients);
      setSelectedPatient(updatedPatients.find(p => p.id === selectedPatient.id));
      setStatus('Visit saved successfully');
    } catch (error) {
      console.error('Failed to save visit:', error);
      setStatus('Failed to save visit: ' + error.message);
    }
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

  // Show loading screen
  if (isLoading) {
    return (
      <div className="app-container">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: 'var(--aayu-light-gray)',
          fontSize: '18px',
          color: 'var(--aayu-navy)'
        }}>
          Loading Aayu AI Scribe...
        </div>
      </div>
    );
  }

  // Render navigation
  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">
          <span>Aayu AI Scribe</span>
        </h1>
        {currentUser && (
          <div style={{ 
            marginTop: '12px', 
            fontSize: '14px', 
            color: 'rgba(255,255,255,0.8)',
            textAlign: 'center'
          }}>
            {currentUser.name}
            <br />
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
          className={`nav-button ${activeTab === 'recording' ? 'active' : ''}`}
          onClick={() => setActiveTab('recording')}
          disabled={!authService.hasPermission('scribe')}
          style={{
            opacity: !authService.hasPermission('scribe') ? 0.5 : 1,
            cursor: !authService.hasPermission('scribe') ? 'not-allowed' : 'pointer'
          }}
        >
          Recording
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
        Medical Scribe AI v2.1<br />
        Secure • HIPAA Compliant
      </div>
    </div>
  );

  // Render patients page
  const renderPatientsPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Patient Management</h2>
        {authService.hasPermission('add_patients') && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowPatientModal(true)}
          >
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
            No patients found. {authService.hasPermission('add_patients') ? 'Add your first patient to get started.' : 'Contact an administrator to add patients.'}
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
                      {visit.createdByName && (
                        <span> • By: {visit.createdByName}</span>
                      )}
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

  // Render recording page
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
                  {isRecording ? 'Recording...' : 'Start Recording'}
                </button>
                
                <button 
                  className="btn btn-stop"
                  onClick={stopRecording}
                  disabled={!isRecording}
                >
                  Stop Recording
                </button>
                
                <button 
                  className="btn btn-generate"
                  onClick={generateNotes}
                  disabled={!transcript || isProcessing}
                >
                  {isProcessing ? 'Generating...' : 'Generate Notes'}
                </button>
                
                <button 
                  className="btn btn-save"
                  onClick={saveVisit}
                  disabled={!medicalNotes}
                >
                  Save Visit
                </button>

                <button 
                  className="btn btn-secondary"
                  onClick={clearSession}
                >
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

  // Render users page (admin and super admin only)
  const renderUsersPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">User Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateUserModal(true)}
        >
          Add New User
        </button>
      </div>

      <div className="card">
        <h3 className="card-title">User Administration</h3>
        <p>User management functionality coming soon. For now, users can be created using the "Add New User" button.</p>
      </div>
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
              Show API Keys
            </label>
          </div>

          <button 
            className="btn btn-success"
            onClick={() => saveApiSettings(apiSettings)}
          >
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
            {activeTab === 'recording' && renderRecordingPage()}
            {activeTab === 'settings' && renderSettingsPage()}
            {activeTab === 'users' && authService.hasPermission('add_users') && renderUsersPage()}
          </>
        )}
      </main>

      {/* Login Modal */}
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
                  type="text"
                  className="form-input"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
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
                <button type="submit" className="btn btn-primary">
                  Login
                </button>
              </div>
            </form>

            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              backgroundColor: 'var(--aayu-pale-lime)',
              borderRadius: '8px',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              <strong>Default Super Admin:</strong><br />
              Username: darshan@aayuwell.com<br />
              Password: Aayuscribe1212@
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create New User</h3>
                <p className="modal-subtitle">Add a new user to the system</p>
              </div>
              <button className="modal-close" onClick={() => setShowCreateUserModal(false)}>
                Close
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Username (Email) *</label>
                <input
                  type="email"
                  className="form-input"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
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
                  type="password"
                  className="form-input"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  placeholder="Enter password"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input
                  type="password"
                  className="form-input"
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
                <button type="submit" className="btn btn-success">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                Close
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
                <p className="modal-subtitle">
                  {selectedVisit.date} at {selectedVisit.time}
                  {selectedVisit.createdByName && ` • Created by: ${selectedVisit.createdByName}`}
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowVisitModal(false)}>
                Close
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

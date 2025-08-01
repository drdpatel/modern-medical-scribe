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
    username: '', password: '', confirmPassword: '', name: '', role: 'medical_provider'
  });

  // Navigation and patient states
  const [activeTab, setActiveTab] = useState('scribe');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  // New patient form state
  const [newPatient, setNewPatient] = useState({
    firstName: '', lastName: '', dateOfBirth: '', medicalHistory: '', medications: ''
  });

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Please log in to continue');

  // API settings states
  const [apiSettings, setApiSettings] = useState({
    speechKey: '', 
    speechRegion: 'eastus', 
    openaiEndpoint: '', 
    openaiKey: '', 
    openaiDeployment: 'gpt-4', 
    openaiApiVersion: '2024-08-01-preview'
  });
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Training states
  const [trainingData, setTrainingData] = useState({
    specialty: 'internal_medicine',
    noteType: 'progress_note',
    baselineNotes: [],
    customTemplates: {}
  });
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [uploadedNoteText, setUploadedNoteText] = useState('');

  // Speech recognition refs
  const recognizerRef = useRef(null);
  const audioConfigRef = useRef(null);

  // Medical specialties and their common note types
  const medicalSpecialties = {
    internal_medicine: {
      name: 'Internal Medicine',
      noteTypes: {
        progress_note: 'Progress Note',
        history_physical: 'History & Physical',
        consultation: 'Consultation',
        discharge_summary: 'Discharge Summary',
        procedure_note: 'Procedure Note'
      }
    },
    cardiology: {
      name: 'Cardiology',
      noteTypes: {
        echo_interpretation: 'Echo Interpretation',
        cardiac_cath: 'Cardiac Catheterization',
        stress_test: 'Stress Test',
        ep_study: 'EP Study',
        consultation: 'Cardiology Consultation'
      }
    },
    emergency_medicine: {
      name: 'Emergency Medicine',
      noteTypes: {
        ed_note: 'Emergency Department Note',
        trauma_note: 'Trauma Note',
        procedure_note: 'Procedure Note',
        discharge_note: 'ED Discharge Note'
      }
    },
    surgery: {
      name: 'Surgery',
      noteTypes: {
        operative_note: 'Operative Note',
        preop_note: 'Pre-operative Note',
        postop_note: 'Post-operative Note',
        consultation: 'Surgical Consultation'
      }
    },
    psychiatry: {
      name: 'Psychiatry',
      noteTypes: {
        psych_eval: 'Psychiatric Evaluation',
        therapy_note: 'Therapy Note',
        medication_management: 'Medication Management',
        crisis_intervention: 'Crisis Intervention'
      }
    },
    pediatrics: {
      name: 'Pediatrics',
      noteTypes: {
        well_child: 'Well Child Visit',
        sick_visit: 'Sick Visit',
        developmental: 'Developmental Assessment',
        vaccination: 'Vaccination Visit'
      }
    }
  };

  // Text cleaning function to remove markdown formatting
  const cleanMarkdownFormatting = useCallback((text) => {
    if (!text) return text;
    
    return text
      // Remove bold **text** and __text__
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      // Remove italic *text* and _text_
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      // Remove strikethrough ~~text~~
      .replace(/~~(.*?)~~/g, '$1')
      // Remove code blocks ```text```
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code `text`
      .replace(/`(.*?)`/g, '$1')
      // Remove headers #, ##, ###, etc.
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bullet points - and *
      .replace(/^[\s]*[-*+]\s+/gm, '• ')
      // Remove numbered lists
      .replace(/^\d+\.\s+/gm, '')
      // Clean up extra whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }, []);

  // Load training data from localStorage
  const loadTrainingData = useCallback(() => {
    try {
      const saved = localStorage.getItem('medicalScribeTraining');
      if (saved) {
        setTrainingData(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
    }
  }, []);

  // Save training data to localStorage
  const saveTrainingData = useCallback((data) => {
    try {
      localStorage.setItem('medicalScribeTraining', JSON.stringify(data));
      setTrainingData(data);
    } catch (error) {
      console.error('Failed to save training data:', error);
    }
  }, []);

  // Add baseline note
  const addBaselineNote = useCallback(() => {
    if (!uploadedNoteText.trim()) {
      alert('Please enter a note before adding it to baseline');
      return;
    }

    const newNote = {
      id: Date.now(),
      content: cleanMarkdownFormatting(uploadedNoteText.trim()),
      specialty: trainingData.specialty,
      noteType: trainingData.noteType,
      dateAdded: new Date().toISOString(),
      addedBy: currentUser?.name || 'Unknown'
    };

    const updatedData = {
      ...trainingData,
      baselineNotes: [...trainingData.baselineNotes, newNote].slice(-5) // Keep only last 5 notes
    };

    saveTrainingData(updatedData);
    setUploadedNoteText('');
    alert('Baseline note added successfully!');
  }, [uploadedNoteText, trainingData, currentUser, saveTrainingData, cleanMarkdownFormatting]);

  // Remove baseline note
  const removeBaselineNote = useCallback((noteId) => {
    const updatedData = {
      ...trainingData,
      baselineNotes: trainingData.baselineNotes.filter(note => note.id !== noteId)
    };
    saveTrainingData(updatedData);
  }, [trainingData, saveTrainingData]);

 Use the baseline examples as style guides for this provider's preferences.`;
  }, [trainingData]);;

  // Load patients from localStorage with better error handling
  const loadPatientsFromLocalStorage = useCallback(() => {
    try {
      console.log('Loading patients from localStorage...');
      const patientsData = authService.getPatients();
      console.log('Raw patients data:', patientsData);
      
      const patientsWithVisits = patientsData.map(patient => {
        try {
          const visits = authService.getVisits(patient.id);
          return { ...patient, visits: visits || [] };
        } catch (visitError) {
          console.error(`Error loading visits for patient ${patient.id}:`, visitError);
          return { ...patient, visits: [] };
        }
      });
      
      console.log('Processed patients with visits:', patientsWithVisits);
      setPatients(patientsWithVisits);
    } catch (error) {
      console.error('Failed to load patients:', error);
      setPatients([]);
      setStatus('Warning: Could not load patient data');
    }
  }, []);

  // Reload patients helper
  const reloadPatients = useCallback(() => {
    loadPatientsFromLocalStorage();
  }, [loadPatientsFromLocalStorage]);

  // Initialize app
  useEffect(() => {
    const initializeApp = () => {
      setIsLoading(true);
      try {
        const user = authService.currentUser;
        if (user) {
          setCurrentUser(user);
          setStatus('Ready to begin');
          loadPatientsFromLocalStorage();
          loadTrainingData();
        } else {
          setShowLoginModal(true);
        }
        
        const savedApiSettings = localStorage.getItem('medicalScribeApiSettings');
        if (savedApiSettings) {
          setApiSettings(JSON.parse(savedApiSettings));
        }
      } catch (error) {
        console.error('App initialization error:', error);
        setShowLoginModal(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [loadPatientsFromLocalStorage, loadTrainingData]);

  // Authentication handlers
  const handleLogin = useCallback((e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const user = authService.login(loginForm.username, loginForm.password);
      setCurrentUser(user);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
      setStatus('Login successful - Ready to begin');
      loadPatientsFromLocalStorage();
      loadTrainingData();
    } catch (error) {
      setLoginError(error.message);
    }
  }, [loginForm, loadPatientsFromLocalStorage, loadTrainingData]);

  const handleLogout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
    setPatients([]);
    setSelectedPatient(null);
    setTranscript('');
    setMedicalNotes('');
    setStatus('Please log in to continue');
    setShowLoginModal(true);
  }, []);

  const handleCreateUser = useCallback((e) => {
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
  }, [newUser]);

  // API settings handler
  const saveApiSettings = useCallback((settings) => {
    setApiSettings(settings);
    try {
      localStorage.setItem('medicalScribeApiSettings', JSON.stringify(settings));
      if (settings.speechKey && settings.openaiKey) {
        setStatus('API settings saved - Ready to begin');
      }
    } catch (error) {
      console.warn('Cannot save API settings:', error);
    }
  }, []);

  // Patient management
  const addPatient = useCallback(() => {
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
  }, [newPatient, reloadPatients]);

  // Recording functions
  const startRecording = useCallback(async () => {
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
  }, [apiSettings.speechKey, apiSettings.speechRegion]);

  const pauseRecording = useCallback(() => {
    if (recognizerRef.current && isRecording && !isPaused) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsPaused(true);
          setInterimTranscript('');
          setStatus('Recording paused');
        },
        (error) => {
          console.error('Pause failed:', error);
          setStatus('Pause failed');
        }
      );
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(async () => {
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
          console.error('Resume failed:', error);
          setStatus('Resume failed');
        }
      );
    }
  }, [isPaused, apiSettings.speechKey, apiSettings.speechRegion]);

  const stopRecording = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsRecording(false);
          setIsPaused(false);
          setInterimTranscript('');
          setStatus('Recording complete');
        },
        (error) => {
          console.error('Stop recording error:', error);
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
  }, []);

  // AI note generation with training data
  const generateNotes = useCallback(async () => {
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

      const systemPrompt = generateSpecialtyPrompt();

      // Fix API endpoint concatenation
      const endpoint = openaiEndpoint.endsWith('/') ? openaiEndpoint : openaiEndpoint + '/';
      const apiUrl = `${endpoint}openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiApiVersion}`;
      
      console.log('Making OpenAI request to:', apiUrl);
      console.log('Using deployment:', openaiDeployment);
      console.log('Specialty config:', medicalSpecialties[trainingData.specialty].name, '-', medicalSpecialties[trainingData.specialty].noteTypes[trainingData.noteType]);

      const response = await axios.post(
        apiUrl,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${patientContext}\n\nCURRENT VISIT TRANSCRIPT:\n${transcript}\n\nPlease convert this into a structured ${medicalSpecialties[trainingData.specialty].noteTypes[trainingData.noteType]} following the provider's style from the baseline examples.` }
          ],
          max_tokens: 2000,
          temperature: 0.1,  // Lower temperature for more consistent medical documentation
          top_p: 0.9,
          frequency_penalty: 0.1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': openaiKey
          },
          timeout: 30000  // 30 second timeout
        }
      );

      console.log('OpenAI response received:', response.status);

      // Clean the generated notes more thoroughly
      const rawNotes = response.data.choices[0].message.content;
      console.log('Raw notes before cleaning:', rawNotes.substring(0, 200) + '...');
      
      const cleanedNotes = cleanMarkdownFormatting(rawNotes);
      console.log('Notes after cleaning:', cleanedNotes.substring(0, 200) + '...');
      
      setMedicalNotes(cleanedNotes);
      setStatus(selectedPatient ? 'Medical notes generated successfully' : 'Medical notes generated - Select patient to save');
      
    } catch (error) {
      console.error('AI generation error:', error);
      
      if (error.code === 'ECONNABORTED') {
        setStatus('Request timed out. Please try again.');
      } else if (error.response?.status === 401) {
        setStatus('OpenAI authentication failed. Check your API key.');
      } else if (error.response?.status === 404) {
        setStatus('OpenAI deployment not found. Check your deployment name and endpoint.');
      } else if (error.response?.status === 429) {
        setStatus('OpenAI rate limit exceeded. Wait a moment and try again.');
      } else if (error.response?.status === 400) {
        setStatus('Invalid request. Check your OpenAI settings and try again.');
      } else if (error.response?.data?.error?.message) {
        setStatus('Failed to generate notes: ' + error.response.data.error.message);
      } else {
        setStatus('Failed to generate notes: ' + error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, selectedPatient, apiSettings, trainingData, generateSpecialtyPrompt, cleanMarkdownFormatting]);

  // Save visit
  const saveVisit = useCallback(() => {
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
      specialty: trainingData.specialty,
      noteType: trainingData.noteType,
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
      console.error('Save visit error:', error);
      setStatus('Failed to save visit: ' + error.message);
    }
  }, [medicalNotes, selectedPatient, transcript, currentUser, patients, reloadPatients, trainingData]);

  // Utility functions
  const filteredPatients = patients.filter(patient =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.dateOfBirth.includes(searchTerm)
  );

  const getPatientInitials = useCallback((patient) => {
    return (patient.firstName[0] + patient.lastName[0]).toUpperCase();
  }, []);

  const getAvatarColor = useCallback((patient) => {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    const index = (patient.firstName.charCodeAt(0) + patient.lastName.charCodeAt(0)) % colors.length;
    return colors[index];
  }, []);

  // Handle patient selection with proper guards
  const handlePatientSelect = useCallback((patientId) => {
    console.log('Selecting patient:', patientId);
    
    if (!patientId || patientId === '') { 
      setSelectedPatient(null); 
      return; 
    }
    
    const parsedId = parseInt(patientId);
    if (isNaN(parsedId)) {
      console.error('Invalid patient ID:', patientId);
      setSelectedPatient(null);
      return;
    }
    
    const patient = patients.find(p => p.id === parsedId);
    console.log('Found patient:', patient);
    setSelectedPatient(patient || null);
  }, [patients]);

  // Loading screen
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

  // Sidebar component
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
          className={`nav-button ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
          disabled={!authService.hasPermission('scribe')}
          style={{
            opacity: !authService.hasPermission('scribe') ? 0.5 : 1,
            cursor: !authService.hasPermission('scribe') ? 'not-allowed' : 'pointer'
          }}
        >
          Training
        </button>

        <button 
          className={`nav-button ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          Patients
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
        Medical Scribe AI v2.2
        <br />
        Secure • Simplified
      </div>
    </div>
  );

  // Training page component
  const renderTrainingPage = () => {
    if (!authService.hasPermission('scribe')) {
      return (
        <div className="content-container">
          <div className="page-header">
            <h2 className="page-title">AI Training</h2>
          </div>
          <div className="card">
            <h3 className="card-title">Access Denied</h3>
            <p>You do not have permission to access the training functionality. Contact your administrator if you need access.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="content-container">
        <div className="page-header">
          <h2 className="page-title">AI Training Center</h2>
        </div>

        {/* Current Configuration */}
        <div className="card">
          <h3 className="card-title">Current Training Configuration</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label className="form-label">Medical Specialty</label>
              <select 
                className="form-input"
                value={trainingData.specialty}
                onChange={(e) => {
                  const newData = { ...trainingData, specialty: e.target.value, noteType: Object.keys(medicalSpecialties[e.target.value].noteTypes)[0] };
                  saveTrainingData(newData);
                }}
              >
                {Object.entries(medicalSpecialties).map(([key, specialty]) => (
                  <option key={key} value={key}>{specialty.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Note Type</label>
              <select 
                className="form-input"
                value={trainingData.noteType}
                onChange={(e) => {
                  const newData = { ...trainingData, noteType: e.target.value };
                  saveTrainingData(newData);
                }}
              >
                {Object.entries(medicalSpecialties[trainingData.specialty].noteTypes).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ 
            padding: '16px', 
            backgroundColor: 'var(--aayu-pale-lime)', 
            borderRadius: '8px',
            border: '2px solid var(--aayu-lime)',
            fontSize: '14px'
          }}>
            <strong>Current Settings:</strong> {medicalSpecialties[trainingData.specialty].name} - {medicalSpecialties[trainingData.specialty].noteTypes[trainingData.noteType]}
            <br />
            <strong>Baseline Notes:</strong> {trainingData.baselineNotes.length} uploaded
          </div>
        </div>

        {/* Add Baseline Note */}
        <div className="card">
          <h3 className="card-title">Add Baseline Note</h3>
          <p style={{ color: 'var(--aayu-gray)', marginBottom: '16px' }}>
            Upload examples of your preferred note style. The AI will learn from these to match your documentation preferences.
          </p>

          <div className="form-group">
            <label className="form-label">Paste Previous Note (up to 5 notes stored)</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '200px' }}
              value={uploadedNoteText}
              onChange={(e) => setUploadedNoteText(e.target.value)}
              placeholder={`Paste a ${medicalSpecialties[trainingData.specialty].noteTypes[trainingData.noteType]} here...

Example:
CHIEF COMPLAINT: Follow-up visit for hypertension

HISTORY OF PRESENT ILLNESS:
Mr. Smith is a 55-year-old male with a history of hypertension...

etc.`}
            />
          </div>

          <button 
            className="btn btn-success"
            onClick={addBaselineNote}
            disabled={!uploadedNoteText.trim()}
          >
            Add to Baseline
          </button>
        </div>

        {/* Current Baseline Notes */}
        <div className="card">
          <h3 className="card-title">Current Baseline Notes ({trainingData.baselineNotes.length}/5)</h3>
          
          {trainingData.baselineNotes.length === 0 ? (
            <div className="empty-state">
              No baseline notes uploaded yet. Add your first example note above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {trainingData.baselineNotes.map((note, index) => (
                <div key={note.id} style={{ 
                  border: '2px solid var(--aayu-navy)', 
                  borderRadius: '8px', 
                  padding: '16px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div>
                      <strong>Note #{index + 1}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--aayu-gray)' }}>
                        {medicalSpecialties[note.specialty]?.name} - {medicalSpecialties[note.specialty]?.noteTypes[note.noteType]}
                        <br />
                        Added: {new Date(note.dateAdded).toLocaleDateString()} by {note.addedBy}
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                      onClick={() => removeBaselineNote(note.id)}
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div style={{ 
                    backgroundColor: 'var(--aayu-light-gray)', 
                    padding: '12px', 
                    borderRadius: '4px',
                    fontSize: '12px',
                    maxHeight: '150px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace'
                  }}>
                    {note.content.substring(0, 500)}
                    {note.content.length > 500 && '...'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training Tips */}
        <div className="card">
          <h3 className="card-title">Training Tips</h3>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            <p><strong>Best Practices:</strong></p>
            <div style={{ marginLeft: '20px' }}>
              - Upload 3-5 example notes that represent your ideal documentation style<br />
              - Use notes from the same specialty and note type you'll be dictating<br />
              - Include complete notes with all sections you typically use<br />
              - Remove any patient-specific information before uploading<br />
              - Update baseline notes periodically as your preferences evolve
            </div>
            
            <p style={{ marginTop: '16px' }}><strong>Note Processing:</strong></p>
            <div style={{ marginLeft: '20px' }}>
              - The AI automatically removes markdown formatting (**, *, _, etc.)<br />
              - Only plain text formatting is preserved in generated notes<br />
              - Specialty-specific sections and terminology are emphasized<br />
              - Your writing style and structure preferences are learned from examples
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Scribe page component (updated with training info)
  const renderScribePage = () => {
    if (!authService.hasPermission('scribe')) {
      return (
        <div className="content-container">
          <div className="page-header">
            <h2 className="page-title">Medical Scribe</h2>
          </div>
          <div className="card">
            <h3 className="card-title">Access Denied</h3>
            <p>You do not have permission to access the scribe functionality. Contact your administrator if you need access.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="content-container">
        <div className="page-header">
          <h2 className="page-title">Medical Scribe</h2>
        </div>

        {/* Training Status */}
        <div className="card">
          <h3 className="card-title">AI Configuration</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'var(--aayu-pale-purple)', 
              borderRadius: '8px',
              border: '2px solid var(--aayu-purple)'
            }}>
              <strong>Specialty:</strong><br />
              {medicalSpecialties[trainingData.specialty].name}
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'var(--aayu-pale-lime)', 
              borderRadius: '8px',
              border: '2px solid var(--aayu-lime)'
            }}>
              <strong>Note Type:</strong><br />
              {medicalSpecialties[trainingData.specialty].noteTypes[trainingData.noteType]}
            </div>
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'rgba(63, 81, 181, 0.1)', 
              borderRadius: '8px',
              border: '2px solid var(--aayu-navy)'
            }}>
              <strong>Training Notes:</strong><br />
              {trainingData.baselineNotes.length} examples
            </div>
          </div>
          
          <button 
            className="btn btn-secondary"
            onClick={() => setActiveTab('training')}
            style={{ fontSize: '14px', padding: '12px 20px' }}
          >
            Configure Training
          </button>
        </div>

        {/* Patient Selection Section */}
        <div className="card">
          <h3 className="card-title">Patient Selection</h3>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <select 
                className="form-input"
                value={selectedPatient?.id || ''}
                onChange={(e) => handlePatientSelect(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                <option value="">Select a patient...</option>
                {patients.map(patient => (
                  <option key={patient.id} value={patient.id}>
                    {patient.firstName} {patient.lastName} - DOB: {patient.dateOfBirth}
                  </option>
                ))}
              </select>
            </div>
            
            {authService.hasPermission('add_patients') && (
              <button 
                className="btn btn-primary"
                onClick={() => setShowPatientModal(true)}
                style={{ minWidth: 'auto', padding: '16px 24px' }}
              >
                Add New Patient
              </button>
            )}
          </div>

          {selectedPatient && (
            <div style={{ 
              padding: '16px', 
              backgroundColor: 'var(--aayu-pale-lime)', 
              borderRadius: '8px',
              border: '2px solid var(--aayu-lime)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div 
                  className="patient-avatar"
                  style={{ 
                    backgroundColor: getAvatarColor(selectedPatient),
                    width: '40px',
                    height: '40px',
                    fontSize: '16px'
                  }}
                >
                  {getPatientInitials(selectedPatient)}
                </div>
                <div>
                  <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                  <div style={{ fontSize: '14px', color: 'var(--aayu-gray)' }}>
                    DOB: {selectedPatient.dateOfBirth} | Visits: {selectedPatient.visits.length}
                  </div>
                </div>
              </div>
              
              {(selectedPatient.medicalHistory || selectedPatient.medications) && (
                <div style={{ fontSize: '14px', marginTop: '8px' }}>
                  {selectedPatient.medicalHistory && (
                    <div><strong>History:</strong> {selectedPatient.medicalHistory}</div>
                  )}
                  {selectedPatient.medications && (
                    <div><strong>Medications:</strong> {selectedPatient.medications}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recording Controls */}
        <div className="card">
          <h3 className="card-title">Recording Controls</h3>
          
          <div className="recording-controls">
            <button 
              className="btn btn-record"
              onClick={startRecording}
              disabled={isRecording || isPaused}
            >
              {isRecording ? 'Recording...' : 'Start Recording'}
            </button>
            
            {isRecording && !isPaused && (
              <button 
                className="btn btn-secondary"
                onClick={pauseRecording}
              >
                Pause
              </button>
            )}
            
            {isPaused && (
              <button 
                className="btn btn-primary"
                onClick={resumeRecording}
              >
                Resume
              </button>
            )}
            
            <button 
              className="btn btn-stop"
              onClick={stopRecording}
              disabled={!isRecording && !isPaused}
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
              disabled={!medicalNotes || !selectedPatient}
            >
              Save Visit
            </button>
          </div>

          <div className={`status-indicator ${isRecording ? 'recording' : isPaused ? 'processing' : isProcessing ? 'processing' : 'ready'}`}>
            {status}
          </div>
        </div>

        {/* Live Transcript */}
        <div className="card">
          <h3 className="card-title">Live Transcript</h3>
          <div className="transcript-container">
            {transcript || interimTranscript ? (
              <span>
                {transcript}
                {interimTranscript && (
                  <span style={{ color: '#888', fontStyle: 'italic' }}>
                    {transcript ? ' ' : ''}{interimTranscript}
                  </span>
                )}
              </span>
            ) : (
              <span className="transcript-placeholder">Transcript will appear here as you speak...</span>
            )}
          </div>
        </div>

        {/* Generated Medical Notes */}
        <div className="card">
          <h3 className="card-title">Generated Medical Notes</h3>
          <div className="notes-container">
            {medicalNotes || <span className="notes-placeholder">AI-generated medical notes will appear here...</span>}
          </div>
          {medicalNotes && !selectedPatient && (
            <div style={{ 
              marginTop: '12px', 
              padding: '12px', 
              backgroundColor: 'rgba(255, 87, 87, 0.1)',
              border: '2px solid var(--aayu-coral)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--aayu-coral)'
            }}>
              ⚠️ Please select a patient to save these notes
            </div>
          )}
        </div>
      </div>
    );
  };

  // Patients page component
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
                      {visit.specialty && visit.noteType && (
                        <span> • {medicalSpecialties[visit.specialty]?.name} - {medicalSpecialties[visit.specialty]?.noteTypes[visit.noteType]}</span>
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

  // Users page component
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

  // Settings page component
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
                style={{ marginRight: '8px' }}
              />
              Show API Keys
            </label>
          </div>

          <button className="btn btn-success" onClick={() => saveApiSettings(apiSettings)}>
            Save Settings
          </button>
          
          <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--aayu-gray)' }}>
            <strong>Current Status:</strong> 
            {apiSettings.speechKey && apiSettings.openaiKey ? 
              <span style={{ color: 'green' }}> ✓ Configured</span> : 
              <span style={{ color: 'red' }}> ✗ Missing required keys</span>
            }
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="app-container">
      {currentUser && renderSidebar()}
      
      <main className="main-content">
        {currentUser && (
          <>
            {activeTab === 'scribe' && renderScribePage()}
            {activeTab === 'training' && renderTrainingPage()}
            {activeTab === 'patients' && renderPatientsPage()}
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
                <button type="submit" className="btn btn-primary">Login</button>
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
              <strong>Available Users:</strong><br />
              darshan@aayuwell.com (Super Admin)<br />
              admin (Admin) • doctor (Provider) • staff (Support)
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
                <p className="modal-subtitle">Note: Users must be added to environment config permanently</p>
              </div>
              <button className="modal-close" onClick={() => setShowCreateUserModal(false)}>Close</button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Username (Email) *</label>
                <input
                  type="text" 
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
                <button type="submit" className="btn btn-success">Log User Info</button>
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
              <button className="modal-close" onClick={() => setShowPatientModal(false)}>Close</button>
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
              <button className="btn btn-success" onClick={addPatient}>Save Patient</button>
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
                  {selectedVisit.specialty && selectedVisit.noteType && (
                    <span> • {medicalSpecialties[selectedVisit.specialty]?.name} - {medicalSpecialties[selectedVisit.specialty]?.noteTypes[selectedVisit.noteType]}</span>
                  )}
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

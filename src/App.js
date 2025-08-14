import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';
import authService from './authService';
import './App.css';

// Import components
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import LoginModal from './components/LoginModal';
import CreateUserModal from './components/CreateUserModal';
import PatientModal from './components/PatientModal';
import PatientViewModal from './components/PatientViewModal';
import NoteViewModal from './components/NoteViewModal';

// Import pages
import ScribePage from './pages/ScribePage';
import TrainingPage from './pages/TrainingPage';
import PatientsPage from './pages/PatientsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';

// Import utilities
import {
  MEDICAL_SPECIALTIES,
  SPECIALTY_INSTRUCTIONS,
  DEFAULT_TRAINING_DATA,
  DEFAULT_API_SETTINGS,
  DEFAULT_PATIENT_DATA,
  DEFAULT_USER_DATA,
  SPEECH_CONFIG
} from './utils/constants';

import {
  cleanMarkdownFormatting,
  calculateAge
} from './utils/helpers';

import aayuLogo from './utils/logo';

function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState(DEFAULT_USER_DATA);

  // Navigation and patient states
  const [activeTab, setActiveTab] = useState('scribe');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showPatientQuickView, setShowPatientQuickView] = useState(false);
  const [showPatientFullView, setShowPatientFullView] = useState(false);
  const [showNoteQuickView, setShowNoteQuickView] = useState(false);
  const [selectedNoteForView, setSelectedNoteForView] = useState(null);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [newPatientData, setNewPatientData] = useState(DEFAULT_PATIENT_DATA);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Please log in to continue');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState(null);

  // API settings states
  const [apiSettings, setApiSettings] = useState(DEFAULT_API_SETTINGS);
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Training states
  const [trainingData, setTrainingData] = useState(DEFAULT_TRAINING_DATA);
  const [uploadedNoteText, setUploadedNoteText] = useState('');

  // Speech recognition refs
  const recognizerRef = useRef(null);
  const audioConfigRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const activityCheckRef = useRef(null);

  // API configuration
  const apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';

  // =============== DEBUGGING HELPER ===============
  const debugLog = useCallback((message, data = null) => {
    if (process.env.NODE_ENV === 'development' || localStorage.getItem('debugMode') === 'true') {
      console.log(`[App] ${message}`, data || '');
    }
  }, []);

  // =============== CLEANUP FUNCTION - DEFINE EARLY ===============
  const cleanupSpeechRecognizer = useCallback(() => {
    try {
      debugLog('Cleaning up speech recognizer...');
      
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      if (recognizerRef.current) {
        try {
          recognizerRef.current.close();
        } catch (e) {
          // Ignore errors during cleanup
        }
        recognizerRef.current = null;
      }
      
      if (audioConfigRef.current) {
        try {
          audioConfigRef.current.close();
        } catch (e) {
          // Ignore errors during cleanup
        }
        audioConfigRef.current = null;
      }
      
      debugLog('Speech recognizer cleanup complete');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }, [debugLog]);

  // =============== DATA LOADING FUNCTIONS ===============
  const loadPatientsFromLocalStorage = useCallback(() => {
    try {
      debugLog('Loading patients from localStorage...');
      
      const saved = localStorage.getItem('patients');
      if (saved) {
        const parsed = JSON.parse(saved);
        const patientsArray = Array.isArray(parsed) ? parsed : [];
        setPatients(patientsArray);
        debugLog(`Loaded ${patientsArray.length} patients from localStorage`);
      } else {
        setPatients([]);
        debugLog('No patients found in localStorage');
      }
    } catch (error) {
      console.error('Failed to load patients from localStorage:', error);
      setPatients([]);
    }
  }, [debugLog]);

  const loadTrainingData = useCallback(() => {
    try {
      const saved = localStorage.getItem('trainingData');
      if (saved) {
        const parsed = JSON.parse(saved);
        const validSpecialty = MEDICAL_SPECIALTIES[parsed.specialty] ? parsed.specialty : 'internal_medicine';
        const validNoteType = MEDICAL_SPECIALTIES[validSpecialty].noteTypes[parsed.noteType] ? 
          parsed.noteType : 'progress_note';
        
        setTrainingData({
          specialty: validSpecialty,
          noteType: validNoteType,
          baselineNotes: Array.isArray(parsed.baselineNotes) ? parsed.baselineNotes.slice(-5) : [],
          customTemplates: parsed.customTemplates || {}
        });
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
      setTrainingData(DEFAULT_TRAINING_DATA);
    }
  }, []);

  const saveTrainingData = useCallback((data) => {
    try {
      const sanitizedData = {
        specialty: MEDICAL_SPECIALTIES[data.specialty] ? data.specialty : 'internal_medicine',
        noteType: data.noteType || 'progress_note',
        baselineNotes: Array.isArray(data.baselineNotes) ? data.baselineNotes.slice(-5) : [],
        customTemplates: data.customTemplates || {}
      };
      
      localStorage.setItem('trainingData', JSON.stringify(sanitizedData));
      setTrainingData(sanitizedData);
      debugLog('Training data saved', sanitizedData);
    } catch (error) {
      console.error('Failed to save training data:', error);
      setStatus('Warning: Failed to save training data');
    }
  }, [debugLog]);

  // =============== AUTHENTICATION FUNCTIONS ===============
  const handleLogin = useCallback((e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      if (!loginForm.username || !loginForm.password) {
        setLoginError('Please enter username and password');
        return;
      }
      
      // Simple synchronous login
      const user = authService.login(loginForm.username, loginForm.password);
      
      if (user) {
        console.log('Login successful:', user);
        setCurrentUser(user);
        setShowLoginModal(false);
        setLoginForm({ username: '', password: '' });
        setStatus('Login successful - Ready to begin');
        loadPatientsFromLocalStorage();
        loadTrainingData();
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Invalid credentials. Try: doctor/doctor123');
    }
  }, [loginForm, loadPatientsFromLocalStorage, loadTrainingData]);

  const handleLogout = useCallback(() => {
    debugLog('Logging out user');
    
    // Clean up speech recognizer
    cleanupSpeechRecognizer();
    
    // Clear all state
    setCurrentUser(null);
    setSelectedPatient(null);
    setTranscript('');
    setInterimTranscript('');
    setMedicalNotes('');
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    setActiveTab('scribe');
    
    // Clear auth
    if (authService) {
      authService.logout();
    }
    
    // Show login modal
    setShowLoginModal(true);
    setStatus('Please log in to continue');
  }, [cleanupSpeechRecognizer, debugLog]);

  const handleCreateUser = useCallback((e) => {
    e.preventDefault();
    
    try {
      if (!authService?.hasPermission('add_users')) {
        alert('You do not have permission to create users');
        return;
      }
      
      // Validate passwords match
      if (newUser.password !== newUser.confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      // Validate required fields
      if (!newUser.username || !newUser.password || !newUser.name || !newUser.role) {
        alert('Please fill in all required fields');
        return;
      }
      
      // Create user (local for now)
      const result = authService.createUser(newUser);
      
      if (result.success) {
        alert('User created successfully (saved locally)');
        setShowCreateUserModal(false);
        setNewUser(DEFAULT_USER_DATA);
      } else {
        alert('Failed to create user: ' + result.message);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user: ' + error.message);
    }
  }, [newUser]);

  // =============== EFFECTS ===============

  // Recording duration timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // Activity monitoring for session timeout
  useEffect(() => {
    const handleActivity = () => {
      if (currentUser && authService) {
        authService.updateSession();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Check session validity every minute
    activityCheckRef.current = setInterval(() => {
      if (currentUser && authService && !authService.isAuthenticated()) {
        debugLog('Session expired, logging out');
        handleLogout();
      }
    }, 60000);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
    };
  }, [currentUser, handleLogout, debugLog]);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      debugLog('Initializing app...');
      
      try {
        if (!authService) {
          throw new Error('Authentication service not available');
        }
        
        // Check if user is already logged in
        const user = authService.getCurrentUser();
        if (user && authService.isAuthenticated()) {
          debugLog('User already authenticated', { username: user.username, role: user.role });
          setCurrentUser(user);
          setStatus('Ready to begin');
          loadPatientsFromLocalStorage();
          loadTrainingData();
        } else {
          debugLog('No authenticated user, showing login');
          setShowLoginModal(true);
        }
        
        // Load API settings from localStorage
        const savedApiSettings = localStorage.getItem('apiSettings');
        if (savedApiSettings) {
          try {
            const parsed = JSON.parse(savedApiSettings);
            setApiSettings(prev => ({ ...prev, ...parsed }));
          } catch (e) {
            debugLog('Failed to parse saved API settings');
          }
        }
      } catch (error) {
        console.error('App initialization error:', error);
        setShowLoginModal(true);
        setStatus('Please log in to continue');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
    
    // Cleanup on unmount
    return () => {
      cleanupSpeechRecognizer();
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // =============== PATIENT MANAGEMENT ===============

  const addPatient = useCallback(async () => {
    try {
      debugLog('Adding patient', newPatientData);
      
      if (!authService?.hasPermission('add_patients')) {
        alert('You do not have permission to add patients');
        return;
      }

      if (!newPatientData.firstName?.trim() || !newPatientData.lastName?.trim() || !newPatientData.dateOfBirth?.trim()) {
        alert('Please fill in all required fields (First Name, Last Name, Date of Birth)');
        return;
      }

      const patient = {
        ...newPatientData,
        id: Date.now().toString(),
        firstName: newPatientData.firstName.trim(),
        lastName: newPatientData.lastName.trim(),
        createdBy: currentUser?.name || currentUser?.username || 'Unknown',
        createdAt: new Date().toISOString(),
        visits: []
      };

      // Save to localStorage
      const updatedPatients = [...patients, patient];
      setPatients(updatedPatients);
      localStorage.setItem('patients', JSON.stringify(updatedPatients));
      
      setNewPatientData(DEFAULT_PATIENT_DATA);
      setShowPatientModal(false);
      setStatus('Patient added successfully');
      
      debugLog('Patient added', { id: patient.id, name: `${patient.firstName} ${patient.lastName}` });
    } catch (error) {
      console.error('Error adding patient:', error);
      alert('Failed to save patient: ' + error.message);
    }
  }, [newPatientData, patients, currentUser, debugLog]);

  const updatePatient = useCallback(async () => {
    try {
      if (!selectedPatient) return;
      
      debugLog('Updating patient', { id: selectedPatient.id });

      const updatedPatient = {
        ...selectedPatient,
        ...newPatientData,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.name || currentUser?.username || 'Unknown'
      };

      // Update in localStorage
      const updatedPatients = patients.map(p => 
        p.id === selectedPatient.id ? updatedPatient : p
      );
      setPatients(updatedPatients);
      localStorage.setItem('patients', JSON.stringify(updatedPatients));
      
      setIsEditingPatient(false);
      setShowPatientFullView(false);
      setStatus('Patient updated successfully');
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient: ' + error.message);
    }
  }, [selectedPatient, newPatientData, patients, currentUser, debugLog]);

  // =============== SPEECH RECOGNITION ===============

  // Helper function to get speech token from backend
  const getSpeechToken = async () => {
    try {
      debugLog('Getting speech token from backend...');
      
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      debugLog('Making request to speech-token endpoint', {
        userId: currentUser.id,
        userRole: currentUser.role,
        userName: currentUser.name
      });
      
      const response = await axios.get(`${apiBaseUrl}/speech-token`, {
        headers: authService.getAuthHeaders(),
        timeout: 15000
      });
      
      debugLog('Token response received', {
        status: response.status,
        hasToken: !!response.data?.token,
        region: response.data?.region
      });
      
      if (!response.data || !response.data.token) {
        throw new Error('Invalid token response from server');
      }
      
      return response.data;
    } catch (error) {
      console.error('Failed to get speech token:', error);
      
      if (error.response) {
        debugLog('Server error response', {
          status: error.response.status,
          data: error.response.data
        });
        
        if (error.response.status === 401) {
          throw new Error('Please log in again to use speech services');
        } else if (error.response.status === 403) {
          throw new Error('You do not have permission to use the scribe feature');
        } else if (error.response.status === 500) {
          const details = error.response.data?.details || error.response.data?.error || 'Speech service configuration error';
          throw new Error(details);
        }
      } else if (!navigator.onLine) {
        throw new Error('No internet connection');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - please check your connection');
      }
      
      throw error;
    }
  };

  const startRecording = useCallback(async () => {
    try {
      debugLog('Starting recording process...');
      
      // Check user permissions
      if (!authService?.hasPermission('scribe')) {
        debugLog('Permission denied for scribe feature');
        setStatus('You do not have permission to use the scribe feature');
        return;
      }
      
      // Check if already recording
      if (isRecording || isPaused) {
        debugLog('Already recording or paused');
        setStatus('Recording already in progress');
        return;
      }
      
      setStatus('Initializing speech service...');
      
      // Step 1: Request microphone permission
      debugLog('Requesting microphone permission...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        debugLog('Microphone permission granted');
      } catch (permError) {
        console.error('Microphone permission denied:', permError);
        setStatus('❌ Microphone permission denied. Please allow microphone access and try again.');
        
        // Show browser-specific instructions
        if (navigator.userAgent.includes('Chrome')) {
          alert('To enable microphone:\n1. Click the lock icon in the address bar\n2. Set Microphone to "Allow"\n3. Refresh the page');
        } else if (navigator.userAgent.includes('Firefox')) {
          alert('To enable microphone:\n1. Click the lock icon in the address bar\n2. Click "More Information"\n3. Go to Permissions tab\n4. Set Microphone to "Allow"');
        }
        return;
      }
      
      // Step 2: Get speech token from backend
      debugLog('Getting speech token...');
      let tokenData;
      try {
        tokenData = await getSpeechToken();
        debugLog('Got token for region:', tokenData.region);
      } catch (tokenError) {
        console.error('Token error:', tokenError);
        setStatus(`❌ ${tokenError.message}`);
        return;
      }
      
      // Step 3: Initialize Speech SDK with token
      debugLog('Initializing Speech SDK...');
      try {
        // Create speech config using token (not subscription key)
        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
          tokenData.token,
          tokenData.region
        );
        
        // Configure speech recognition settings
        speechConfig.speechRecognitionLanguage = 'en-US';
        speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
        speechConfig.enableDictation();
        
        // Configure audio input
        audioConfigRef.current = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        
        // Create recognizer
        recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfigRef.current);
        
        debugLog('Speech recognizer created');
        
        // Set up recognition event handlers
        recognizerRef.current.recognizing = (s, e) => {
          if (e.result.text) {
            debugLog('Interim:', e.result.text);
            setInterimTranscript(e.result.text);
          }
        };
        
        recognizerRef.current.recognized = (s, e) => {
          if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text.trim()) {
            debugLog('Final:', e.result.text);
            setTranscript(prev => {
              const newTranscript = prev + (prev ? ' ' : '') + e.result.text.trim();
              // Save to localStorage for recovery
              localStorage.setItem('currentTranscript', JSON.stringify({
                text: newTranscript,
                timestamp: new Date().toISOString(),
                patientId: selectedPatient?.id || null
              }));
              return newTranscript;
            });
            setInterimTranscript('');
          } else if (e.result.reason === SpeechSDK.ResultReason.NoMatch) {
            debugLog('No speech detected');
          }
        };
        
        recognizerRef.current.sessionStarted = (s, e) => {
          debugLog('Session started');
          setStatus('🔴 Recording... Speak clearly');
        };
        
        recognizerRef.current.sessionStopped = (s, e) => {
          debugLog('Session stopped');
          setIsRecording(false);
          setIsPaused(false);
          setStatus('✅ Recording session ended');
        };
        
        recognizerRef.current.canceled = (s, e) => {
          console.error('Recognition canceled:', e.reason);
          setIsRecording(false);
          setIsPaused(false);
          
          if (e.reason === SpeechSDK.CancellationReason.Error) {
            debugLog('Error details:', e.errorDetails);
            
            if (e.errorDetails.includes('1006')) {
              setStatus('❌ Invalid speech token. Please try again.');
            } else if (e.errorDetails.includes('1007')) {
              setStatus('❌ Speech service error. Please contact administrator.');
            } else if (e.errorDetails.includes('microphone')) {
              setStatus('❌ Microphone error. Please check your microphone.');
            } else {
              setStatus(`❌ Recognition error: ${e.errorDetails}`);
            }
          } else if (e.reason === SpeechSDK.CancellationReason.EndOfStream) {
            setStatus('✅ Recording complete');
          }
        };
        
        // Start continuous recognition
        debugLog('Starting continuous recognition...');
        await new Promise((resolve, reject) => {
          recognizerRef.current.startContinuousRecognitionAsync(
            () => {
              debugLog('Recognition started successfully');
              setIsRecording(true);
              setIsPaused(false);
              setStatus('🔴 Recording... Speak clearly');
              setRecordingStartTime(Date.now());
              setRecordingDuration(0);
              resolve();
            },
            (error) => {
              console.error('Failed to start recognition:', error);
              reject(new Error(`Failed to start recording: ${error}`));
            }
          );
        });
        
      } catch (sdkError) {
        console.error('SDK initialization error:', sdkError);
        setStatus(`❌ Failed to initialize speech service: ${sdkError.message}`);
        cleanupSpeechRecognizer();
      }
      
    } catch (error) {
      console.error('Unexpected error:', error);
      setStatus(`❌ Recording failed: ${error.message}`);
      setIsRecording(false);
      setIsPaused(false);
      cleanupSpeechRecognizer();
    }
  }, [isRecording, isPaused, selectedPatient, apiBaseUrl, cleanupSpeechRecognizer, debugLog]);

  const pauseRecording = useCallback(() => {
    if (recognizerRef.current && isRecording && !isPaused) {
      debugLog('Pausing recording...');
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          setIsPaused(true);
          setStatus('⏸️ Recording paused');
          debugLog('Recording paused successfully');
        },
        (error) => {
          console.error('Pause error:', error);
          setStatus('❌ Failed to pause recording');
        }
      );
    }
  }, [isRecording, isPaused, debugLog]);

  const resumeRecording = useCallback(async () => {
    if (recognizerRef.current && isRecording && isPaused) {
      debugLog('Resuming recording...');
      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          setIsPaused(false);
          setStatus('🔴 Recording resumed... Speak clearly');
          debugLog('Recording resumed successfully');
        },
        (error) => {
          console.error('Resume error:', error);
          setStatus('❌ Failed to resume recording');
        }
      );
    }
  }, [isRecording, isPaused, debugLog]);

  const stopRecording = useCallback(() => {
    debugLog('Stopping recording...');
    
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          debugLog('Recording stopped successfully');
          setIsRecording(false);
          setIsPaused(false);
          setInterimTranscript('');
          setRecordingDuration(0);
          setStatus('✅ Recording complete');
          cleanupSpeechRecognizer();
        },
        (error) => {
          console.error('Stop error:', error);
          setIsRecording(false);
          setIsPaused(false);
          setInterimTranscript('');
          setRecordingDuration(0);
          setStatus('⚠️ Recording stopped with error');
          cleanupSpeechRecognizer();
        }
      );
    } else {
      setIsRecording(false);
      setIsPaused(false);
      setInterimTranscript('');
      setRecordingDuration(0);
      setStatus('✅ Recording complete');
    }
  }, [cleanupSpeechRecognizer, debugLog]);

  const toggleRecording = useCallback(async () => {
    debugLog('Toggle recording called', { isRecording, isPaused });
    
    if (!isRecording && !isPaused) {
      await startRecording();
    } else if (isRecording && !isPaused) {
      pauseRecording();
    } else if (isPaused) {
      await resumeRecording();
    }
  }, [isRecording, isPaused, startRecording, pauseRecording, resumeRecording, debugLog]);

  // =============== AI GENERATION ===============

  const generateSpecialtyPrompt = useCallback(() => {
    try {
      const specialty = MEDICAL_SPECIALTIES[trainingData.specialty];
      const noteTypeName = specialty.noteTypes[trainingData.noteType];
      
      let baselineContext = '';
      if (trainingData.baselineNotes?.length > 0) {
        const relevantNotes = trainingData.baselineNotes
          .filter(note => note?.specialty === trainingData.specialty && note?.noteType === trainingData.noteType)
          .slice(-3);
        
        if (relevantNotes.length > 0) {
          baselineContext = `\n\nPROVIDER STYLE EXAMPLES (match this exact style and format):\n${
            relevantNotes.map((note, idx) => `Example ${idx + 1}:\n${note.content || ''}`).join('\n\n---\n\n')
          }`;
        }
      }

      const specialtyInstruction = SPECIALTY_INSTRUCTIONS[trainingData.specialty] || 
        'Focus on accurate medical documentation with appropriate clinical detail.';

      return `You are an expert medical scribe for ${specialty.name}. Generate a ${noteTypeName} that follows these strict requirements:

CRITICAL FORMATTING RULES:
- ABSOLUTELY NO markdown formatting
- Use ONLY plain text with standard punctuation
- Headers should be in ALL CAPS followed by a colon
- Keep sentences concise and medically accurate

SPECIALTY REQUIREMENTS:
${specialtyInstruction}

REQUIRED DOCUMENTATION STRUCTURE:
CHIEF COMPLAINT: [Brief statement]
HISTORY OF PRESENT ILLNESS: [Chronological narrative]
REVIEW OF SYSTEMS: [Pertinent positives and negatives]
PHYSICAL EXAMINATION: [Organized by body systems]
ASSESSMENT AND PLAN: [List each problem with plan]

${baselineContext}

INSTRUCTIONS: Convert the transcript into professional medical documentation.`;
    } catch (error) {
      console.error('Error generating specialty prompt:', error);
      return 'You are a medical scribe. Create professional medical notes from the transcript provided.';
    }
  }, [trainingData]);

  const generateNotes = useCallback(async () => {
    try {
      debugLog('Generating notes...');
      
      if (!authService?.hasPermission('scribe')) {
        setStatus('You do not have permission to generate notes');
        return;
      }

      if (!transcript?.trim()) {
        setStatus('No transcript available. Please record first.');
        return;
      }

      setIsProcessing(true);
      setStatus('AI generating medical notes...');

      let patientContext = '';
      if (selectedPatient) {
        const age = calculateAge(selectedPatient.dateOfBirth);
        patientContext = `
PATIENT CONTEXT:
Name: ${selectedPatient.firstName || ''} ${selectedPatient.lastName || ''}
Age: ${age || 'Unknown'}
DOB: ${selectedPatient.dateOfBirth || 'Not specified'}
Gender: ${selectedPatient.gender || 'Not specified'}
Allergies: ${selectedPatient.allergies || 'NKDA'}
Medical History: ${selectedPatient.medicalHistory || 'No significant medical history recorded'}
Current Medications: ${selectedPatient.medications || 'No current medications recorded'}`;
      } else {
        patientContext = 'PATIENT CONTEXT: No patient selected - generating general medical notes from transcript.';
      }

      const systemPrompt = generateSpecialtyPrompt();

      debugLog('Calling generate-notes API...');
      
      const response = await axios.post(
        `${apiBaseUrl}/generate-notes`,
        {
          transcript: transcript,
          patientContext: patientContext,
          systemPrompt: systemPrompt,
          specialty: trainingData.specialty,
          noteType: trainingData.noteType
        },
        {
          headers: authService.getAuthHeaders(),
          timeout: 30000
        }
      );

      if (!response.data?.notes) {
        throw new Error('Invalid response from API');
      }

      const cleanedNotes = cleanMarkdownFormatting(response.data.notes);
      
      setMedicalNotes(cleanedNotes);
      setStatus(selectedPatient ? 'Medical notes generated successfully' : 'Medical notes generated - Select patient to save');
      
      debugLog('Notes generated successfully');
    } catch (error) {
      console.error('AI generation error:', error);
      let errorMessage = 'Failed to generate notes: ';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to generate notes.';
      } else if (error.response?.status === 500) {
        errorMessage = error.response.data?.error || 'Server error. Please try again.';
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred';
      }
      
      setStatus(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, selectedPatient, trainingData, generateSpecialtyPrompt, apiBaseUrl, debugLog]);

  const saveVisit = useCallback(async () => {
    try {
      debugLog('Saving visit...');
      
      if (!medicalNotes?.trim()) {
        setStatus('Cannot save - no notes generated');
        return;
      }

      if (!selectedPatient) {
        setStatus('Please select a patient before saving');
        return;
      }

      if (!authService?.hasPermission('scribe')) {
        setStatus('You do not have permission to save visits');
        return;
      }

      const visit = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        transcript: transcript || '',
        notes: medicalNotes,
        specialty: trainingData.specialty,
        noteType: trainingData.noteType,
        createdBy: currentUser?.name || currentUser?.username || 'Unknown',
        createdAt: new Date().toISOString()
      };

      // Update patient with new visit
      const updatedPatient = {
        ...selectedPatient,
        visits: [...(selectedPatient.visits || []), visit]
      };

      // Update local storage
      const updatedPatients = patients.map(p => 
        p.id === selectedPatient.id ? updatedPatient : p
      );
      setPatients(updatedPatients);
      localStorage.setItem('patients', JSON.stringify(updatedPatients));
      setSelectedPatient(updatedPatient);
      
      // Clear the session after saving
      setTranscript('');
      setInterimTranscript('');
      setMedicalNotes('');
      localStorage.removeItem('currentTranscript');
      setStatus('Visit saved successfully - Ready for next patient');
      
      debugLog('Visit saved', { patientId: selectedPatient.id, visitId: visit.id });
    } catch (error) {
      console.error('Save visit error:', error);
      setStatus('Failed to save visit: ' + (error.message || 'Unknown error'));
    }
  }, [medicalNotes, selectedPatient, transcript, patients, trainingData, currentUser, debugLog]);

  // =============== TRAINING HANDLERS ===============

  const addBaselineNote = useCallback(() => {
    try {
      if (!uploadedNoteText?.trim()) {
        alert('Please enter a note before adding it to baseline');
        return;
      }

      const newNote = {
        id: Date.now(),
        content: cleanMarkdownFormatting(uploadedNoteText.trim()),
        specialty: trainingData.specialty,
        noteType: trainingData.noteType,
        dateAdded: new Date().toISOString(),
        addedBy: currentUser?.name || currentUser?.username || 'Unknown'
      };

      const updatedData = {
        ...trainingData,
        baselineNotes: [...(trainingData.baselineNotes || []), newNote].slice(-5)
      };

      saveTrainingData(updatedData);
      setUploadedNoteText('');
      alert('Baseline note added successfully!');
      
      debugLog('Baseline note added', { specialty: newNote.specialty, noteType: newNote.noteType });
    } catch (error) {
      console.error('Error adding baseline note:', error);
      alert('Failed to add baseline note. Please try again.');
    }
  }, [uploadedNoteText, trainingData, currentUser, saveTrainingData, debugLog]);

  const removeBaselineNote = useCallback((noteId) => {
    try {
      const updatedData = {
        ...trainingData,
        baselineNotes: (trainingData.baselineNotes || []).filter(note => note.id !== noteId)
      };
      saveTrainingData(updatedData);
      debugLog('Baseline note removed', { noteId });
    } catch (error) {
      console.error('Error removing baseline note:', error);
      alert('Failed to remove baseline note. Please try again.');
    }
  }, [trainingData, saveTrainingData, debugLog]);

  // =============== SETTINGS HANDLERS ===============

  const saveApiSettings = useCallback((settings) => {
    try {
      const validatedSettings = {
        speechKey: settings.speechKey || '',
        speechRegion: settings.speechRegion || 'eastus',
        openaiEndpoint: settings.openaiEndpoint || '',
        openaiKey: settings.openaiKey || '',
        openaiDeployment: settings.openaiDeployment || 'gpt-4',
        openaiApiVersion: settings.openaiApiVersion || '2024-08-01-preview'
      };
      
      setApiSettings(validatedSettings);
      localStorage.setItem('apiSettings', JSON.stringify(validatedSettings));
      
      if (validatedSettings.speechKey && validatedSettings.openaiKey) {
        setStatus('API settings saved - Ready to begin');
      } else {
        setStatus('API settings saved - Please configure all required keys');
      }
      
      debugLog('API settings saved');
    } catch (error) {
      console.error('Error saving API settings:', error);
      setStatus('Failed to save API settings: ' + error.message);
    }
  }, [debugLog]);

  // =============== MODAL HANDLERS ===============

  const handlePatientClick = useCallback((patient) => {
    setSelectedPatient(patient);
    setShowPatientFullView(true);
    setNewPatientData({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      zipCode: patient.zipCode || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyPhone: patient.emergencyPhone || '',
      insurance: patient.insurance || '',
      policyNumber: patient.policyNumber || '',
      allergies: patient.allergies || '',
      medicalHistory: patient.medicalHistory || '',
      medications: patient.medications || '',
      primaryPhysician: patient.primaryPhysician || '',
      preferredPharmacy: patient.preferredPharmacy || ''
    });
  }, []);

  const handleEditPatient = useCallback((patient) => {
    setSelectedPatient(patient);
    setIsEditingPatient(true);
    setShowPatientFullView(true);
    setShowPatientQuickView(false);
    setNewPatientData({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      zipCode: patient.zipCode || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyPhone: patient.emergencyPhone || '',
      insurance: patient.insurance || '',
      policyNumber: patient.policyNumber || '',
      allergies: patient.allergies || '',
      medicalHistory: patient.medicalHistory || '',
      medications: patient.medications || '',
      primaryPhysician: patient.primaryPhysician || '',
      preferredPharmacy: patient.preferredPharmacy || ''
    });
  }, []);

  // =============== RENDER ===============

  if (isLoading) {
    return (
      <ErrorBoundary>
        <LoadingScreen logo={aayuLogo} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-container">
        {currentUser && (
          <Sidebar
            logo={aayuLogo}
            currentUser={currentUser}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
          />
        )}
        
        <main className="main-content">
          {currentUser ? (
            <>
              {activeTab === 'scribe' && (
                <ScribePage
                  patients={patients}
                  selectedPatient={selectedPatient}
                  setSelectedPatient={setSelectedPatient}
                  patientSearchTerm={patientSearchTerm}
                  setPatientSearchTerm={setPatientSearchTerm}
                  trainingData={trainingData}
                  onTrainingDataChange={saveTrainingData}
                  isRecording={isRecording}
                  isPaused={isPaused}
                  recordingDuration={recordingDuration}
                  status={status}
                  transcript={transcript}
                  interimTranscript={interimTranscript}
                  medicalNotes={medicalNotes}
                  isProcessing={isProcessing}
                  onToggleRecording={toggleRecording}
                  onStopRecording={stopRecording}
                  onGenerateNotes={generateNotes}
                  onSaveVisit={saveVisit}
                  onAddPatient={() => setShowPatientModal(true)}
                  onPatientQuickView={(patient) => {
                    setSelectedPatient(patient);
                    setShowPatientQuickView(true);
                  }}
                />
              )}
              
              {activeTab === 'training' && authService.hasPermission('training') && (
                <TrainingPage
                  trainingData={trainingData}
                  uploadedNoteText={uploadedNoteText}
                  setUploadedNoteText={setUploadedNoteText}
                  onSpecialtyChange={(specialty) => {
                    const noteType = Object.keys(MEDICAL_SPECIALTIES[specialty]?.noteTypes || {})[0] || 'progress_note';
                    saveTrainingData({ ...trainingData, specialty, noteType });
                  }}
                  onNoteTypeChange={(noteType) => {
                    saveTrainingData({ ...trainingData, noteType });
                  }}
                  onAddBaselineNote={addBaselineNote}
                  onRemoveBaselineNote={removeBaselineNote}
                />
              )}
              
              {activeTab === 'patients' && (
                <PatientsPage
                  patients={patients}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onAddPatient={() => setShowPatientModal(true)}
                  onPatientClick={handlePatientClick}
                />
              )}
              
              {activeTab === 'settings' && authService.hasPermission('manage_settings') && (
                <SettingsPage
                  apiSettings={apiSettings}
                  setApiSettings={setApiSettings}
                  showApiKeys={showApiKeys}
                  setShowApiKeys={setShowApiKeys}
                  onSaveSettings={saveApiSettings}
                />
              )}
              
              {activeTab === 'users' && authService.hasPermission('manage_users') && (
                <UsersPage
                  onCreateUser={() => setShowCreateUserModal(true)}
                />
              )}
            </>
          ) : (
            <WelcomeScreen
              logo={aayuLogo}
              onSignIn={() => setShowLoginModal(true)}
            />
          )}
        </main>

        {/* Modals */}
        <LoginModal
          show={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          logo={aayuLogo}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          onSubmit={handleLogin}
          loginError={loginError}
        />

        <CreateUserModal
          show={showCreateUserModal}
          onClose={() => setShowCreateUserModal(false)}
          userData={newUser}
          setUserData={setNewUser}
          onSubmit={handleCreateUser}
        />

        <PatientModal
          show={showPatientModal}
          onClose={() => setShowPatientModal(false)}
          patientData={newPatientData}
          setPatientData={setNewPatientData}
          onSave={addPatient}
          isEditing={false}
        />

        <PatientModal
          show={isEditingPatient && showPatientFullView}
          onClose={() => {
            setIsEditingPatient(false);
            setShowPatientFullView(false);
          }}
          patientData={newPatientData}
          setPatientData={setNewPatientData}
          onSave={updatePatient}
          isEditing={true}
        />

        <PatientViewModal
          show={showPatientQuickView}
          onClose={() => setShowPatientQuickView(false)}
          patient={selectedPatient}
          onEdit={handleEditPatient}
          onViewNote={(note) => {
            setSelectedNoteForView(note);
            setShowNoteQuickView(true);
          }}
          isQuickView={true}
        />

        <PatientViewModal
          show={showPatientFullView && !isEditingPatient}
          onClose={() => setShowPatientFullView(false)}
          patient={selectedPatient}
          onEdit={handleEditPatient}
          onViewNote={(note) => {
            setSelectedNoteForView(note);
            setShowNoteQuickView(true);
          }}
          isQuickView={false}
        />

        <NoteViewModal
          show={showNoteQuickView}
          onClose={() => setShowNoteQuickView(false)}
          note={selectedNoteForView}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;

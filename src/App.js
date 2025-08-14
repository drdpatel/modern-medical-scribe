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
import apiService from './services/api';

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
        authService.updateActivity();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Check session validity every minute
    activityCheckRef.current = setInterval(() => {
      if (currentUser && authService && !authService.isSessionValid()) {
        handleLogout();
      }
    }, 60000);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
    };
  }, [currentUser]);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      try {
        if (!authService) {
          throw new Error('Authentication service not available');
        }
        
        const user = authService.currentUser;
        if (user) {
          setCurrentUser(user);
          setStatus('Ready to begin');
          loadPatientsFromLocalStorage();
          loadTrainingData();
        } else {
          setShowLoginModal(true);
        }
        
        // Load API settings
        const savedApiSettings = await apiService.getApiSettings();
        if (savedApiSettings) {
          setApiSettings(prev => ({ ...prev, ...savedApiSettings }));
        }
      } catch (error) {
        console.error('App initialization error:', error);
        setShowLoginModal(true);
        setStatus('Initialization failed: ' + error.message);
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

  // =============== DATA MANAGEMENT ===============

  const loadTrainingData = useCallback(async () => {
    try {
      const saved = await apiService.getTrainingData();
      if (saved) {
        const validSpecialty = MEDICAL_SPECIALTIES[saved.specialty] ? saved.specialty : 'internal_medicine';
        const validNoteType = MEDICAL_SPECIALTIES[validSpecialty].noteTypes[saved.noteType] ? 
          saved.noteType : 'progress_note';
        
        setTrainingData({
          specialty: validSpecialty,
          noteType: validNoteType,
          baselineNotes: Array.isArray(saved.baselineNotes) ? saved.baselineNotes.slice(-5) : [],
          customTemplates: saved.customTemplates || {}
        });
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
      setTrainingData(DEFAULT_TRAINING_DATA);
    }
  }, []);

  const saveTrainingData = useCallback(async (data) => {
    try {
      const sanitizedData = {
        specialty: MEDICAL_SPECIALTIES[data.specialty] ? data.specialty : 'internal_medicine',
        noteType: data.noteType || 'progress_note',
        baselineNotes: Array.isArray(data.baselineNotes) ? data.baselineNotes.slice(-5) : [],
        customTemplates: data.customTemplates || {}
      };
      
      await apiService.saveTrainingData(sanitizedData);
      setTrainingData(sanitizedData);
    } catch (error) {
      console.error('Failed to save training data:', error);
      setStatus('Warning: Failed to save training data');
    }
  }, []);

  const loadPatientsFromLocalStorage = useCallback(async () => {
    try {
      const patientsData = await apiService.getPatients();
      setPatients(patientsData);
    } catch (error) {
      console.error('Failed to load patients:', error);
      setPatients([]);
    }
  }, []);

  // =============== AUTHENTICATION ===============

  const handleLogin = useCallback((e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      if (!loginForm.username?.trim() || !loginForm.password?.trim()) {
        setLoginError('Please enter both username and password');
        return;
      }
      
      const user = authService.login(loginForm.username, loginForm.password);
      setCurrentUser(user);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
      setStatus('Login successful - Ready to begin');
      loadPatientsFromLocalStorage();
      loadTrainingData();
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Login failed. Please try again.');
    }
  }, [loginForm, loadPatientsFromLocalStorage, loadTrainingData]);

  const handleLogout = useCallback(() => {
    try {
      cleanupSpeechRecognizer();
      
      if (authService && typeof authService.logout === 'function') {
        authService.logout();
      }
      
      // Reset all states
      setCurrentUser(null);
      setPatients([]);
      setSelectedPatient(null);
      setTranscript('');
      setInterimTranscript('');
      setMedicalNotes('');
      setIsRecording(false);
      setIsPaused(false);
      setRecordingDuration(0);
      setStatus('Please log in to continue');
      setShowLoginModal(true);
      setActiveTab('scribe');
    } catch (error) {
      console.error('Logout error:', error);
      setCurrentUser(null);
      setShowLoginModal(true);
    }
  }, []);

  const handleCreateUser = useCallback((e) => {
    e.preventDefault();
    
    try {
      if (!newUser.username?.trim() || !newUser.password?.trim() || !newUser.name?.trim()) {
        alert('Please fill in all required fields');
        return;
      }
      
      if (newUser.password !== newUser.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      if (newUser.password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }

      const result = authService.createUser(newUser);
      setShowCreateUserModal(false);
      setNewUser(DEFAULT_USER_DATA);
      alert(result.message || 'User creation request logged');
    } catch (error) {
      console.error('Create user error:', error);
      alert('Failed to create user: ' + (error.message || 'Unknown error'));
    }
  }, [newUser]);

  // =============== PATIENT MANAGEMENT ===============

  const addPatient = useCallback(async () => {
    try {
      if (!authService?.hasPermission('add_patients')) {
        alert('You do not have permission to add patients');
        return;
      }

      if (!newPatientData.firstName?.trim() || !newPatientData.lastName?.trim() || !newPatientData.dateOfBirth?.trim()) {
        alert('Please fill in all required fields');
        return;
      }

      const patient = {
        ...newPatientData,
        firstName: newPatientData.firstName.trim(),
        lastName: newPatientData.lastName.trim()
      };

      await apiService.createPatient(patient);
      await loadPatientsFromLocalStorage();
      
      setNewPatientData(DEFAULT_PATIENT_DATA);
      setShowPatientModal(false);
      setStatus('Patient added successfully');
    } catch (error) {
      console.error('Error adding patient:', error);
      alert('Failed to save patient: ' + error.message);
    }
  }, [newPatientData, loadPatientsFromLocalStorage]);

  const updatePatient = useCallback(async () => {
    try {
      if (!selectedPatient) return;

      await apiService.updatePatient(selectedPatient.id, newPatientData);
      await loadPatientsFromLocalStorage();
      
      setIsEditingPatient(false);
      setShowPatientFullView(false);
      setStatus('Patient updated successfully');
    } catch (error) {
      console.error('Error updating patient:', error);
      alert('Failed to update patient: ' + error.message);
    }
  }, [selectedPatient, newPatientData, loadPatientsFromLocalStorage]);

  // =============== SPEECH RECOGNITION ===============

  const cleanupSpeechRecognizer = useCallback(() => {
    try {
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
          recognizerRef.current.stopContinuousRecognitionAsync(
            () => {
              console.log('Speech recognizer stopped');
              if (recognizerRef.current) {
                recognizerRef.current.dispose();
                recognizerRef.current = null;
              }
            },
            (error) => {
              console.error('Error stopping recognizer:', error);
              if (recognizerRef.current) {
                try {
                  recognizerRef.current.dispose();
                } catch (disposeError) {
                  console.error('Error disposing recognizer:', disposeError);
                }
                recognizerRef.current = null;
              }
            }
          );
        } catch (stopError) {
          console.error('Error in stop process:', stopError);
          recognizerRef.current = null;
        }
      }
      
      if (audioConfigRef.current) {
        try {
          audioConfigRef.current.close();
        } catch (closeError) {
          console.error('Error closing audio config:', closeError);
        }
        audioConfigRef.current = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!authService?.hasPermission('scribe')) {
        setStatus('You do not have permission to record');
        return;
      }

      const { speechKey, speechRegion } = apiSettings;
      
      if (!speechKey?.trim() || !speechRegion?.trim()) {
        setStatus('Please configure Azure Speech settings first');
        setActiveTab('settings');
        return;
      }

      if (isRecording || isPaused) {
        setStatus('Recording already in progress');
        return;
      }

      setStatus('Requesting microphone access...');
      
      // Request microphone permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.error('Microphone permission error:', permError);
        setStatus('Microphone permission denied. Please allow microphone access and try again.');
        return;
      }
      
      cleanupSpeechRecognizer();
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = SPEECH_CONFIG.language;
      speechConfig.enableDictation();
      
      // Set properties to prevent auto-stop on silence
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        SPEECH_CONFIG.endSilenceTimeoutMs
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        SPEECH_CONFIG.initialSilenceTimeoutMs
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
        SPEECH_CONFIG.segmentationSilenceTimeoutMs
      );
      
      audioConfigRef.current = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfigRef.current);

      // Set up event handlers
      recognizerRef.current.recognizing = (s, e) => {
        try {
          if (e.result?.text) {
            setInterimTranscript(e.result.text);
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
            }
          }
        } catch (error) {
          console.error('Error in recognizing event:', error);
        }
      };

      recognizerRef.current.recognized = (s, e) => {
        try {
          if (e.result?.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text?.trim()) {
            setTranscript(prev => {
              const newText = prev ? prev + ' ' + e.result.text.trim() : e.result.text.trim();
              return newText;
            });
            setInterimTranscript('');
            
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
            }
          }
        } catch (error) {
          console.error('Error in recognized event:', error);
        }
      };

      recognizerRef.current.sessionStarted = (s, e) => {
        console.log('Recording session started');
        setStatus('Recording... Speak now');
      };

      recognizerRef.current.sessionStopped = (s, e) => {
        console.log('Recording session stopped');
        setIsRecording(false);
        setIsPaused(false);
        setStatus('Recording session ended');
      };

      recognizerRef.current.canceled = (s, e) => {
        try {
          console.error('Recognition canceled:', e.reason, e.errorDetails);
          setIsRecording(false);
          setIsPaused(false);
          
          if (e.reason === SpeechSDK.CancellationReason.Error) {
            if (e.errorCode === SpeechSDK.CancellationErrorCode.ConnectionFailure) {
              setStatus('Connection failed. Check your internet connection.');
            } else if (e.errorCode === SpeechSDK.CancellationErrorCode.AuthenticationFailure) {
              setStatus('Authentication failed. Check your Speech Service key.');
            } else {
              setStatus(`Recognition error: ${e.errorDetails}`);
            }
          }
          cleanupSpeechRecognizer();
        } catch (error) {
          console.error('Error in canceled event:', error);
        }
      };

      // Start continuous recognition
      await new Promise((resolve, reject) => {
        recognizerRef.current.startContinuousRecognitionAsync(
          () => {
            console.log('Continuous recognition started');
            setIsRecording(true);
            setIsPaused(false);
            setRecordingDuration(0);
            setStatus('Recording... Speak now');
            resolve();
          },
          (error) => {
            console.error('Start recording error:', error);
            setIsRecording(false);
            setIsPaused(false);
            setStatus(`Recording failed: ${error}`);
            reject(error);
          }
        );
      });
      
    } catch (error) {
      console.error('Start recording setup error:', error);
      setStatus(`Setup failed: ${error.message}`);
      setIsRecording(false);
      setIsPaused(false);
      cleanupSpeechRecognizer();
    }
  }, [apiSettings, isRecording, isPaused, cleanupSpeechRecognizer]);

  const pauseRecording = useCallback(() => {
    try {
      if (recognizerRef.current && isRecording && !isPaused) {
        recognizerRef.current.stopContinuousRecognitionAsync(
          () => {
            setIsPaused(true);
            setInterimTranscript('');
            setStatus('Recording paused');
            console.log('Recording paused successfully');
          },
          (error) => {
            console.error('Pause failed:', error);
            setStatus('Pause failed: ' + error);
          }
        );
      }
    } catch (error) {
      console.error('Pause recording error:', error);
      setStatus('Error pausing recording');
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(async () => {
    try {
      if (!isPaused) return;
      
      const { speechKey, speechRegion } = apiSettings;
      
      if (!speechKey?.trim() || !speechRegion?.trim()) {
        setStatus('Missing API configuration');
        return;
      }
      
      if (recognizerRef.current) {
        recognizerRef.current.dispose();
        recognizerRef.current = null;
      }
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = SPEECH_CONFIG.language;
      speechConfig.enableDictation();
      
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        SPEECH_CONFIG.endSilenceTimeoutMs
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        SPEECH_CONFIG.initialSilenceTimeoutMs
      );
      
      audioConfigRef.current = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfigRef.current);

      recognizerRef.current.recognizing = (s, e) => {
        try {
          if (e.result?.text) {
            setInterimTranscript(e.result.text);
          }
        } catch (error) {
          console.error('Error in recognizing event (resume):', error);
        }
      };

      recognizerRef.current.recognized = (s, e) => {
        try {
          if (e.result?.reason === SpeechSDK.ResultReason.RecognizedSpeech && e.result.text?.trim()) {
            setTranscript(prev => {
              const newText = prev ? prev + ' ' + e.result.text.trim() : e.result.text.trim();
              return newText;
            });
            setInterimTranscript('');
          }
        } catch (error) {
          console.error('Error in recognized event (resume):', error);
        }
      };

      await new Promise((resolve, reject) => {
        recognizerRef.current.startContinuousRecognitionAsync(
          () => {
            setIsPaused(false);
            setIsRecording(true);
            setStatus('Recording resumed... Speak now');
            console.log('Recording resumed successfully');
            resolve();
          },
          (error) => {
            console.error('Resume failed:', error);
            setStatus('Resume failed: ' + error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Resume recording error:', error);
      setStatus('Error resuming recording');
    }
  }, [isPaused, apiSettings]);

  const stopRecording = useCallback(() => {
    try {
      if (recognizerRef.current) {
        recognizerRef.current.stopContinuousRecognitionAsync(
          () => {
            console.log('Recording stopped successfully');
            setIsRecording(false);
            setIsPaused(false);
            setInterimTranscript('');
            setRecordingDuration(0);
            setStatus('Recording complete');
            cleanupSpeechRecognizer();
          },
          (error) => {
            console.error('Stop recording error:', error);
            setIsRecording(false);
            setIsPaused(false);
            setInterimTranscript('');
            setRecordingDuration(0);
            setStatus('Recording stopped with error');
            cleanupSpeechRecognizer();
          }
        );
      } else {
        setIsRecording(false);
        setIsPaused(false);
        setInterimTranscript('');
        setRecordingDuration(0);
        setStatus('Recording complete');
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
      setIsPaused(false);
      setInterimTranscript('');
      setRecordingDuration(0);
      setStatus('Error stopping recording');
      cleanupSpeechRecognizer();
    }
  }, [cleanupSpeechRecognizer]);

  const toggleRecording = useCallback(async () => {
    if (!isRecording && !isPaused) {
      await startRecording();
    } else if (isRecording && !isPaused) {
      pauseRecording();
    } else if (isPaused) {
      await resumeRecording();
    }
  }, [isRecording, isPaused, startRecording, pauseRecording, resumeRecording]);

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
      patientContext = `
PATIENT CONTEXT:
Name: ${selectedPatient.firstName || ''} ${selectedPatient.lastName || ''}
DOB: ${selectedPatient.dateOfBirth || 'Not specified'}
Gender: ${selectedPatient.gender || 'Not specified'}
Allergies: ${selectedPatient.allergies || 'NKDA'}
Medical History: ${selectedPatient.medicalHistory || 'No significant medical history recorded'}
Current Medications: ${selectedPatient.medications || 'No current medications recorded'}`;
    } else {
      patientContext = 'PATIENT CONTEXT: No patient selected - generating general medical notes from transcript.';
    }

    const systemPrompt = generateSpecialtyPrompt();

    // Call YOUR backend API instead of OpenAI directly
    const response = await axios.post(
      'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api/generate-notes',
      {
        transcript: transcript,
        patientContext: patientContext,
        systemPrompt: systemPrompt
      },
      {
        timeout: 30000
      }
    );

    if (!response.data?.notes) {
      throw new Error('Invalid response from API');
    }

    const cleanedNotes = cleanMarkdownFormatting(response.data.notes);
    
    setMedicalNotes(cleanedNotes);
    setStatus(selectedPatient ? 'Medical notes generated successfully' : 'Medical notes generated - Select patient to save');
    
  } catch (error) {
    console.error('AI generation error:', error);
    let errorMessage = 'Failed to generate notes: ';
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Request timed out. Please try again.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Authentication failed.';
    } else if (error.message) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Unknown error occurred';
    }
    
    setStatus(errorMessage);
  } finally {
    setIsProcessing(false);
  }
}, [transcript, selectedPatient, trainingData, generateSpecialtyPrompt]);

  const saveVisit = useCallback(async () => {
    try {
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
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        transcript: transcript || '',
        notes: medicalNotes,
        specialty: trainingData.specialty,
        noteType: trainingData.noteType,
        createdBy: currentUser?.name || 'Unknown'
      };

      await apiService.createVisit(selectedPatient.id, visit);
      await loadPatientsFromLocalStorage();
      
      // Clear the session after saving
      setTranscript('');
      setInterimTranscript('');
      setMedicalNotes('');
      setStatus('Visit saved - Ready for next patient');
    } catch (error) {
      console.error('Save visit error:', error);
      setStatus('Failed to save visit: ' + (error.message || 'Unknown error'));
    }
  }, [medicalNotes, selectedPatient, transcript, loadPatientsFromLocalStorage, trainingData, currentUser]);

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
        addedBy: currentUser?.name || 'Unknown'
      };

      const updatedData = {
        ...trainingData,
        baselineNotes: [...(trainingData.baselineNotes || []), newNote].slice(-5)
      };

      saveTrainingData(updatedData);
      setUploadedNoteText('');
      alert('Baseline note added successfully!');
    } catch (error) {
      console.error('Error adding baseline note:', error);
      alert('Failed to add baseline note. Please try again.');
    }
  }, [uploadedNoteText, trainingData, currentUser, saveTrainingData]);

  const removeBaselineNote = useCallback((noteId) => {
    try {
      const updatedData = {
        ...trainingData,
        baselineNotes: (trainingData.baselineNotes || []).filter(note => note.id !== noteId)
      };
      saveTrainingData(updatedData);
    } catch (error) {
      console.error('Error removing baseline note:', error);
      alert('Failed to remove baseline note. Please try again.');
    }
  }, [trainingData, saveTrainingData]);

  // =============== SETTINGS HANDLERS ===============

  const saveApiSettings = useCallback(async (settings) => {
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
      await apiService.saveApiSettings(validatedSettings);
      
      if (validatedSettings.speechKey && validatedSettings.openaiKey) {
        setStatus('API settings saved - Ready to begin');
      } else {
        setStatus('API settings saved - Please configure all required keys');
      }
    } catch (error) {
      console.error('Error saving API settings:', error);
      setStatus('Failed to save API settings: ' + error.message);
    }
  }, []);

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
              
              {activeTab === 'training' && (
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
              
              {activeTab === 'settings' && (
                <SettingsPage
                  apiSettings={apiSettings}
                  setApiSettings={setApiSettings}
                  showApiKeys={showApiKeys}
                  setShowApiKeys={setShowApiKeys}
                  onSaveSettings={saveApiSettings}
                />
              )}
              
              {activeTab === 'users' && (
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

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';
import authService from './authService';
import './App.css';

// Move static data outside component to prevent recreation
const MEDICAL_SPECIALTIES = {
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
  obesity_medicine: {
    name: 'Obesity Medicine',
    noteTypes: {
      initial_consultation: 'Initial Weight Management Consultation',
      follow_up: 'Weight Management Follow-up',
      medication_management: 'Obesity Medication Management',
      bariatric_eval: 'Pre-Bariatric Surgery Evaluation',
      lifestyle_counseling: 'Lifestyle Modification Counseling'
    }
  },
  registered_dietitian: {
    name: 'Registered Dietitian',
    noteTypes: {
      nutrition_assessment: 'Nutrition Assessment',
      meal_planning: 'Meal Planning Session',
      follow_up: 'Nutrition Follow-up',
      diabetes_education: 'Diabetes Nutrition Education',
      weight_management: 'Weight Management Counseling'
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

const SPECIALTY_INSTRUCTIONS = {
  internal_medicine: 'Focus on comprehensive assessment, chronic disease management, and preventive care. Include vital signs, medication reconciliation, and follow-up planning.',
  obesity_medicine: 'Document BMI, weight trends, comorbidities, current medications, dietary habits, physical activity levels, behavioral modifications, and treatment plan including pharmacotherapy if applicable.',
  registered_dietitian: 'Include anthropometric measurements, dietary intake analysis, nutrient needs assessment, food preferences, barriers to change, education provided, and specific meal planning recommendations.',
  cardiology: 'Emphasize cardiovascular examination, risk stratification, cardiac-specific assessments, and diagnostic test interpretation.',
  emergency_medicine: 'Prioritize acute presentation, triage assessment, disposition planning, and time-sensitive clinical decisions.',
  surgery: 'Detail procedural findings, surgical technique, complications, post-operative orders, and discharge planning.',
  psychiatry: 'Include mental status examination, suicide/violence risk assessment, medication management, and therapeutic planning.',
  pediatrics: 'Consider age-appropriate development, growth parameters, immunization status, family dynamics, and pediatric-specific concerns.'
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h1 style={{ color: 'var(--aayu-coral)' }}>Something went wrong</h1>
          <p>The application encountered an error. Please refresh the page.</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const [patientSearchTerm, setPatientSearchTerm] = useState(''); // New state for scribe patient search
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  // New patient form state - FIXED: renamed to newPatientData
  const [newPatientData, setNewPatientData] = useState({
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
  const [uploadedNoteText, setUploadedNoteText] = useState('');

  // Speech recognition refs
  const recognizerRef = useRef(null);
  const audioConfigRef = useRef(null);
  const timeoutRef = useRef(null);

  // Memoized filtered patients for performance
  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    
    const term = searchTerm.toLowerCase();
    return patients.filter(patient => {
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      const dob = patient.dateOfBirth || '';
      return fullName.includes(term) || dob.includes(term);
    });
  }, [patients, searchTerm]);

  // Filtered patients for scribe dropdown search
  const filteredPatientsForScribe = useMemo(() => {
    if (!patientSearchTerm.trim()) return patients;
    
    const term = patientSearchTerm.toLowerCase();
    return patients.filter(patient => {
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      const dob = patient.dateOfBirth || '';
      return fullName.includes(term) || dob.includes(term);
    });
  }, [patients, patientSearchTerm]);

  // Text cleaning function to remove markdown formatting
  const cleanMarkdownFormatting = useCallback((text) => {
    if (!text || typeof text !== 'string') return text || '';
    
    try {
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
    } catch (error) {
      console.error('Error cleaning markdown:', error);
      return text;
    }
  }, []);

  // Load training data from localStorage
  const loadTrainingData = useCallback(() => {
    try {
      const saved = localStorage.getItem('medicalScribeTraining');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate data structure
        if (parsed && typeof parsed === 'object') {
          setTrainingData({
            specialty: parsed.specialty || 'internal_medicine',
            noteType: parsed.noteType || 'progress_note',
            baselineNotes: Array.isArray(parsed.baselineNotes) ? parsed.baselineNotes : [],
            customTemplates: parsed.customTemplates || {}
          });
        }
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
      // Reset to defaults on error
      setTrainingData({
        specialty: 'internal_medicine',
        noteType: 'progress_note',
        baselineNotes: [],
        customTemplates: {}
      });
    }
  }, []);

  // Save training data to localStorage
  const saveTrainingData = useCallback((data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid training data');
      }
      localStorage.setItem('medicalScribeTraining', JSON.stringify(data));
      setTrainingData(data);
    } catch (error) {
      console.error('Failed to save training data:', error);
      setStatus('Warning: Failed to save training data');
    }
  }, []);

  // Add baseline note with validation
  const addBaselineNote = useCallback(() => {
    try {
      if (!uploadedNoteText?.trim()) {
        alert('Please enter a note before adding it to baseline');
        return;
      }

      if (!currentUser?.name) {
        alert('User information not available');
        return;
      }

      const newNote = {
        id: Date.now(),
        content: cleanMarkdownFormatting(uploadedNoteText.trim()),
        specialty: trainingData.specialty,
        noteType: trainingData.noteType,
        dateAdded: new Date().toISOString(),
        addedBy: currentUser.name
      };

      const updatedData = {
        ...trainingData,
        baselineNotes: [...trainingData.baselineNotes, newNote].slice(-5) // Keep only last 5 notes
      };

      saveTrainingData(updatedData);
      setUploadedNoteText('');
      alert('Baseline note added successfully!');
    } catch (error) {
      console.error('Error adding baseline note:', error);
      alert('Failed to add baseline note. Please try again.');
    }
  }, [uploadedNoteText, trainingData, currentUser, saveTrainingData, cleanMarkdownFormatting]);

  // Remove baseline note
  const removeBaselineNote = useCallback((noteId) => {
    try {
      const updatedData = {
        ...trainingData,
        baselineNotes: trainingData.baselineNotes.filter(note => note.id !== noteId)
      };
      saveTrainingData(updatedData);
    } catch (error) {
      console.error('Error removing baseline note:', error);
      alert('Failed to remove baseline note. Please try again.');
    }
  }, [trainingData, saveTrainingData]);

  // Generate specialty-specific prompt
  const generateSpecialtyPrompt = useCallback(() => {
    try {
      const specialty = MEDICAL_SPECIALTIES[trainingData.specialty];
      if (!specialty) {
        throw new Error(`Unknown specialty: ${trainingData.specialty}`);
      }
      
      const noteTypeName = specialty.noteTypes[trainingData.noteType];
      if (!noteTypeName) {
        throw new Error(`Unknown note type: ${trainingData.noteType}`);
      }
      
      let baselineContext = '';
      if (trainingData.baselineNotes?.length > 0) {
        const relevantNotes = trainingData.baselineNotes
          .filter(note => note?.specialty === trainingData.specialty && note?.noteType === trainingData.noteType)
          .slice(-3); // Use last 3 relevant notes
        
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
- ABSOLUTELY NO markdown formatting: no *, **, _, __, #, ##, [], (), or any special characters for formatting
- Use ONLY plain text with standard punctuation
- Headers should be in ALL CAPS followed by a colon
- Use simple bullet points with hyphens (-) when listing items
- No numbered lists unless clinically appropriate
- Keep sentences concise and medically accurate

SPECIALTY REQUIREMENTS:
${specialtyInstruction}

REQUIRED DOCUMENTATION STRUCTURE:
CHIEF COMPLAINT: [Brief statement in patient's words]
HISTORY OF PRESENT ILLNESS: [Chronological narrative with timing, quality, severity, associated symptoms]
REVIEW OF SYSTEMS: [Pertinent positives and negatives by system]
PHYSICAL EXAMINATION: [Organized by body systems with specific findings]
ASSESSMENT AND PLAN: [List each problem with specific management plan]

${baselineContext}

INSTRUCTIONS: Convert the transcript into professional medical documentation matching the provider's style from the examples. Focus on clinical accuracy, appropriate medical terminology, and completely clean plain text formatting.`;
    } catch (error) {
      console.error('Error generating specialty prompt:', error);
      return 'You are a medical scribe. Create professional medical notes from the transcript provided. Use plain text formatting only.';
    }
  }, [trainingData]);

  // FIXED: Load patients from localStorage with simplified logic
  const loadPatientsFromLocalStorage = useCallback(() => {
    try {
      const savedPatients = localStorage.getItem('medicalScribePatients');
      if (savedPatients) {
        const patientsData = JSON.parse(savedPatients);
        const patientsWithVisits = patientsData.map(patient => {
          const visitsKey = `visits_${patient.id}`;
          const savedVisits = localStorage.getItem(visitsKey);
          const visits = savedVisits ? JSON.parse(savedVisits) : [];
          return { ...patient, visits };
        });
        setPatients(patientsWithVisits);
      } else {
        setPatients([]);
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
      setPatients([]);
    }
  }, []);

  // Reload patients helper
  const reloadPatients = useCallback(() => {
    loadPatientsFromLocalStorage();
  }, [loadPatientsFromLocalStorage]);

  // Cleanup function for speech recognizer
  const cleanupSpeechRecognizer = useCallback(() => {
    try {
      if (recognizerRef.current) {
        recognizerRef.current.stopContinuousRecognitionAsync(
          () => {
            console.log('Speech recognizer stopped');
            recognizerRef.current = null;
          },
          (error) => {
            console.error('Error stopping recognizer:', error);
            recognizerRef.current = null;
          }
        );
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }, []);

  // Initialize app with proper cleanup
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      try {
        // Check if authService is available
        if (!authService) {
          throw new Error('Authentication service not available');
        }
        
        const user = authService.currentUser;
        if (user) {
          setCurrentUser(user);
          setStatus('Ready to begin');
          await loadPatientsFromLocalStorage();
          loadTrainingData();
        } else {
          setShowLoginModal(true);
        }
        
        // Load API settings safely
        try {
          const savedApiSettings = localStorage.getItem('medicalScribeApiSettings');
          if (savedApiSettings) {
            const parsed = JSON.parse(savedApiSettings);
            if (parsed && typeof parsed === 'object') {
              setApiSettings(prev => ({ ...prev, ...parsed }));
            }
          }
        } catch (apiError) {
          console.warn('Failed to load API settings:', apiError);
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
    };
  }, [loadPatientsFromLocalStorage, loadTrainingData, cleanupSpeechRecognizer]);

  // Authentication handlers with better error handling
  const handleLogin = useCallback((e) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      if (!loginForm.username?.trim() || !loginForm.password?.trim()) {
        setLoginError('Please enter both username and password');
        return;
      }
      
      if (!authService || typeof authService.login !== 'function') {
        setLoginError('Authentication service not available');
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
      
      setCurrentUser(null);
      setPatients([]);
      setSelectedPatient(null);
      setTranscript('');
      setMedicalNotes('');
      setStatus('Please log in to continue');
      setShowLoginModal(true);
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      setCurrentUser(null);
      setShowLoginModal(true);
    }
  }, [cleanupSpeechRecognizer]);

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

      if (!authService || typeof authService.createUser !== 'function') {
        alert('User creation service not available');
        return;
      }

      const result = authService.createUser(newUser);
      setShowCreateUserModal(false);
      setNewUser({ username: '', password: '', confirmPassword: '', name: '', role: 'medical_provider' });
      alert(result.message || 'User creation request logged');
    } catch (error) {
      console.error('Create user error:', error);
      alert('Failed to create user: ' + (error.message || 'Unknown error'));
    }
  }, [newUser]);

  // API settings handler
  const saveApiSettings = useCallback((settings) => {
    try {
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings object');
      }
      
      setApiSettings(settings);
      localStorage.setItem('medicalScribeApiSettings', JSON.stringify(settings));
      
      if (settings.speechKey && settings.openaiKey) {
        setStatus('API settings saved - Ready to begin');
      } else {
        setStatus('API settings saved - Please configure all required keys');
      }
    } catch (error) {
      console.error('Error saving API settings:', error);
      setStatus('Failed to save API settings: ' + error.message);
    }
  }, []);

  // FIXED: Patient management with newPatientData
  const addPatient = useCallback(() => {
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
        id: Date.now(),
        firstName: newPatientData.firstName.trim(),
        lastName: newPatientData.lastName.trim(),
        dateOfBirth: newPatientData.dateOfBirth,
        medicalHistory: newPatientData.medicalHistory?.trim() || '',
        medications: newPatientData.medications?.trim() || '',
        visits: [],
        createdAt: new Date().toISOString()
      };

      // Save directly to localStorage
      const existingPatients = JSON.parse(localStorage.getItem('medicalScribePatients') || '[]');
      existingPatients.push(patient);
      localStorage.setItem('medicalScribePatients', JSON.stringify(existingPatients));
      
      // Reload and update UI
      loadPatientsFromLocalStorage();
      setNewPatientData({ firstName: '', lastName: '', dateOfBirth: '', medicalHistory: '', medications: '' });
      setShowPatientModal(false);
      setStatus('Patient added successfully');
    } catch (error) {
      console.error('Error adding patient:', error);
      alert('Failed to save patient');
    }
  }, [newPatientData, loadPatientsFromLocalStorage]);

  // Recording functions with comprehensive error handling
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
        // Stop the stream immediately as Speech SDK will handle it
        stream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.error('Microphone permission error:', permError);
        setStatus('Microphone permission denied. Please allow microphone access and try again.');
        return;
      }
      
      // Clean up any existing recognizer
      cleanupSpeechRecognizer();
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.enableDictation();
      
      audioConfigRef.current = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfigRef.current);

      recognizerRef.current.recognizing = (s, e) => {
        try {
          if (e.result?.text) {
            setInterimTranscript(e.result.text);
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
          }
        } catch (error) {
          console.error('Error in recognized event:', error);
        }
      };

      recognizerRef.current.sessionStopped = () => {
        try {
          setIsRecording(false);
          setIsPaused(false);
          setStatus('Recording session ended');
        } catch (error) {
          console.error('Error in session stopped event:', error);
        }
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
        } catch (error) {
          console.error('Error in canceled event:', error);
        }
      };

      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          setIsRecording(true);
          setIsPaused(false);
          setStatus('Recording... Speak now');
        },
        (error) => {
          console.error('Start recording error:', error);
          setIsRecording(false);
          setIsPaused(false);
          
          const errorStr = error.toString();
          if (errorStr.includes('1006')) {
            setStatus('Invalid Speech key. Check your Azure Speech Service key.');
          } else if (errorStr.includes('1007')) {
            setStatus('Speech service quota exceeded or region mismatch.');
          } else if (errorStr.includes('1008')) {
            setStatus('Request timeout. Check your internet connection.');
          } else {
            setStatus(`Recording failed: ${error}`);
          }
        }
      );
      
    } catch (error) {
      console.error('Start recording setup error:', error);
      setStatus(`Setup failed: ${error.message}`);
      setIsRecording(false);
      setIsPaused(false);
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
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.enableDictation();
      
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

      recognizerRef.current.startContinuousRecognitionAsync(
        () => {
          setIsPaused(false);
          setIsRecording(true);
          setStatus('Recording resumed... Speak now');
        },
        (error) => {
          console.error('Resume failed:', error);
          setStatus('Resume failed: ' + error);
        }
      );
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
            setIsRecording(false);
            setIsPaused(false);
            setInterimTranscript('');
            setStatus('Recording complete');
            recognizerRef.current = null;
          },
          (error) => {
            console.error('Stop recording error:', error);
            setIsRecording(false);
            setIsPaused(false);
            setInterimTranscript('');
            setStatus('Recording stopped with error');
            recognizerRef.current = null;
          }
        );
      } else {
        setIsRecording(false);
        setIsPaused(false);
        setInterimTranscript('');
        setStatus('Recording complete');
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
      setIsPaused(false);
      setInterimTranscript('');
      setStatus('Error stopping recording');
    }
  }, []);

  // AI note generation with comprehensive error handling
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

      const { openaiEndpoint, openaiKey, openaiDeployment, openaiApiVersion } = apiSettings;

      if (!openaiEndpoint?.trim() || !openaiKey?.trim() || !openaiDeployment?.trim()) {
        setStatus('Please configure Azure OpenAI settings first');
        setActiveTab('settings');
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
Medical History: ${selectedPatient.medicalHistory || 'No significant medical history recorded'}
Current Medications: ${selectedPatient.medications || 'No current medications recorded'}

RECENT VISIT HISTORY:
${selectedPatient.visits?.slice(-3).map(visit => 
  `${visit.date} (${visit.time}): ${(visit.notes || '').substring(0, 200)}...`
).join('\n') || 'No previous visits'}
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
      console.log('Specialty config:', MEDICAL_SPECIALTIES[trainingData.specialty]?.name, '-', MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType]);

      const requestData = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${patientContext}\n\nCURRENT VISIT TRANSCRIPT:\n${transcript}\n\nPlease convert this into a structured ${MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType] || 'medical note'} following the provider's style from the baseline examples.` }
        ],
        max_tokens: 2000,
        temperature: 0.1,  // Lower temperature for more consistent medical documentation
        top_p: 0.9,
        frequency_penalty: 0.1
      };

      const response = await axios.post(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': openaiKey
        },
        timeout: 30000  // 30 second timeout
      });

      console.log('OpenAI response received:', response.status);

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API');
      }

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
        setStatus('Failed to generate notes: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setIsProcessing(false);
    }
  }, [transcript, selectedPatient, apiSettings, trainingData, generateSpecialtyPrompt, cleanMarkdownFormatting]);

  // Save visit with validation
  const saveVisit = useCallback(() => {
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
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        transcript: transcript || '',
        notes: medicalNotes,
        specialty: trainingData.specialty,
        noteType: trainingData.noteType,
        timestamp: new Date().toISOString()
      };

      // Save visit directly to localStorage
      const visitsKey = `visits_${selectedPatient.id}`;
      const existingVisits = JSON.parse(localStorage.getItem(visitsKey) || '[]');
      existingVisits.push(visit);
      localStorage.setItem(visitsKey, JSON.stringify(existingVisits));
      
      reloadPatients();
      
      setStatus('Visit saved successfully');
      
      // Clear the session after saving
      setTranscript('');
      setInterimTranscript('');
      setMedicalNotes('');
      setStatus('Visit saved - Ready for next patient');
    } catch (error) {
      console.error('Save visit error:', error);
      setStatus('Failed to save visit: ' + (error.message || 'Unknown error'));
    }
  }, [medicalNotes, selectedPatient, transcript, reloadPatients, trainingData]);

  // Utility functions
  const getPatientInitials = useCallback((patient) => {
    try {
      const firstName = patient?.firstName || '';
      const lastName = patient?.lastName || '';
      
      if (!firstName && !lastName) return '??';
      
      return (firstName[0] || '') + (lastName[0] || '');
    } catch (error) {
      console.error('Error getting patient initials:', error);
      return '??';
    }
  }, []);

  const getAvatarColor = useCallback((patient) => {
    try {
      const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
      const firstName = patient?.firstName || '';
      const lastName = patient?.lastName || '';
      
      if (!firstName && !lastName) return colors[0];
      
      const charSum = (firstName.charCodeAt(0) || 0) + (lastName.charCodeAt(0) || 0);
      const index = charSum % colors.length;
      return colors[index];
    } catch (error) {
      console.error('Error getting avatar color:', error);
      return '#3498db';
    }
  }, []);

  // Handle patient selection with proper guards
  const handlePatientSelect = useCallback((patientId) => {
    try {
      console.log('Selecting patient:', patientId);
      
      if (!patientId || patientId === '') { 
        setSelectedPatient(null); 
        return; 
      }
      
      const parsedId = parseInt(patientId, 10);
      if (isNaN(parsedId)) {
        console.error('Invalid patient ID:', patientId);
        setSelectedPatient(null);
        return;
      }
      
      const patient = patients.find(p => p?.id === parsedId);
      console.log('Found patient:', patient);
      setSelectedPatient(patient || null);
      setPatientSearchTerm(''); // Clear search when patient is selected
    } catch (error) {
      console.error('Error selecting patient:', error);
      setSelectedPatient(null);
    }
  }, [patients]);

  // Loading screen
  if (isLoading) {
    return (
      <ErrorBoundary>
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
      </ErrorBoundary>
    );
  }

  // Sidebar render function
  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-wrapper">
          <div className="logo-placeholder">AW</div>
        </div>
        <div className="sidebar-title">Aayu Well</div>
        <div className="sidebar-subtitle">AI SCRIBE</div>
        {currentUser && (
          <div style={{ 
            marginTop: '12px', 
            fontSize: '14px', 
            color: 'rgba(255,255,255,0.8)', 
            textAlign: 'center'
          }}>
            {currentUser.name || 'Unknown User'}
            <br />
            <span style={{ fontSize: '12px', color: 'var(--aayu-green-main)' }}>
              {(currentUser.role || '').replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <nav className="sidebar-nav">
        <button 
          className={`nav-button ${activeTab === 'scribe' ? 'active' : ''}`}
          onClick={() => setActiveTab('scribe')}
          disabled={!authService?.hasPermission('scribe')}
          style={{
            opacity: !authService?.hasPermission('scribe') ? 0.5 : 1,
            cursor: !authService?.hasPermission('scribe') ? 'not-allowed' : 'pointer'
          }}
        >
          Scribe
        </button>

        <button 
          className={`nav-button ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
          disabled={!authService?.hasPermission('scribe')}
          style={{
            opacity: !authService?.hasPermission('scribe') ? 0.5 : 1,
            cursor: !authService?.hasPermission('scribe') ? 'not-allowed' : 'pointer'
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

        {authService?.hasPermission('add_users') && (
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

  // Simplified render based on active tab
  const renderActivePage = () => {
    switch (activeTab) {
      case 'scribe':
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">Medical Scribe</h2>
            </div>
            {!authService?.hasPermission('scribe') ? (
              <div className="card">
                <h3 className="card-title">Access Denied</h3>
                <p>You do not have permission to access the scribe functionality.</p>
              </div>
            ) : (
              <>
                {/* AI Configuration Card */}
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
                      backgroundColor: 'var(--aayu-purple-soft)', 
                      borderRadius: '8px',
                      border: '2px solid var(--aayu-purple-main)'
                    }}>
                      <strong>Specialty:</strong><br />
                      {MEDICAL_SPECIALTIES[trainingData.specialty]?.name || 'Unknown'}
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: 'var(--aayu-green-soft)', 
                      borderRadius: '8px',
                      border: '2px solid var(--aayu-green-main)'
                    }}>
                      <strong>Note Type:</strong><br />
                      {MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType] || 'Unknown'}
                    </div>
                    <div style={{ 
                      padding: '12px', 
                      backgroundColor: 'rgba(63, 81, 181, 0.1)', 
                      borderRadius: '8px',
                      border: '2px solid var(--aayu-blue-main)'
                    }}>
                      <strong>Training Notes:</strong><br />
                      {trainingData.baselineNotes?.length || 0} examples
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

                {/* Patient Selection with Search */}
                <div className="card">
                  <h3 className="card-title">Patient Selection</h3>
                  
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Search patient by name..."
                        value={patientSearchTerm}
                        onChange={(e) => setPatientSearchTerm(e.target.value)}
                        style={{ marginBottom: '8px' }}
                      />
                      
                      {patientSearchTerm && filteredPatientsForScribe.length > 0 && (
                        <div style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          backgroundColor: 'white',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}>
                          {filteredPatientsForScribe.map(patient => (
                            <div
                              key={patient.id}
                              onClick={() => {
                                setSelectedPatient(patient);
                                setPatientSearchTerm('');
                              }}
                              style={{
                                padding: '10px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f0f0f0',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                            >
                              <strong>{patient.firstName} {patient.lastName}</strong>
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                DOB: {patient.dateOfBirth}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {authService?.hasPermission('add_patients') && (
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
                      backgroundColor: 'var(--aayu-green-soft)', 
                      borderRadius: '8px',
                      border: '2px solid var(--aayu-green-main)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div 
                          className="patient-avatar"
                          style={{ 
                            backgroundColor: getAvatarColor(selectedPatient),
                            width: '40px',
                            height: '40px',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        >
                          {getPatientInitials(selectedPatient)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                          <div style={{ fontSize: '14px', color: 'var(--aayu-grey)' }}>
                            DOB: {selectedPatient.dateOfBirth} | Visits: {selectedPatient.visits?.length || 0}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPatient(null);
                            setPatientSearchTerm('');
                          }}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'var(--aayu-coral)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Clear
                        </button>
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
              </>
            )}
          </div>
        );

      case 'training':
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">AI Training Center</h2>
            </div>
            {!authService?.hasPermission('scribe') ? (
              <div className="card">
                <h3 className="card-title">Access Denied</h3>
                <p>You do not have permission to access the training functionality.</p>
              </div>
            ) : (
              <>
                {/* Training Configuration */}
                <div className="card">
                  <h3 className="card-title">Current Training Configuration</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                      <label className="form-label">Medical Specialty</label>
                      <select 
                        className="form-input"
                        value={trainingData.specialty}
                        onChange={(e) => {
                          const newData = { 
                            ...trainingData, 
                            specialty: e.target.value, 
                            noteType: Object.keys(MEDICAL_SPECIALTIES[e.target.value]?.noteTypes || {})[0] || 'progress_note'
                          };
                          saveTrainingData(newData);
                        }}
                      >
                        {Object.entries(MEDICAL_SPECIALTIES).map(([key, specialty]) => (
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
                        {Object.entries(MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes || {}).map(([key, name]) => (
                          <option key={key} value={key}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ 
                    padding: '16px', 
                    backgroundColor: 'var(--aayu-green-soft)', 
                    borderRadius: '8px',
                    border: '2px solid var(--aayu-green-main)',
                    fontSize: '14px'
                  }}>
                    <strong>Current Settings:</strong> {MEDICAL_SPECIALTIES[trainingData.specialty]?.name} - {MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType]}
                    <br />
                    <strong>Baseline Notes:</strong> {trainingData.baselineNotes?.length || 0} uploaded
                  </div>
                </div>

                {/* Add Baseline Note */}
                <div className="card">
                  <h3 className="card-title">Add Baseline Note</h3>
                  <p style={{ color: 'var(--aayu-grey)', marginBottom: '16px' }}>
                    Upload examples of your preferred note style. The AI will learn from these to match your documentation preferences.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Paste Previous Note (up to 5 notes stored)</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: '200px' }}
                      value={uploadedNoteText}
                      onChange={(e) => setUploadedNoteText(e.target.value)}
                      placeholder={`Paste a ${MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType] || 'medical note'} here...

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
                    disabled={!uploadedNoteText?.trim()}
                  >
                    Add to Baseline
                  </button>
                </div>

                {/* Current Baseline Notes */}
                <div className="card">
                  <h3 className="card-title">Current Baseline Notes ({trainingData.baselineNotes?.length || 0}/5)</h3>
                  
                  {!trainingData.baselineNotes?.length ? (
                    <div className="empty-state">
                      No baseline notes uploaded yet. Add your first example note above.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {trainingData.baselineNotes.map((note, index) => (
                        <div key={note.id} style={{ 
                          border: '2px solid var(--aayu-blue-main)', 
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
                              <div style={{ fontSize: '12px', color: 'var(--aayu-grey)' }}>
                                {MEDICAL_SPECIALTIES[note.specialty]?.name} - {MEDICAL_SPECIALTIES[note.specialty]?.noteTypes[note.noteType]}
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
                            backgroundColor: '#f9fafb', 
                            padding: '12px', 
                            borderRadius: '4px',
                            fontSize: '12px',
                            maxHeight: '150px',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace'
                          }}>
                            {(note.content || '').substring(0, 500)}
                            {(note.content || '').length > 500 && '...'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );

      case 'patients':
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">Patient Management</h2>
              {authService?.hasPermission('add_patients') && (
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
                    
                    <div className="patient-visits">{patient.visits?.length || 0} visits</div>
                  </div>
                ))}
              </div>

              {filteredPatients.length === 0 && (
                <div className="empty-state">
                  No patients found. {authService?.hasPermission('add_patients') ? 'Add your first patient to get started.' : 'Contact an administrator to add patients.'}
                </div>
              )}
            </div>
          </div>
        );

      case 'settings':
        return (
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
                
                <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--aayu-grey)' }}>
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

      case 'users':
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">User Management</h2>
            </div>

            <div className="card">
              <h3 className="card-title">System Users</h3>
              
              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'var(--aayu-green-soft)', borderRadius: '8px', border: '2px solid var(--aayu-green-main)' }}>
                <strong>Current Users:</strong>
                <div style={{ marginTop: '8px' }}>
                  • darshan@aayuwell.com - Dr. Darshan Patel (Super Admin)<br />
                  • admin - Admin User (Admin)<br />
                  • doctor - Dr. Provider (Medical Provider)<br />
                  • staff - Support Staff (Support Staff)
                </div>
              </div>

              <button 
                className="btn btn-success"
                onClick={() => setShowCreateUserModal(true)}
              >
                Add New User
              </button>
              
              <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(63, 81, 181, 0.05)', borderRadius: '8px', fontSize: '14px', color: 'var(--aayu-grey)' }}>
                <strong>Note:</strong> User creation is currently in demo mode. Contact your IT administrator to permanently add users.
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">Page Not Found</h2>
            </div>
            <div className="card">
              <p>The requested page could not be found.</p>
            </div>
          </div>
        );
    }
  };

  // Main render
  return (
    <ErrorBoundary>
      <div className="app-container">
        {currentUser && renderSidebar()}
        
        <main className="main-content">
          {currentUser ? renderActivePage() : (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100vh',
              backgroundColor: '#f9fafb'
            }}>
              <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                <h3>Please log in to continue</h3>
                <button className="btn btn-primary" onClick={() => setShowLoginModal(true)}>
                  Login
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Modals */}
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
                backgroundColor: 'var(--aayu-green-soft)',
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
                  value={newPatientData.firstName}
                  onChange={(e) => setNewPatientData({...newPatientData, firstName: e.target.value})}
                  placeholder="Enter first name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input
                  type="text" 
                  className="form-input"
                  value={newPatientData.lastName}
                  onChange={(e) => setNewPatientData({...newPatientData, lastName: e.target.value})}
                  placeholder="Enter last name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input
                  type="date" 
                  className="form-input"
                  value={newPatientData.dateOfBirth}
                  onChange={(e) => setNewPatientData({...newPatientData, dateOfBirth: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Medical History</label>
                <textarea
                  className="form-textarea"
                  value={newPatientData.medicalHistory}
                  onChange={(e) => setNewPatientData({...newPatientData, medicalHistory: e.target.value})}
                  placeholder="Enter relevant medical history..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Medications</label>
                <textarea
                  className="form-textarea"
                  value={newPatientData.medications}
                  onChange={(e) => setNewPatientData({...newPatientData, medications: e.target.value})}
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
      </div>
    </ErrorBoundary>
  );
}

export default App;

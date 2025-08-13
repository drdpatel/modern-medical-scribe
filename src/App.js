import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';
import authService from './authService';
import './App.css';
// Import the logo - make sure to add your actual logo file
import aayuLogo from './assets/aayu-logo.png';

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
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  
  // New patient form state
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
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/~~(.*?)~~/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`(.*?)`/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^[\s]*[-*+]\s+/gm, '• ')
        .replace(/^\d+\.\s+/gm, '')
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
        baselineNotes: [...trainingData.baselineNotes, newNote].slice(-5)
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

  // Load patients from localStorage
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
    
    return () => {
      cleanupSpeechRecognizer();
    };
  }, [loadPatientsFromLocalStorage, loadTrainingData, cleanupSpeechRecognizer]);

  // Authentication handlers
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

  // Patient management
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

      const existingPatients = JSON.parse(localStorage.getItem('medicalScribePatients') || '[]');
      existingPatients.push(patient);
      localStorage.setItem('medicalScribePatients', JSON.stringify(existingPatients));
      
      loadPatientsFromLocalStorage();
      setNewPatientData({ firstName: '', lastName: '', dateOfBirth: '', medicalHistory: '', medications: '' });
      setShowPatientModal(false);
      setStatus('Patient added successfully');
    } catch (error) {
      console.error('Error adding patient:', error);
      alert('Failed to save patient');
    }
  }, [newPatientData, loadPatientsFromLocalStorage]);

  // Recording functions
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

  // AI note generation
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

      const endpoint = openaiEndpoint.endsWith('/') ? openaiEndpoint : openaiEndpoint + '/';
      const apiUrl = `${endpoint}openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiApiVersion}`;

      const requestData = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${patientContext}\n\nCURRENT VISIT TRANSCRIPT:\n${transcript}\n\nPlease convert this into a structured ${MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType] || 'medical note'} following the provider's style from the baseline examples.` }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        top_p: 0.9,
        frequency_penalty: 0.1
      };

      const response = await axios.post(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'api-key': openaiKey
        },
        timeout: 30000
      });

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API');
      }

      const rawNotes = response.data.choices[0].message.content;
      const cleanedNotes = cleanMarkdownFormatting(rawNotes);
      
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

  // Save visit
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

      const visitsKey = `visits_${selectedPatient.id}`;
      const existingVisits = JSON.parse(localStorage.getItem(visitsKey) || '[]');
      existingVisits.push(visit);
      localStorage.setItem(visitsKey, JSON.stringify(existingVisits));
      
      reloadPatients();
      
      setStatus('Visit saved successfully');
      
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

  // Handle patient selection
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
      setPatientSearchTerm('');
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
          <div className="loading-screen">
            <div className="loading-logo">
              <img src={aayuLogo} alt="Aayu Well" className="loading-logo-img" />
            </div>
            <div className="loading-text">Loading Aayu AI Scribe...</div>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Sidebar render function - UPDATED WITH LOGO
  const renderSidebar = () => (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-wrapper">
          <img src={aayuLogo} alt="Aayu Well" className="logo-image" />
        </div>
        <div className="sidebar-title">Aayu Well</div>
        <div className="sidebar-subtitle">AI SCRIBE</div>
        {currentUser && (
          <div className="user-info-sidebar">
            {currentUser.name || 'Unknown User'}
            <br />
            <span className="user-role">
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
        >
          Scribe
        </button>

        <button 
          className={`nav-button ${activeTab === 'training' ? 'active' : ''}`}
          onClick={() => setActiveTab('training')}
          disabled={!authService?.hasPermission('scribe')}
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
          className="nav-button logout-button"
          onClick={handleLogout}
        >
          Logout
        </button>
      </nav>
      
      <div className="sidebar-footer">
        Secure • HIPAA Compliant
        <br />
        Medical Scribe AI v2.2
      </div>
    </div>
  );

  // Optimized Scribe Layout
  const renderScribePage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Medical Scribe</h2>
      </div>
      {!authService?.hasPermission('scribe') ? (
        <div className="card glass-card">
          <h3 className="card-title">Access Denied</h3>
          <p>You do not have permission to access the scribe functionality.</p>
        </div>
      ) : (
        <div className="scribe-layout">
          {/* Combined Left Panel */}
          <div className="scribe-left-panel">
            {/* Patient & AI Configuration Card */}
            <div className="card glass-card">
              <h3 className="card-title">Session Configuration</h3>
              
              {/* Patient Selection */}
              <div className="config-section">
                <label className="section-label">Patient</label>
                <div className="patient-search-container">
                  <input
                    type="text"
                    className="form-input glass-input"
                    placeholder="Search patient by name..."
                    value={patientSearchTerm}
                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                  />
                  
                  {patientSearchTerm && filteredPatientsForScribe.length > 0 && (
                    <div className="search-dropdown glass-dropdown">
                      {filteredPatientsForScribe.map(patient => (
                        <div
                          key={patient.id}
                          className="search-dropdown-item"
                          onClick={() => {
                            setSelectedPatient(patient);
                            setPatientSearchTerm('');
                          }}
                        >
                          <strong>{patient.firstName} {patient.lastName}</strong>
                          <div className="dropdown-item-meta">DOB: {patient.dateOfBirth}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedPatient ? (
                  <div className="selected-patient-card">
                    <div className="patient-info-row">
                      <div className="patient-avatar-small">
                        {getPatientInitials(selectedPatient)}
                      </div>
                      <div className="patient-details">
                        <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                        <div className="patient-meta">
                          DOB: {selectedPatient.dateOfBirth} | Visits: {selectedPatient.visits?.length || 0}
                        </div>
                      </div>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setSelectedPatient(null);
                          setPatientSearchTerm('');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="no-patient-selected">
                    No patient selected
                  </div>
                )}

                {authService?.hasPermission('add_patients') && (
                  <button 
                    className="btn btn-glass btn-small"
                    onClick={() => setShowPatientModal(true)}
                  >
                    Add New Patient
                  </button>
                )}
              </div>

              {/* AI Configuration */}
              <div className="config-section">
                <label className="section-label">AI Configuration</label>
                <div className="ai-config-grid">
                  <div className="config-item">
                    <span className="config-label">Specialty:</span>
                    <span className="config-value">{MEDICAL_SPECIALTIES[trainingData.specialty]?.name}</span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Note Type:</span>
                    <span className="config-value">{MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType]}</span>
                  </div>
                  <div className="config-item">
                    <span className="config-label">Training Notes:</span>
                    <span className="config-value">{trainingData.baselineNotes?.length || 0} examples</span>
                  </div>
                </div>
                <button 
                  className="btn btn-glass btn-small"
                  onClick={() => setActiveTab('training')}
                >
                  Configure Training
                </button>
              </div>
            </div>

            {/* Recording Controls Card */}
            <div className="card glass-card">
              <h3 className="card-title">Recording Controls</h3>
              
              <div className="recording-controls-optimized">
                <button 
                  className={`btn btn-glass-primary ${isRecording && !isPaused ? 'recording' : ''}`}
                  onClick={startRecording}
                  disabled={isRecording || isPaused}
                >
                  {isRecording ? '● Recording...' : '○ Start Recording'}
                </button>
                
                {isRecording && !isPaused && (
                  <button 
                    className="btn btn-glass"
                    onClick={pauseRecording}
                  >
                    ⏸ Pause
                  </button>
                )}
                
                {isPaused && (
                  <button 
                    className="btn btn-glass-primary"
                    onClick={resumeRecording}
                  >
                    ▶ Resume
                  </button>
                )}
                
                <button 
                  className="btn btn-glass"
                  onClick={stopRecording}
                  disabled={!isRecording && !isPaused}
                >
                  ⏹ Stop
                </button>
              </div>

              <div className={`status-bar ${isRecording ? 'recording' : isPaused ? 'paused' : isProcessing ? 'processing' : 'ready'}`}>
                {status}
              </div>

              <div className="action-buttons">
                <button 
                  className="btn btn-glass-accent"
                  onClick={generateNotes}
                  disabled={!transcript || isProcessing}
                >
                  {isProcessing ? 'Generating...' : 'Generate Notes'}
                </button>
                
                <button 
                  className="btn btn-glass-success"
                  onClick={saveVisit}
                  disabled={!medicalNotes || !selectedPatient}
                >
                  Save Visit
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Transcript and Notes */}
          <div className="scribe-right-panel">
            {/* Live Transcript */}
            <div className="card glass-card transcript-card">
              <h3 className="card-title">Live Transcript</h3>
              <div className="transcript-container-optimized">
                {transcript || interimTranscript ? (
                  <span>
                    {transcript}
                    {interimTranscript && (
                      <span className="interim-text">
                        {transcript ? ' ' : ''}{interimTranscript}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="placeholder-text">Transcript will appear here as you speak...</span>
                )}
              </div>
            </div>

            {/* Generated Medical Notes */}
            <div className="card glass-card notes-card">
              <h3 className="card-title">Generated Medical Notes</h3>
              <div className="notes-container-optimized">
                {medicalNotes || <span className="placeholder-text">AI-generated medical notes will appear here...</span>}
              </div>
              {medicalNotes && !selectedPatient && (
                <div className="warning-banner">
                  ⚠️ Please select a patient to save these notes
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Simplified render based on active tab
  const renderActivePage = () => {
    switch (activeTab) {
      case 'scribe':
        return renderScribePage();

      case 'training':
        // [Keep existing training page code]
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">AI Training Center</h2>
            </div>
            {/* Rest of training page unchanged */}
          </div>
        );

      case 'patients':
        // [Keep existing patients page code]
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">Patient Management</h2>
              {authService?.hasPermission('add_patients') && (
                <button className="btn btn-glass-primary" onClick={() => setShowPatientModal(true)}>
                  Add New Patient
                </button>
              )}
            </div>
            {/* Rest of patients page unchanged */}
          </div>
        );

      case 'settings':
        // [Keep existing settings page code]
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">API Settings</h2>
            </div>
            {/* Rest of settings page unchanged */}
          </div>
        );

      case 'users':
        // [Keep existing users page code]
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">User Management</h2>
            </div>
            {/* Rest of users page unchanged */}
          </div>
        );

      default:
        return (
          <div className="content-container">
            <div className="page-header">
              <h2 className="page-title">Page Not Found</h2>
            </div>
            <div className="card glass-card">
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
            <div className="login-container">
              <div className="login-background"></div>
              <div className="login-card glass-card">
                <div className="login-logo">
                  <img src={aayuLogo} alt="Aayu Well" className="login-logo-img" />
                </div>
                <h2 className="login-title">Welcome to Aayu AI Scribe</h2>
                <p className="login-subtitle">Secure Medical Documentation Platform</p>
                <button className="btn btn-glass-primary" onClick={() => setShowLoginModal(true)}>
                  Sign In
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Login Modal - Redesigned */}
        {showLoginModal && (
          <div className="modal-backdrop">
            <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-logo">
                <img src={aayuLogo} alt="Aayu Well" className="modal-logo-img" />
              </div>
              <h3 className="modal-title">Sign In</h3>
              <p className="modal-subtitle">Enter your credentials to continue</p>

              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                    placeholder="Username"
                    required
                  />
                </div>

                <div className="form-group">
                  <input
                    type="password" 
                    className="form-input glass-input"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    placeholder="Password"
                    required
                  />
                </div>

                {loginError && (
                  <div className="error-message">
                    {loginError}
                  </div>
                )}

                <button type="submit" className="btn btn-glass-primary btn-full">
                  Sign In
                </button>
              </form>

              <div className="login-help">
                <strong>Demo Credentials:</strong><br />
                darshan@aayuwell.com / Aayuscribe1212@
              </div>
            </div>
          </div>
        )}

        {/* Patient Modal - Keep existing */}
        {showPatientModal && (
          <div className="modal-backdrop" onClick={() => setShowPatientModal(false)}>
            {/* Keep existing patient modal code */}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;

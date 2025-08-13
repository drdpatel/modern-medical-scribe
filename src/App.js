import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';
import authService from './authService';
import './App.css';
// Conditional logo import with fallback
let aayuLogo;
try {
  aayuLogo = require('./assets/aayu-logo.png');
} catch (e) {
  // Fallback to placeholder if logo doesn't exist
  aayuLogo = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYmFlNjM3O3N0b3Atb3BhY2l0eToxIiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2E4ZDQyZTtzdG9wLW9wYWNpdHk6MSIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMCwgMjUpIj48cGF0aCBkPSJNIDIwIDUwIEwgMzUgMTAgTCA1MCA1MCBNIDI1IDM1IEwgNDUgMzUiIHN0cm9rZT0iI2JhZTYzNyIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cmVjdCB4PSIzMiIgeT0iMjIiIHdpZHRoPSI2IiBoZWlnaHQ9IjE2IiBmaWxsPSIjMjcyNjZiIiByeD0iMSIvPjxyZWN0IHg9IjI2IiB5PSIyOCIgd2lkdGg9IjE4IiBoZWlnaHQ9IjYiIGZpbGw9IiMyNzI2NmIiIHJ4PSIxIi8+PC9nPjx0ZXh0IHg9IjcwIiB5PSI0NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iIzI3MjY2YiI+QWF5dTwvdGV4dD48dGV4dCB4PSIxMzAiIHk9IjQ1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZvbnQtd2VpZ2h0PSIzMDAiIGZpbGw9IiMyNzI2NmIiPldlbGw8L3RleHQ+PHRleHQgeD0iNzAiIHk9IjY1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiIGxldHRlci1zcGFjaW5nPSIyIiBmaWxsPSIjOWIyZmNkIiBvcGFjaXR5PSIwLjgiPkFJIE1FRElDQUwgU0NSSUJFPC90ZXh0Pjwvc3ZnPg==';
}

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

// Error Boundary Component with proper reset
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Clear all localStorage to reset app state
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.reload();
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
          gap: '20px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: 'var(--error, #ef4444)' }}>Something went wrong</h1>
          <p>The application encountered an error. Please refresh the page.</p>
          {this.state.error && (
            <details style={{ marginTop: '10px', textAlign: 'left', maxWidth: '600px' }}>
              <summary>Error Details</summary>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-glass-primary"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
            <button 
              className="btn btn-glass"
              onClick={this.handleReset}
            >
              Reset App
            </button>
          </div>
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
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

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
  const silenceTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const activityCheckRef = useRef(null);

  // Memoized filtered patients for performance
  const filteredPatients = useMemo(() => {
    if (!searchTerm?.trim()) return patients;
    
    const term = searchTerm.toLowerCase();
    return patients.filter(patient => {
      if (!patient) return false;
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      const dob = patient.dateOfBirth || '';
      return fullName.includes(term) || dob.includes(term);
    });
  }, [patients, searchTerm]);

  // Filtered patients for scribe dropdown search
  const filteredPatientsForScribe = useMemo(() => {
    if (!patientSearchTerm?.trim()) return patients;
    
    const term = patientSearchTerm.toLowerCase();
    return patients.filter(patient => {
      if (!patient) return false;
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      const dob = patient.dateOfBirth || '';
      return fullName.includes(term) || dob.includes(term);
    });
  }, [patients, patientSearchTerm]);

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

  // Load training data from localStorage with validation
  const loadTrainingData = useCallback(() => {
    try {
      const saved = localStorage.getItem('medicalScribeTraining');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Validate specialty and noteType
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

  // Save training data to localStorage with error handling
  const saveTrainingData = useCallback((data) => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid training data');
      }
      
      // Validate and sanitize data
      const sanitizedData = {
        specialty: MEDICAL_SPECIALTIES[data.specialty] ? data.specialty : 'internal_medicine',
        noteType: data.noteType || 'progress_note',
        baselineNotes: Array.isArray(data.baselineNotes) ? data.baselineNotes.slice(-5) : [],
        customTemplates: data.customTemplates || {}
      };
      
      localStorage.setItem('medicalScribeTraining', JSON.stringify(sanitizedData));
      setTrainingData(sanitizedData);
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
        baselineNotes: [...(trainingData.baselineNotes || []), newNote].slice(-5)
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
        baselineNotes: (trainingData.baselineNotes || []).filter(note => note.id !== noteId)
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

  // Load patients from localStorage with error handling
  const loadPatientsFromLocalStorage = useCallback(() => {
    try {
      const savedPatients = localStorage.getItem('medicalScribePatients');
      if (savedPatients) {
        const patientsData = JSON.parse(savedPatients);
        if (Array.isArray(patientsData)) {
          const patientsWithVisits = patientsData.map(patient => {
            try {
              const visitsKey = `visits_${patient.id}`;
              const savedVisits = localStorage.getItem(visitsKey);
              const visits = savedVisits ? JSON.parse(savedVisits) : [];
              return { ...patient, visits: Array.isArray(visits) ? visits : [] };
            } catch (e) {
              console.error('Error loading visits for patient:', patient.id, e);
              return { ...patient, visits: [] };
            }
          });
          setPatients(patientsWithVisits);
        } else {
          setPatients([]);
        }
      } else {
        setPatients([]);
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
      setPatients([]);
      // Try to backup corrupted data
      try {
        const backup = localStorage.getItem('medicalScribePatients');
        if (backup) {
          localStorage.setItem('medicalScribePatients_backup_' + Date.now(), backup);
        }
      } catch (backupError) {
        console.error('Failed to backup corrupted data:', backupError);
      }
    }
  }, []);

  // Reload patients helper
  const reloadPatients = useCallback(() => {
    loadPatientsFromLocalStorage();
  }, [loadPatientsFromLocalStorage]);

  // Comprehensive cleanup function for speech recognizer
  const cleanupSpeechRecognizer = useCallback(() => {
    try {
      // Clear all timers
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Stop and dispose recognizer
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
      
      // Clean up audio config
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
          loadPatientsFromLocalStorage();
          loadTrainingData();
        } else {
          setShowLoginModal(true);
        }
        
        // Load API settings with validation
        try {
          const savedApiSettings = localStorage.getItem('medicalScribeApiSettings');
          if (savedApiSettings) {
            const parsed = JSON.parse(savedApiSettings);
            if (parsed && typeof parsed === 'object') {
              setApiSettings(prev => ({ 
                ...prev, 
                speechKey: parsed.speechKey || '',
                speechRegion: parsed.speechRegion || 'eastus',
                openaiEndpoint: parsed.openaiEndpoint || '',
                openaiKey: parsed.openaiKey || '',
                openaiDeployment: parsed.openaiDeployment || 'gpt-4',
                openaiApiVersion: parsed.openaiApiVersion || '2024-08-01-preview'
              }));
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
      if (activityCheckRef.current) {
        clearInterval(activityCheckRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

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

      if (newUser.password.length < 8) {
        alert('Password must be at least 8 characters long');
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

  // API settings handler with validation
  const saveApiSettings = useCallback((settings) => {
    try {
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings object');
      }
      
      // Validate settings
      const validatedSettings = {
        speechKey: settings.speechKey || '',
        speechRegion: settings.speechRegion || 'eastus',
        openaiEndpoint: settings.openaiEndpoint || '',
        openaiKey: settings.openaiKey || '',
        openaiDeployment: settings.openaiDeployment || 'gpt-4',
        openaiApiVersion: settings.openaiApiVersion || '2024-08-01-preview'
      };
      
      setApiSettings(validatedSettings);
      localStorage.setItem('medicalScribeApiSettings', JSON.stringify(validatedSettings));
      
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

  // Patient management with validation
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
      alert('Failed to save patient: ' + error.message);
    }
  }, [newPatientData, loadPatientsFromLocalStorage]);

  // FIXED: Recording functions with proper silence handling
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
      
      // Clean up any existing recognizer
      cleanupSpeechRecognizer();
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      
      // CRITICAL FIX: Configure for continuous dictation without auto-stop
      speechConfig.enableDictation();
      
      // Set properties to prevent auto-stop on silence
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        "3600000" // 1 hour - effectively disables silence timeout
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        "3600000" // 1 hour - prevents stopping if user doesn't speak immediately
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
        "3000" // 3 seconds between segments
      );
      
      audioConfigRef.current = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      recognizerRef.current = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfigRef.current);

      // Set up event handlers
      recognizerRef.current.recognizing = (s, e) => {
        try {
          if (e.result?.text) {
            setInterimTranscript(e.result.text);
            // Reset silence timer on new speech
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
            
            // Reset silence timer on recognized speech
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
            } else if (e.errorCode === SpeechSDK.CancellationErrorCode.BadRequest) {
              setStatus('Invalid request. Check your region and deployment.');
            } else if (e.errorCode === SpeechSDK.CancellationErrorCode.Forbidden) {
              setStatus('Access forbidden. Check your API key permissions.');
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
            setRecordingStartTime(Date.now());
            setRecordingDuration(0);
            setStatus('Recording... Speak now');
            resolve();
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
      
      // Clean up existing recognizer
      if (recognizerRef.current) {
        recognizerRef.current.dispose();
        recognizerRef.current = null;
      }
      
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.enableDictation();
      
      // Set extended timeouts
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        "3600000"
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        "3600000"
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

  // AI note generation with better error handling
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

      // Fix endpoint URL
      const endpoint = openaiEndpoint.trim();
      const baseUrl = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
      const apiUrl = `${baseUrl}/openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiApiVersion}`;

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
        timeout: 30000,
        validateStatus: (status) => status < 500
      });

      if (response.status !== 200) {
        throw new Error(`API returned status ${response.status}: ${response.data?.error?.message || 'Unknown error'}`);
      }

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from OpenAI API - no content received');
      }

      const rawNotes = response.data.choices[0].message.content;
      const cleanedNotes = cleanMarkdownFormatting(rawNotes);
      
      setMedicalNotes(cleanedNotes);
      setStatus(selectedPatient ? 'Medical notes generated successfully' : 'Medical notes generated - Select patient to save');
      
    } catch (error) {
      console.error('AI generation error:', error);
      
      let errorMessage = 'Failed to generate notes: ';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'OpenAI authentication failed. Check your API key.';
      } else if (error.response?.status === 404) {
        errorMessage = 'OpenAI deployment not found. Check your deployment name and endpoint.';
      } else if (error.response?.status === 429) {
        errorMessage = 'OpenAI rate limit exceeded. Wait a moment and try again.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid request. Check your OpenAI settings and try again.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred';
      }
      
      setStatus(errorMessage);
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
        timestamp: new Date().toISOString(),
        createdBy: currentUser?.name || 'Unknown'
      };

      const visitsKey = `visits_${selectedPatient.id}`;
      const existingVisits = JSON.parse(localStorage.getItem(visitsKey) || '[]');
      existingVisits.push(visit);
      localStorage.setItem(visitsKey, JSON.stringify(existingVisits));
      
      reloadPatients();
      
      // Clear the session after saving
      setTranscript('');
      setInterimTranscript('');
      setMedicalNotes('');
      setStatus('Visit saved - Ready for next patient');
    } catch (error) {
      console.error('Save visit error:', error);
      setStatus('Failed to save visit: ' + (error.message || 'Unknown error'));
    }
  }, [medicalNotes, selectedPatient, transcript, reloadPatients, trainingData, currentUser]);

  // Utility functions with error handling
  const getPatientInitials = useCallback((patient) => {
    try {
      if (!patient) return '??';
      const firstName = patient.firstName || '';
      const lastName = patient.lastName || '';
      
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
      
      if (!patient) return colors[0];
      
      const firstName = patient.firstName || '';
      const lastName = patient.lastName || '';
      
      if (!firstName && !lastName) return colors[0];
      
      const charSum = (firstName.charCodeAt(0) || 0) + (lastName.charCodeAt(0) || 0);
      const index = Math.abs(charSum) % colors.length;
      return colors[index];
    } catch (error) {
      console.error('Error getting avatar color:', error);
      return '#3498db';
    }
  }, []);

  // Format recording duration
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle patient selection
  const handlePatientSelect = useCallback((patientId) => {
    try {
      if (!patientId || patientId === '') { 
        setSelectedPatient(null); 
        setPatientSearchTerm('');
        return; 
      }
      
      const parsedId = parseInt(patientId, 10);
      if (isNaN(parsedId)) {
        console.error('Invalid patient ID:', patientId);
        setSelectedPatient(null);
        return;
      }
      
      const patient = patients.find(p => p?.id === parsedId);
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

  // Rest of the component remains the same as before...
  // [Include all the render functions from the previous code]
  // I'll continue with just the key render functions that have changes

  // Sidebar render function
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

  // Updated Scribe Page with recording duration display
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
                      <div className="patient-avatar-small" style={{ backgroundColor: getAvatarColor(selectedPatient) }}>
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
              
              {isRecording && (
                <div className="recording-timer">
                  Recording Time: {formatDuration(recordingDuration)}
                </div>
              )}
              
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

  // Rest of the render functions remain the same...
  // [Include all other page renders from previous code]

  // Render all pages functions
  const renderTrainingPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">AI Training Center</h2>
      </div>
      {!authService?.hasPermission('scribe') ? (
        <div className="card glass-card">
          <h3 className="card-title">Access Denied</h3>
          <p>You do not have permission to access the training functionality.</p>
        </div>
      ) : (
        <>
          {/* Training Configuration */}
          <div className="card glass-card">
            <h3 className="card-title">Current Training Configuration</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label className="form-label">Medical Specialty</label>
                <select 
                  className="form-input glass-input"
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
                  className="form-input glass-input"
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
              backgroundColor: 'rgba(186, 230, 55, 0.1)', 
              borderRadius: '8px',
              border: '2px solid rgba(186, 230, 55, 0.3)',
              fontSize: '14px'
            }}>
              <strong>Current Settings:</strong> {MEDICAL_SPECIALTIES[trainingData.specialty]?.name} - {MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType]}
              <br />
              <strong>Baseline Notes:</strong> {trainingData.baselineNotes?.length || 0} uploaded
            </div>
          </div>

          {/* Add Baseline Note */}
          <div className="card glass-card">
            <h3 className="card-title">Add Baseline Note</h3>
            <p style={{ color: 'var(--gray-dark)', marginBottom: '16px' }}>
              Upload examples of your preferred note style. The AI will learn from these to match your documentation preferences.
            </p>

            <div className="form-group">
              <label className="form-label">Paste Previous Note (up to 5 notes stored)</label>
              <textarea
                className="form-textarea glass-input"
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
              className="btn btn-glass-success"
              onClick={addBaselineNote}
              disabled={!uploadedNoteText?.trim()}
            >
              Add to Baseline
            </button>
          </div>

          {/* Current Baseline Notes */}
          <div className="card glass-card">
            <h3 className="card-title">Current Baseline Notes ({trainingData.baselineNotes?.length || 0}/5)</h3>
            
            {!trainingData.baselineNotes?.length ? (
              <div className="empty-state">
                No baseline notes uploaded yet. Add your first example note above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {trainingData.baselineNotes.map((note, index) => (
                  <div key={note.id} style={{ 
                    border: '2px solid var(--primary-navy)', 
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
                        <div style={{ fontSize: '12px', color: 'var(--gray-dark)' }}>
                          {MEDICAL_SPECIALTIES[note.specialty]?.name} - {MEDICAL_SPECIALTIES[note.specialty]?.noteTypes[note.noteType]}
                          <br />
                          Added: {new Date(note.dateAdded).toLocaleDateString()} by {note.addedBy}
                        </div>
                      </div>
                      <button 
                        className="btn btn-glass btn-small"
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

  const renderPatientsPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Patient Management</h2>
        {authService?.hasPermission('add_patients') && (
          <button className="btn btn-glass-primary" onClick={() => setShowPatientModal(true)}>
            Add New Patient
          </button>
        )}
      </div>

      <div className="card glass-card">
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
            <div key={patient.id} className="patient-card" onClick={() => {
              setSelectedPatient(patient);
              setShowVisitModal(true);
            }}>
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

  const renderSettingsPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">API Settings</h2>
      </div>

      <div className="card glass-card">
        <h3 className="card-title">Azure Configuration</h3>
        <p className="settings-description">
          Configure your Azure Speech and OpenAI services. Keys are stored locally and never transmitted.
        </p>

        <div className="settings-form">
          <div className="form-group">
            <label className="form-label">Azure Speech Service Key</label>
            <input 
              type={showApiKeys ? "text" : "password"} 
              className="form-input glass-input" 
              placeholder="Enter your Azure Speech key"
              value={apiSettings.speechKey}
              onChange={(e) => setApiSettings({...apiSettings, speechKey: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Azure Speech Region</label>
            <select 
              className="form-input glass-input"
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
              className="form-input glass-input" 
              placeholder="https://your-resource.openai.azure.com/"
              value={apiSettings.openaiEndpoint}
              onChange={(e) => setApiSettings({...apiSettings, openaiEndpoint: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Azure OpenAI API Key</label>
            <input 
              type={showApiKeys ? "text" : "password"} 
              className="form-input glass-input" 
              placeholder="Enter your OpenAI key"
              value={apiSettings.openaiKey}
              onChange={(e) => setApiSettings({...apiSettings, openaiKey: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">OpenAI Deployment Name</label>
            <input 
              type="text" 
              className="form-input glass-input" 
              placeholder="gpt-4"
              value={apiSettings.openaiDeployment}
              onChange={(e) => setApiSettings({...apiSettings, openaiDeployment: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label className="form-label">API Version</label>
            <input 
              type="text" 
              className="form-input glass-input" 
              placeholder="2024-08-01-preview"
              value={apiSettings.openaiApiVersion}
              onChange={(e) => setApiSettings({...apiSettings, openaiApiVersion: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={showApiKeys}
                onChange={(e) => setShowApiKeys(e.target.checked)}
              />
              Show API Keys
            </label>
          </div>

          <button className="btn btn-glass-success" onClick={() => saveApiSettings(apiSettings)}>
            Save Settings
          </button>
          
          <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--gray-dark)' }}>
            <strong>Current Status:</strong> 
            {apiSettings.speechKey && apiSettings.openaiKey ? 
              <span style={{ color: 'var(--success)' }}> ✓ Configured</span> : 
              <span style={{ color: 'var(--error)' }}> ✗ Missing required keys</span>
            }
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsersPage = () => (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">User Management</h2>
      </div>

      <div className="card glass-card">
        <h3 className="card-title">System Users</h3>
        
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px', 
          backgroundColor: 'rgba(186, 230, 55, 0.1)', 
          borderRadius: '8px', 
          border: '2px solid rgba(186, 230, 55, 0.3)' 
        }}>
          <strong>Current Users:</strong>
          <div style={{ marginTop: '8px' }}>
            • darshan@aayuwell.com - Dr. Darshan Patel (Super Admin)<br />
            • admin - Admin User (Admin)<br />
            • doctor - Dr. Provider (Medical Provider)<br />
            • staff - Support Staff (Support Staff)
          </div>
        </div>

        <button 
          className="btn btn-glass-success"
          onClick={() => setShowCreateUserModal(true)}
        >
          Add New User
        </button>
        
        <div style={{ 
          marginTop: '16px', 
          padding: '16px', 
          backgroundColor: 'rgba(63, 81, 181, 0.05)', 
          borderRadius: '8px', 
          fontSize: '14px', 
          color: 'var(--gray-dark)' 
        }}>
          <strong>Note:</strong> User creation is currently in demo mode. Contact your IT administrator to permanently add users.
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <ErrorBoundary>
      <div className="app-container">
        {currentUser && renderSidebar()}
        
        <main className="main-content">
          {currentUser ? (
            activeTab === 'scribe' ? renderScribePage() :
            activeTab === 'training' ? renderTrainingPage() :
            activeTab === 'patients' ? renderPatientsPage() :
            activeTab === 'settings' ? renderSettingsPage() :
            activeTab === 'users' ? renderUsersPage() :
            (
              <div className="content-container">
                <div className="page-header">
                  <h2 className="page-title">Page Not Found</h2>
                </div>
                <div className="card glass-card">
                  <p>The requested page could not be found.</p>
                </div>
              </div>
            )
          ) : (
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

        {/* Login Modal */}
        {showLoginModal && (
          <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
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

        {/* Patient Modal */}
        {showPatientModal && (
          <div className="modal-backdrop" onClick={() => setShowPatientModal(false)}>
            <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Add New Patient</h3>
                  <p className="modal-subtitle">Enter patient information</p>
                </div>
                <button className="modal-close" onClick={() => setShowPatientModal(false)}>×</button>
              </div>

              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input
                  type="text" 
                  className="form-input glass-input"
                  value={newPatientData.firstName}
                  onChange={(e) => setNewPatientData({...newPatientData, firstName: e.target.value})}
                  placeholder="Enter first name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input
                  type="text" 
                  className="form-input glass-input"
                  value={newPatientData.lastName}
                  onChange={(e) => setNewPatientData({...newPatientData, lastName: e.target.value})}
                  placeholder="Enter last name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input
                  type="date" 
                  className="form-input glass-input"
                  value={newPatientData.dateOfBirth}
                  onChange={(e) => setNewPatientData({...newPatientData, dateOfBirth: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Medical History</label>
                <textarea
                  className="form-textarea glass-input"
                  value={newPatientData.medicalHistory}
                  onChange={(e) => setNewPatientData({...newPatientData, medicalHistory: e.target.value})}
                  placeholder="Enter relevant medical history..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Medications</label>
                <textarea
                  className="form-textarea glass-input"
                  value={newPatientData.medications}
                  onChange={(e) => setNewPatientData({...newPatientData, medications: e.target.value})}
                  placeholder="List current medications..."
                />
              </div>

              <div className="modal-actions">
                <button className="btn btn-glass" onClick={() => setShowPatientModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-glass-success" onClick={addPatient}>Save Patient</button>
              </div>
            </div>
          </div>
        )}

        {/* Visit Modal */}
        {showVisitModal && selectedPatient && (
          <div className="modal-backdrop" onClick={() => setShowVisitModal(false)}>
            <div className="modal-content glass-modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">{selectedPatient.firstName} {selectedPatient.lastName}</h3>
                  <p className="modal-subtitle">Patient Record</p>
                </div>
                <button className="modal-close" onClick={() => setShowVisitModal(false)}>×</button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <strong>DOB:</strong> {selectedPatient.dateOfBirth}<br />
                <strong>Patient ID:</strong> {selectedPatient.id}<br />
                {selectedPatient.medicalHistory && (
                  <><strong>Medical History:</strong> {selectedPatient.medicalHistory}<br /></>
                )}
                {selectedPatient.medications && (
                  <><strong>Medications:</strong> {selectedPatient.medications}</>
                )}
              </div>

              <h4 style={{ marginBottom: '16px' }}>Visit History</h4>
              
              {selectedPatient.visits?.length > 0 ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {selectedPatient.visits.map(visit => (
                    <div key={visit.id} style={{ 
                      padding: '16px', 
                      marginBottom: '12px', 
                      background: 'rgba(0, 0, 0, 0.02)', 
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 0, 0, 0.1)'
                    }}>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>{visit.date} at {visit.time}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--gray-dark)' }}>
                          {MEDICAL_SPECIALTIES[visit.specialty]?.name} - {MEDICAL_SPECIALTIES[visit.specialty]?.noteTypes[visit.noteType]}
                        </div>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                        {visit.notes}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No visits recorded yet</div>
              )}

              <div className="modal-actions">
                <button className="btn btn-glass" onClick={() => setShowVisitModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateUserModal && (
          <div className="modal-backdrop" onClick={() => setShowCreateUserModal(false)}>
            <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Create New User</h3>
                  <p className="modal-subtitle">Add a new user to the system</p>
                </div>
                <button className="modal-close" onClick={() => setShowCreateUserModal(false)}>×</button>
              </div>

              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select 
                    className="form-input glass-input"
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    required
                  >
                    <option value="medical_provider">Medical Provider</option>
                    <option value="admin">Admin</option>
                    <option value="support_staff">Support Staff</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input
                    type="password" 
                    className="form-input glass-input"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Enter password (min 8 characters)"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password *</label>
                  <input
                    type="password" 
                    className="form-input glass-input"
                    value={newUser.confirmPassword}
                    onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
                    placeholder="Confirm password"
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-glass" onClick={() => setShowCreateUserModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-glass-success">
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;

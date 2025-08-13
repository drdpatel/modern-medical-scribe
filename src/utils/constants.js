// Medical Specialties Configuration
export const MEDICAL_SPECIALTIES = {
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

// Specialty-specific documentation instructions
export const SPECIALTY_INSTRUCTIONS = {
  internal_medicine: 'Focus on comprehensive assessment, chronic disease management, and preventive care. Include vital signs, medication reconciliation, and follow-up planning.',
  obesity_medicine: 'Document BMI, weight trends, comorbidities, current medications, dietary habits, physical activity levels, behavioral modifications, and treatment plan including pharmacotherapy if applicable.',
  registered_dietitian: 'Include anthropometric measurements, dietary intake analysis, nutrient needs assessment, food preferences, barriers to change, education provided, and specific meal planning recommendations.',
  cardiology: 'Emphasize cardiovascular examination, risk stratification, cardiac-specific assessments, and diagnostic test interpretation.',
  emergency_medicine: 'Prioritize acute presentation, triage assessment, disposition planning, and time-sensitive clinical decisions.',
  surgery: 'Detail procedural findings, surgical technique, complications, post-operative orders, and discharge planning.',
  psychiatry: 'Include mental status examination, suicide/violence risk assessment, medication management, and therapeutic planning.',
  pediatrics: 'Consider age-appropriate development, growth parameters, immunization status, family dynamics, and pediatric-specific concerns.'
};

// Default training data structure
export const DEFAULT_TRAINING_DATA = {
  specialty: 'internal_medicine',
  noteType: 'progress_note',
  baselineNotes: [],
  customTemplates: {}
};

// Default API settings
export const DEFAULT_API_SETTINGS = {
  speechKey: '',
  speechRegion: 'eastus',
  openaiEndpoint: '',
  openaiKey: '',
  openaiDeployment: 'gpt-4',
  openaiApiVersion: '2024-08-01-preview'
};

// Default patient data structure
export const DEFAULT_PATIENT_DATA = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  emergencyContact: '',
  emergencyPhone: '',
  insurance: '',
  policyNumber: '',
  allergies: '',
  medicalHistory: '',
  medications: '',
  primaryPhysician: '',
  preferredPharmacy: ''
};

// Default user data structure
export const DEFAULT_USER_DATA = {
  username: '',
  password: '',
  confirmPassword: '',
  name: '',
  role: 'medical_provider'
};

// Azure Speech Regions
export const AZURE_SPEECH_REGIONS = [
  { value: 'eastus', label: 'East US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'centralus', label: 'Central US' },
  { value: 'westeurope', label: 'West Europe' }
];

// User Roles
export const USER_ROLES = [
  { value: 'medical_provider', label: 'Medical Provider' },
  { value: 'admin', label: 'Admin' },
  { value: 'support_staff', label: 'Support Staff' },
  { value: 'super_admin', label: 'Super Admin' }
];

// Session Configuration
export const SESSION_CONFIG = {
  timeout: 3600000, // 1 hour
  warningTime: 3300000 // 55 minutes
};

// Speech Recognition Configuration
export const SPEECH_CONFIG = {
  language: 'en-US',
  endSilenceTimeoutMs: '3600000', // 1 hour
  initialSilenceTimeoutMs: '3600000', // 1 hour
  segmentationSilenceTimeoutMs: '3000' // 3 seconds
};

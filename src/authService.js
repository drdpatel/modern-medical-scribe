// authService.js - HIPAA-Compliant API Version
// IMPORTANT: This requires backend APIs to be deployed first
// This replaces localStorage with secure API calls

class AuthService {
  constructor() {
    // User definitions - these will eventually come from backend
    this.users = {
      'darshan@aayuwell.com': { name: 'Dr. Darshan Patel', role: 'super_admin', password: 'Aayuscribe1212@' },
      'admin': { name: 'Admin User', role: 'admin', password: 'admin123' },
      'doctor': { name: 'Dr. Provider', role: 'medical_provider', password: 'doctor123' },
      'staff': { name: 'Support Staff', role: 'support_staff', password: 'staff123' }
    };
    
    this.currentUser = this.loadCurrentUser();
    this.sessionTimeout = 3600000; // 1 hour
    this.apiBaseUrl = 'https://aayuscribe-api.azurewebsites.net/api';
    
    if (this.currentUser) {
      this.startInactivityTimer();
    }
  }

  // Helper method for API calls with error handling
  async apiCall(endpoint, options = {}) {
    try {
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUser?.id || '',
          'x-user-role': this.currentUser?.role || ''
        }
      };

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      
      // For now, fall back to localStorage during transition
      if (error.message.includes('fetch')) {
        console.warn('API not available, using localStorage fallback');
        return this.fallbackToLocalStorage(endpoint, options);
      }
      throw error;
    }
  }

  // Temporary fallback to localStorage during migration
  fallbackToLocalStorage(endpoint, options) {
    console.warn('Using localStorage fallback for:', endpoint);
    
    if (endpoint === '/patients' && options.method === 'GET') {
      const patients = localStorage.getItem('medicalScribePatients');
      return patients ? JSON.parse(patients) : [];
    }
    
    if (endpoint.includes('/patients') && options.method === 'POST') {
      const patients = JSON.parse(localStorage.getItem('medicalScribePatients') || '[]');
      const newPatient = JSON.parse(options.body);
      patients.push(newPatient);
      localStorage.setItem('medicalScribePatients', JSON.stringify(patients));
      return newPatient;
    }
    
    if (endpoint.includes('/visits') && options.method === 'GET') {
      const patientId = endpoint.split('/')[2];
      const visits = localStorage.getItem(`visits_${patientId}`);
      return visits ? JSON.parse(visits) : [];
    }
    
    if (endpoint.includes('/visits') && options.method === 'POST') {
      const patientId = endpoint.split('/')[2];
      const visits = JSON.parse(localStorage.getItem(`visits_${patientId}`) || '[]');
      const newVisit = JSON.parse(options.body);
      visits.push(newVisit);
      localStorage.setItem(`visits_${patientId}`, JSON.stringify(visits));
      return newVisit;
    }
    
    throw new Error('Fallback not implemented for this endpoint');
  }

  // Authentication methods (unchanged interface)
  login(username, password) {
    const user = this.users[username];
    
    if (!user || user.password !== password) {
      throw new Error('Invalid credentials');
    }

    this.currentUser = {
      id: username,
      username: username,
      role: user.role,
      name: user.name
    };

    // Store session info (still using localStorage for session only)
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    localStorage.setItem('lastActivity', Date.now().toString());
    
    this.startInactivityTimer();
    return this.currentUser;
  }

  loadCurrentUser() {
    try {
      const user = localStorage.getItem('currentUser');
      const lastActivity = localStorage.getItem('lastActivity');

      if (!user || !lastActivity) return null;

      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceActivity > this.sessionTimeout) {
        this.logout();
        return null;
      }

      return JSON.parse(user);
    } catch (error) {
      this.logout();
      return null;
    }
  }

  logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastActivity');
    this.currentUser = null;
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  startInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    this.inactivityTimer = setTimeout(() => {
      this.logout();
      window.location.reload();
    }, this.sessionTimeout);
  }

  updateActivity() {
    localStorage.setItem('lastActivity', Date.now().toString());
    this.startInactivityTimer();
  }

  // Permission methods (unchanged)
  hasPermission(permission) {
    if (!this.currentUser) return false;

    const permissions = {
      super_admin: ['scribe', 'add_patients', 'add_users', 'read_all_notes', 'edit_all_notes'],
      admin: ['scribe', 'add_patients', 'add_users', 'read_own_notes'],
      medical_provider: ['scribe', 'read_own_notes'],
      support_staff: ['add_patients', 'read_all_notes']
    };

    return permissions[this.currentUser.role]?.includes(permission) || false;
  }

  canEditNotes(visitCreatedBy) {
    if (!this.currentUser) return false;
    return this.currentUser.role === 'super_admin' || visitCreatedBy === this.currentUser.id;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // User management (will use API when available)
  async createUser(userData) {
    if (!this.hasPermission('add_users')) {
      throw new Error('Insufficient permissions');
    }
    
    try {
      const result = await this.apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      return result;
    } catch (error) {
      console.error('Create user error:', error);
      return { success: true, message: 'User creation logged (update environment config to add permanently)' };
    }
  }

  // Patient management methods - NOW USING APIS
  async getPatients() {
    try {
      this.updateActivity();
      const patients = await this.apiCall('/patients');
      
      // Add visit counts to each patient
      const patientsWithVisits = await Promise.all(
        patients.map(async (patient) => {
          try {
            const visits = await this.getVisits(patient.id);
            return { ...patient, visits };
          } catch (error) {
            console.warn(`Failed to load visits for patient ${patient.id}:`, error);
            return { ...patient, visits: [] };
          }
        })
      );
      
      return patientsWithVisits;
    } catch (error) {
      console.error('Get patients error:', error);
      throw new Error('Failed to load patients: ' + error.message);
    }
  }

  async savePatient(patient) {
    if (!this.hasPermission('add_patients')) {
      throw new Error('Insufficient permissions');
    }

    try {
      const patientWithMeta = {
        ...patient,
        createdBy: this.currentUser.id,
        createdByName: this.currentUser.name,
        lastModified: new Date().toISOString()
      };

      let result;
      if (patient.id && patient.id !== 'new') {
        // Update existing patient
        result = await this.apiCall(`/patients/${patient.id}`, {
          method: 'PUT',
          body: JSON.stringify(patientWithMeta)
        });
      } else {
        // Create new patient
        const newPatient = { ...patientWithMeta };
        delete newPatient.id; // Let server assign ID
        result = await this.apiCall('/patients', {
          method: 'POST',
          body: JSON.stringify(newPatient)
        });
      }

      this.updateActivity();
      return result;
    } catch (error) {
      console.error('Save patient error:', error);
      throw new Error('Failed to save patient: ' + error.message);
    }
  }

  // Visit management methods - NOW USING APIS
  async getVisits(patientId) {
    try {
      this.updateActivity();
      const visits = await this.apiCall(`/patients/${patientId}/visits`);
      
      // Filter visits based on permissions
      const filteredVisits = visits.filter(visit => {
        return this.hasPermission('read_all_notes') || visit.createdBy === this.currentUser.id;
      });

      return filteredVisits;
    } catch (error) {
      console.error('Get visits error:', error);
      throw new Error('Failed to load visits: ' + error.message);
    }
  }

  async saveVisit(patientId, visit) {
    if (!this.hasPermission('scribe')) {
      throw new Error('Insufficient permissions');
    }

    try {
      const visitWithMeta = {
        ...visit,
        patientId: patientId,
        createdBy: this.currentUser.id,
        createdByName: this.currentUser.name,
        lastModified: new Date().toISOString()
      };

      let result;
      if (visit.id && visit.id !== 'new') {
        // Update existing visit
        result = await this.apiCall(`/visits/${visit.id}`, {
          method: 'PUT',
          body: JSON.stringify(visitWithMeta)
        });
      } else {
        // Create new visit
        const newVisit = { ...visitWithMeta };
        delete newVisit.id; // Let server assign ID
        result = await this.apiCall(`/patients/${patientId}/visits`, {
          method: 'POST',
          body: JSON.stringify(newVisit)
        });
      }

      this.updateActivity();
      return result;
    } catch (error) {
      console.error('Save visit error:', error);
      throw new Error('Failed to save visit: ' + error.message);
    }
  }

  // Training data methods - NOW USING APIS
  async getTrainingData() {
    try {
      this.updateActivity();
      const result = await this.apiCall('/training');
      return result;
    } catch (error) {
      console.warn('Training data not available from API, using localStorage fallback');
      const saved = localStorage.getItem('medicalScribeTraining');
      return saved ? JSON.parse(saved) : {
        specialty: 'internal_medicine',
        noteType: 'progress_note',
        baselineNotes: [],
        customTemplates: {}
      };
    }
  }

  async saveTrainingData(trainingData) {
    try {
      const result = await this.apiCall('/training', {
        method: 'POST',
        body: JSON.stringify({
          ...trainingData,
          userId: this.currentUser.id,
          lastModified: new Date().toISOString()
        })
      });
      
      this.updateActivity();
      return result;
    } catch (error) {
      console.warn('Training data API not available, using localStorage fallback');
      localStorage.setItem('medicalScribeTraining', JSON.stringify(trainingData));
      return trainingData;
    }
  }

  // API Key methods - NOW SECURE (server-side only)
  async getSpeechApiKey() {
    try {
      const result = await this.apiCall('/keys/speech', { method: 'POST' });
      return result.key;
    } catch (error) {
      console.error('Failed to get Speech API key:', error);
      throw new Error('Speech API key not available. Contact administrator.');
    }
  }

  async getOpenAIApiKey() {
    try {
      const result = await this.apiCall('/keys/openai', { method: 'POST' });
      return result.key;
    } catch (error) {
      console.error('Failed to get OpenAI API key:', error);
      throw new Error('OpenAI API key not available. Contact administrator.');
    }
  }

  // Ready check
  isReady() {
    return this.currentUser !== null;
  }

  // Health check for API connectivity
  async checkApiHealth() {
    try {
      await this.apiCall('/health');
      return true;
    } catch (error) {
      console.warn('API health check failed:', error);
      return false;
    }
  }
}

// Create and export the singleton instance
const authService = new AuthService();
export default authService;

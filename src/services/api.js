import axios from 'axios';

/**
 * API Service Layer
 * Currently uses localStorage, but designed to easily swap to Flask backend
 * Just change the implementation of these methods when backend is ready
 */

class APIService {
  constructor() {
    // Future: this will be your Flask backend URL
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
    this.useLocalStorage = true; // Toggle this when backend is ready
  }

  // ============== PATIENTS ==============

  async getPatients() {
    if (this.useLocalStorage) {
      try {
        const savedPatients = localStorage.getItem('medicalScribePatients');
        if (savedPatients) {
          const patientsData = JSON.parse(savedPatients);
          if (Array.isArray(patientsData)) {
            // Load visits for each patient
            const patientsWithVisits = patientsData.map(patient => {
              const visitsKey = `visits_${patient.id}`;
              const savedVisits = localStorage.getItem(visitsKey);
              const visits = savedVisits ? JSON.parse(savedVisits) : [];
              return { ...patient, visits: Array.isArray(visits) ? visits : [] };
            });
            return patientsWithVisits;
          }
        }
        return [];
      } catch (error) {
        console.error('Failed to load patients:', error);
        return [];
      }
    } else {
      // Future Flask implementation
      const response = await axios.get(`${this.baseURL}/patients`);
      return response.data;
    }
  }

  async createPatient(patientData) {
    if (this.useLocalStorage) {
      const patient = {
        id: Date.now(),
        ...patientData,
        visits: [],
        createdAt: new Date().toISOString()
      };

      const existingPatients = JSON.parse(localStorage.getItem('medicalScribePatients') || '[]');
      existingPatients.push(patient);
      localStorage.setItem('medicalScribePatients', JSON.stringify(existingPatients));
      return patient;
    } else {
      const response = await axios.post(`${this.baseURL}/patients`, patientData);
      return response.data;
    }
  }

  async updatePatient(patientId, patientData) {
    if (this.useLocalStorage) {
      const existingPatients = JSON.parse(localStorage.getItem('medicalScribePatients') || '[]');
      const patientIndex = existingPatients.findIndex(p => p.id === patientId);
      
      if (patientIndex === -1) {
        throw new Error('Patient not found');
      }

      existingPatients[patientIndex] = {
        ...existingPatients[patientIndex],
        ...patientData,
        id: patientId,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem('medicalScribePatients', JSON.stringify(existingPatients));
      return existingPatients[patientIndex];
    } else {
      const response = await axios.put(`${this.baseURL}/patients/${patientId}`, patientData);
      return response.data;
    }
  }

  async deletePatient(patientId) {
    if (this.useLocalStorage) {
      const existingPatients = JSON.parse(localStorage.getItem('medicalScribePatients') || '[]');
      const filteredPatients = existingPatients.filter(p => p.id !== patientId);
      localStorage.setItem('medicalScribePatients', JSON.stringify(filteredPatients));
      
      // Also delete visits
      localStorage.removeItem(`visits_${patientId}`);
      return { success: true };
    } else {
      const response = await axios.delete(`${this.baseURL}/patients/${patientId}`);
      return response.data;
    }
  }

  // ============== VISITS ==============

  async getVisits(patientId) {
    if (this.useLocalStorage) {
      const visitsKey = `visits_${patientId}`;
      const savedVisits = localStorage.getItem(visitsKey);
      return savedVisits ? JSON.parse(savedVisits) : [];
    } else {
      const response = await axios.get(`${this.baseURL}/patients/${patientId}/visits`);
      return response.data;
    }
  }

  async createVisit(patientId, visitData) {
    if (this.useLocalStorage) {
      const visit = {
        id: Date.now(),
        ...visitData,
        timestamp: new Date().toISOString()
      };

      const visitsKey = `visits_${patientId}`;
      const existingVisits = JSON.parse(localStorage.getItem(visitsKey) || '[]');
      existingVisits.push(visit);
      localStorage.setItem(visitsKey, JSON.stringify(existingVisits));
      return visit;
    } else {
      const response = await axios.post(`${this.baseURL}/patients/${patientId}/visits`, visitData);
      return response.data;
    }
  }

  async updateVisit(patientId, visitId, visitData) {
    if (this.useLocalStorage) {
      const visitsKey = `visits_${patientId}`;
      const existingVisits = JSON.parse(localStorage.getItem(visitsKey) || '[]');
      const visitIndex = existingVisits.findIndex(v => v.id === visitId);
      
      if (visitIndex === -1) {
        throw new Error('Visit not found');
      }

      existingVisits[visitIndex] = {
        ...existingVisits[visitIndex],
        ...visitData,
        id: visitId,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(visitsKey, JSON.stringify(existingVisits));
      return existingVisits[visitIndex];
    } else {
      const response = await axios.put(`${this.baseURL}/patients/${patientId}/visits/${visitId}`, visitData);
      return response.data;
    }
  }

  async deleteVisit(patientId, visitId) {
    if (this.useLocalStorage) {
      const visitsKey = `visits_${patientId}`;
      const existingVisits = JSON.parse(localStorage.getItem(visitsKey) || '[]');
      const filteredVisits = existingVisits.filter(v => v.id !== visitId);
      localStorage.setItem(visitsKey, JSON.stringify(filteredVisits));
      return { success: true };
    } else {
      const response = await axios.delete(`${this.baseURL}/patients/${patientId}/visits/${visitId}`);
      return response.data;
    }
  }

  // ============== TRAINING DATA ==============

  async getTrainingData() {
    if (this.useLocalStorage) {
      const saved = localStorage.getItem('medicalScribeTraining');
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } else {
      const response = await axios.get(`${this.baseURL}/training`);
      return response.data;
    }
  }

  async saveTrainingData(trainingData) {
    if (this.useLocalStorage) {
      localStorage.setItem('medicalScribeTraining', JSON.stringify(trainingData));
      return trainingData;
    } else {
      const response = await axios.post(`${this.baseURL}/training`, trainingData);
      return response.data;
    }
  }

  // ============== API SETTINGS ==============

  async getApiSettings() {
    if (this.useLocalStorage) {
      const saved = localStorage.getItem('medicalScribeApiSettings');
      return saved ? JSON.parse(saved) : null;
    } else {
      const response = await axios.get(`${this.baseURL}/settings`);
      return response.data;
    }
  }

  async saveApiSettings(settings) {
    if (this.useLocalStorage) {
      localStorage.setItem('medicalScribeApiSettings', JSON.stringify(settings));
      return settings;
    } else {
      const response = await axios.post(`${this.baseURL}/settings`, settings);
      return response.data;
    }
  }

  // ============== AI GENERATION ==============

  async generateNotes(requestData) {
    // This should always go to backend when ready (API keys shouldn't be on client)
    if (!this.useLocalStorage) {
      const response = await axios.post(`${this.baseURL}/generate-notes`, requestData);
      return response.data;
    } else {
      // Current implementation - will be moved to backend
      throw new Error('Note generation requires backend implementation');
    }
  }

  // ============== USERS ==============

  async validateUser(username, password) {
    if (this.useLocalStorage) {
      // Current local implementation
      throw new Error('User validation requires backend implementation');
    } else {
      const response = await axios.post(`${this.baseURL}/auth/login`, { username, password });
      return response.data;
    }
  }

  async createUser(userData) {
    if (this.useLocalStorage) {
      // Current local implementation
      throw new Error('User creation requires backend implementation');
    } else {
      const response = await axios.post(`${this.baseURL}/users`, userData);
      return response.data;
    }
  }

  async getUsers() {
    if (this.useLocalStorage) {
      // Return static list for now
      return [
        { username: 'darshan@aayuwell.com', name: 'Dr. Darshan Patel', role: 'super_admin' },
        { username: 'admin', name: 'Admin User', role: 'admin' },
        { username: 'doctor', name: 'Dr. Provider', role: 'medical_provider' },
        { username: 'staff', name: 'Support Staff', role: 'support_staff' }
      ];
    } else {
      const response = await axios.get(`${this.baseURL}/users`);
      return response.data;
    }
  }
}

// Export singleton instance
const apiService = new APIService();
export default apiService;

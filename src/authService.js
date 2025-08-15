// Authentication Service - Uses API endpoints instead of direct Azure Tables
class AuthService {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.apiUrl = 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';
    this.initializationPromise = this.initialize();
  }

  async initialize() {
    try {
      console.log('Initializing AuthService...');
      
      // Load saved user from localStorage if exists
      const savedToken = localStorage.getItem('authToken');
      if (savedToken) {
        const tokenData = JSON.parse(atob(savedToken.split('.')[1]));
        
        // Check if token is still valid (12 hours)
        if (Date.now() < tokenData.exp) {
          this.currentUser = tokenData.user;
          this.isInitialized = true;
          this.startInactivityTimer();
        } else {
          localStorage.removeItem('authToken');
        }
      }
      
      this.isInitialized = true;
      console.log('✅ AuthService initialized');
    } catch (error) {
      console.error('AuthService initialization error:', error);
      this.isInitialized = true; // Still mark as initialized to prevent hanging
    }
  }

  // Wait for initialization
  get ready() {
    return this.initializationPromise;
  }

  // Generate JWT token (simplified)
  generateToken(user) {
    const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'HS256' }));
    const payload = btoa(JSON.stringify({
      user: {
        id: user.rowKey || user.username,
        username: user.username,
        role: user.role,
        name: user.name
      },
      exp: Date.now() + (12 * 60 * 60 * 1000), // 12 hours
      iat: Date.now()
    }));
    return `${header}.${payload}.signature`;
  }

  // Login user
  async login(username, password) {
    try {
      await this.ready;
      
      const response = await fetch(`${this.apiUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const result = await response.json();
      
      // Generate and store token
      const token = this.generateToken(result.user);
      localStorage.setItem('authToken', token);
      localStorage.setItem('lastActivity', Date.now().toString());

      this.currentUser = {
        id: result.user.rowKey || result.user.username,
        username: result.user.username,
        role: result.user.role,
        name: result.user.name
      };

      this.startInactivityTimer();
      return this.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  }

  // Logout user
  logout() {
    this.currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('lastActivity');
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Get auth headers for API calls
  getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-user-id': this.currentUser?.id || '',
      'x-user-role': this.currentUser?.role || '',
      'x-user-name': this.currentUser?.name || ''
    };
  }

  // Update session
  updateSession() {
    localStorage.setItem('lastActivity', Date.now().toString());
  }

  // Start inactivity timer (1 hour)
  startInactivityTimer() {
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
    }

    this.inactivityTimer = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem('lastActivity') || '0');
      const now = Date.now();
      
      if (now - lastActivity > 60 * 60 * 1000) { // 1 hour
        this.logout();
        window.location.reload();
      }
    }, 60000); // Check every minute

    // Update activity on user interaction
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, () => {
        localStorage.setItem('lastActivity', Date.now().toString());
      }, true);
    });
  }

  // Check user permissions
  hasPermission(action) {
    if (!this.currentUser) return false;
    
    const permissions = {
      'Super Admin': ['all'],
      'super_admin': ['all'],
      'Admin': ['manage_users', 'manage_patients', 'scribe', 'view_all_visits', 'add_patients', 'training', 'manage_settings'],
      'admin': ['manage_users', 'manage_patients', 'scribe', 'view_all_visits', 'add_patients', 'training', 'manage_settings'],
      'Medical Provider': ['scribe', 'view_own_visits', 'manage_own_patients', 'add_patients', 'training'],
      'medical_provider': ['scribe', 'view_own_visits', 'manage_own_patients', 'add_patients', 'training'],
      'doctor': ['scribe', 'view_own_visits', 'manage_own_patients', 'add_patients', 'training'],
      'Support Staff': ['view_patients', 'add_patients'],
      'support_staff': ['view_patients', 'add_patients'],
      'clinician': ['scribe', 'view_own_visits', 'manage_own_patients', 'add_patients', 'training']
    };

    const userPermissions = permissions[this.currentUser.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(action);
  }

  // User Management
  async getUsers() {
    try {
      const response = await fetch(`${this.apiUrl}/users`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return await response.json();
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async createUser(userData) {
    try {
      const response = await fetch(`${this.apiUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create', 
          userData,
          createdBy: this.currentUser?.username || 'system'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(userData) {
    try {
      const response = await fetch(`${this.apiUrl}/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      if (!response.ok) throw new Error('Failed to update user');
      return await response.json();
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(username) {
    try {
      const response = await fetch(`${this.apiUrl}/users?username=${username}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete user');
      return await response.json();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Patient Management
  async getPatients() {
    try {
      const response = await fetch(`${this.apiUrl}/patients`);
      if (!response.ok) throw new Error('Failed to fetch patients');
      return await response.json();
    } catch (error) {
      console.error('Error fetching patients:', error);
      return [];
    }
  }

  async savePatient(patientData) {
    try {
      const response = await fetch(`${this.apiUrl}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...patientData,
          createdBy: this.currentUser?.username || 'system'
        })
      });

      if (!response.ok) throw new Error('Failed to save patient');
      return await response.json();
    } catch (error) {
      console.error('Error saving patient:', error);
      throw error;
    }
  }

  async updatePatient(patientData) {
    try {
      const response = await fetch(`${this.apiUrl}/patients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData)
      });

      if (!response.ok) throw new Error('Failed to update patient');
      return await response.json();
    } catch (error) {
      console.error('Error updating patient:', error);
      throw error;
    }
  }

  // Visit Management
  async getVisits(patientId) {
    try {
      const response = await fetch(`${this.apiUrl}/visits?patientId=${patientId}`);
      if (!response.ok) throw new Error('Failed to fetch visits');
      return await response.json();
    } catch (error) {
      console.error('Error fetching visits:', error);
      return [];
    }
  }

  async saveVisit(patientId, visitData) {
    try {
      const response = await fetch(`${this.apiUrl}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...visitData,
          patientId,
          createdBy: this.currentUser?.username || 'system',
          createdByName: this.currentUser?.name || 'System'
        })
      });

      if (!response.ok) throw new Error('Failed to save visit');
      return await response.json();
    } catch (error) {
      console.error('Error saving visit:', error);
      throw error;
    }
  }

  // Load current user from localStorage
  async loadCurrentUser() {
    try {
      await this.ready;
      
      if (!this.isInitialized) {
        console.log('AuthService not initialized');
        return null;
      }

      const token = localStorage.getItem('authToken');
      
      if (!token) {
        return null;
      }

      // Parse token
      try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        
        // Check expiration
        if (Date.now() >= tokenData.exp) {
          this.logout();
          return null;
        }

        this.currentUser = tokenData.user;
        this.startInactivityTimer();
        return this.currentUser;
      } catch (error) {
        console.error('Invalid token:', error);
        this.logout();
        return null;
      }
    } catch (error) {
      console.error('Error loading user:', error);
      return null;
    }
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;

// Permission checking with validation
  // REPLACE the hasPermission method in authService.js with this:
  
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    const permissions = {
      super_admin: [
        'scribe', 
        'add_patients', 
        'edit_patients',
        'delete_patients',
        'add_users', 
        'read_all_notes', 
        'edit_all_notes', 
        'manage_users', 
        'view_all_patients', 
        'export_data'
      ],
      admin: [
        'scribe', 
        'add_patients', 
        'edit_patients',
        'delete_patients',
        'add_users', 
        'read_all_notes', 
        'edit_own_notes', 
        'manage_users', 
        'view_all_patients'
      ],
      medical_provider: [
        'scribe', 
        'add_patients',     // ADDED
        'edit_patients',    // ADDED
        'delete_patients',  // ADDED (optional - remove if you don't want this)
        'read_own_notes', 
        'edit_own_notes', 
        'view_own_patients'
      ],
      support_staff: [
        'add_patients', 
        'edit_patients',    // ADDED
        'read_all_notes', 
        'view_all_patients'
      ]
    };
    
    const userPermissions = permissions[this.currentUser.role];
    return userPermissions ? userPermissions.includes(permission) : false;
  }// authService.js - FIXED VERSION with proper session management
// Handles authentication, authorization, and session timeout

class AuthService {
  constructor() {
    // User definitions - these will eventually come from backend
    this.users = {
      'darshan@aayuwell.com': { 
        name: 'Dr. Darshan Patel', 
        role: 'super_admin', 
        password: 'Aayuscribe1212@' 
      },
      'admin': { 
        name: 'Admin User', 
        role: 'admin', 
        password: 'admin123' 
      },
      'doctor': { 
        name: 'Dr. Provider', 
        role: 'medical_provider', 
        password: 'doctor123' 
      },
      'staff': { 
        name: 'Support Staff', 
        role: 'support_staff', 
        password: 'staff123' 
      }
    };
    
    this.currentUser = null;
    this.sessionTimeout = 3600000; // 1 hour
    this.warningTimeout = 3300000; // 55 minutes - warning before timeout
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';
    this.sessionTimer = null;
    this.warningTimer = null;
    this.lastActivity = Date.now();
    
    // Initialize user on construction
    this.initializeUser();
  }

  // Initialize user from localStorage
  initializeUser() {
    try {
      const savedUser = localStorage.getItem('currentUser');
      const lastActivity = localStorage.getItem('lastActivity');
      
      if (savedUser && lastActivity) {
        const timeSinceActivity = Date.now() - parseInt(lastActivity, 10);
        
        if (timeSinceActivity < this.sessionTimeout) {
          this.currentUser = JSON.parse(savedUser);
          this.lastActivity = parseInt(lastActivity, 10);
          this.startSessionTimer();
          return true;
        } else {
          // Session expired
          this.clearSession();
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to initialize user:', error);
      this.clearSession();
      return false;
    }
  }

  // Clear session data
  clearSession() {
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('lastActivity');
      this.currentUser = null;
      this.lastActivity = null;
      this.clearTimers();
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  // Clear timers
  clearTimers() {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  // Start session timer
  startSessionTimer() {
    this.clearTimers();
    
    // Set warning timer (5 minutes before timeout)
    this.warningTimer = setTimeout(() => {
      if (this.onSessionWarning) {
        this.onSessionWarning();
      }
    }, this.warningTimeout);
    
    // Set session timeout
    this.sessionTimer = setTimeout(() => {
      this.logout();
      if (this.onSessionExpired) {
        this.onSessionExpired();
      }
    }, this.sessionTimeout);
  }

  // Update activity timestamp
  updateActivity() {
    if (!this.currentUser) return;
    
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    // Only update if more than 1 minute has passed
    if (timeSinceLastActivity > 60000) {
      this.lastActivity = now;
      try {
        localStorage.setItem('lastActivity', now.toString());
        this.startSessionTimer(); // Reset timers
      } catch (error) {
        console.error('Failed to update activity:', error);
      }
    }
  }

  // Check if session is still valid
  isSessionValid() {
    if (!this.currentUser) return false;
    
    const timeSinceActivity = Date.now() - this.lastActivity;
    return timeSinceActivity < this.sessionTimeout;
  }

  // Login method with validation
  login(username, password) {
    try {
      // Validate input
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      
      // Normalize username
      const normalizedUsername = username.toLowerCase().trim();
      
      // Check if user exists
      const user = this.users[normalizedUsername];
      
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      // Verify password
      if (user.password !== password) {
        throw new Error('Invalid credentials');
      }
      
      // Create session
      this.currentUser = {
        id: normalizedUsername,
        username: normalizedUsername,
        role: user.role,
        name: user.name,
        loginTime: Date.now()
      };
      
      this.lastActivity = Date.now();
      
      // Store session
      try {
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        localStorage.setItem('lastActivity', this.lastActivity.toString());
      } catch (storageError) {
        console.error('Failed to save session:', storageError);
        throw new Error('Failed to save session. Please check browser storage.');
      }
      
      // Start session timer
      this.startSessionTimer();
      
      return this.currentUser;
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Logout method
  logout() {
    try {
      this.clearSession();
      
      // Call logout callback if set
      if (this.onLogout) {
        this.onLogout();
      }
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Permission checking with validation
// Permission checking with validation
  // REPLACE the hasPermission method in authService.js with this:
  
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    const permissions = {
      super_admin: [
        'scribe', 
        'add_patients', 
        'edit_patients',
        'delete_patients',
        'add_users', 
        'read_all_notes', 
        'edit_all_notes', 
        'manage_users', 
        'view_all_patients', 
        'export_data'
      ],
      admin: [
        'scribe', 
        'add_patients', 
        'edit_patients',
        'delete_patients',
        'add_users', 
        'read_all_notes', 
        'edit_own_notes', 
        'manage_users', 
        'view_all_patients'
      ],
      medical_provider: [
        'scribe', 
        'add_patients',     // ADDED
        'edit_patients',    // ADDED
        'delete_patients',  // ADDED (optional - remove if you don't want this)
        'read_own_notes', 
        'edit_own_notes', 
        'view_own_patients'
      ],
      support_staff: [
        'add_patients', 
        'edit_patients',    // ADDED
        'read_all_notes', 
        'view_all_patients'
      ]
    };
    
    const userPermissions = permissions[this.currentUser.role];
    return userPermissions ? userPermissions.includes(permission) : false;
  }

  
  // Check if user can edit specific notes
  canEditNotes(visitCreatedBy) {
    if (!this.currentUser) return false;
    
    // Super admin can edit all
    if (this.currentUser.role === 'super_admin') return true;
    
    // Admin can edit all
    if (this.currentUser.role === 'admin') return true;
    
    // Others can only edit their own
    return visitCreatedBy === this.currentUser.id;
  }

  // Check if user can view specific patient
  canViewPatient(patientCreatedBy) {
    if (!this.currentUser) return false;
    
    // Super admin, admin, and support staff can view all
    if (['super_admin', 'admin', 'support_staff'].includes(this.currentUser.role)) {
      return true;
    }
    
    // Medical providers can only view their own patients
    return patientCreatedBy === this.currentUser.id;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // User management methods
  async createUser(userData) {
    try {
      if (!this.hasPermission('add_users')) {
        throw new Error('Insufficient permissions to create users');
      }
      
      // Validate user data
      if (!userData.username || !userData.password || !userData.name || !userData.role) {
        throw new Error('Missing required user information');
      }
      
      // Check password strength
      if (userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      
      // Check if user already exists
      if (this.users[userData.username.toLowerCase()]) {
        throw new Error('User already exists');
      }
      
      // In production, this would call the API
      // For now, return a success message
      return {
        success: true,
        message: 'User creation request logged. Contact administrator to complete setup.'
      };
      
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  // API call helper with retry logic
  async apiCall(endpoint, options = {}, retries = 3) {
    try {
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUser?.id || '',
          'x-user-role': this.currentUser?.role || '',
          'x-session-id': this.currentUser?.loginTime || ''
        }
      };

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Unauthorized - session may have expired
          this.logout();
          throw new Error('Session expired. Please login again.');
        }
        
        if (response.status === 503 && retries > 0) {
          // Service unavailable - retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.apiCall(endpoint, options, retries - 1);
        }
        
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
      
      // Fall back to localStorage for critical operations
      if (error.message.includes('fetch')) {
        console.warn('API not available, using localStorage fallback');
        return this.localStorageFallback(endpoint, options);
      }
      
      throw error;
    }
  }

  // LocalStorage fallback for when API is unavailable
  localStorageFallback(endpoint, options) {
    console.warn('Using localStorage fallback for:', endpoint);
    
    try {
      // Patient operations
      if (endpoint.includes('/patients')) {
        if (options.method === 'GET') {
          const patients = localStorage.getItem('medicalScribePatients');
          return patients ? JSON.parse(patients) : [];
        }
        
        if (options.method === 'POST') {
          const patients = JSON.parse(localStorage.getItem('medicalScribePatients') || '[]');
          const newPatient = JSON.parse(options.body);
          newPatient.id = Date.now();
          newPatient.createdBy = this.currentUser?.id;
          patients.push(newPatient);
          localStorage.setItem('medicalScribePatients', JSON.stringify(patients));
          return newPatient;
        }
      }
      
      // Visit operations
      if (endpoint.includes('/visits')) {
        const match = endpoint.match(/\/patients\/(\d+)\/visits/);
        if (match) {
          const patientId = match[1];
          
          if (options.method === 'GET') {
            const visits = localStorage.getItem(`visits_${patientId}`);
            return visits ? JSON.parse(visits) : [];
          }
          
          if (options.method === 'POST') {
            const visits = JSON.parse(localStorage.getItem(`visits_${patientId}`) || '[]');
            const newVisit = JSON.parse(options.body);
            newVisit.id = Date.now();
            newVisit.createdBy = this.currentUser?.id;
            visits.push(newVisit);
            localStorage.setItem(`visits_${patientId}`, JSON.stringify(visits));
            return newVisit;
          }
        }
      }
      
      // Training data operations
      if (endpoint.includes('/training')) {
        if (options.method === 'GET') {
          const training = localStorage.getItem('medicalScribeTraining');
          return training ? JSON.parse(training) : {
            specialty: 'internal_medicine',
            noteType: 'progress_note',
            baselineNotes: [],
            customTemplates: {}
          };
        }
        
        if (options.method === 'POST') {
          const trainingData = JSON.parse(options.body);
          localStorage.setItem('medicalScribeTraining', JSON.stringify(trainingData));
          return trainingData;
        }
      }
      
      // Health check
      if (endpoint.includes('/health')) {
        return { status: 'offline', mode: 'localStorage' };
      }
      
      throw new Error('Fallback not implemented for this endpoint');
      
    } catch (error) {
      console.error('LocalStorage fallback error:', error);
      throw error;
    }
  }

  // Check if service is ready
  isReady() {
    return this.currentUser !== null && this.isSessionValid();
  }

  // Health check for API connectivity
  async checkApiHealth() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.warn('API health check failed:', error);
      return false;
    }
  }

  // Set session callbacks
  setSessionCallbacks(callbacks) {
    if (callbacks.onSessionWarning) {
      this.onSessionWarning = callbacks.onSessionWarning;
    }
    if (callbacks.onSessionExpired) {
      this.onSessionExpired = callbacks.onSessionExpired;
    }
    if (callbacks.onLogout) {
      this.onLogout = callbacks.onLogout;
    }
  }

  // Get session remaining time
  getSessionRemainingTime() {
    if (!this.currentUser) return 0;
    
    const elapsed = Date.now() - this.lastActivity;
    const remaining = this.sessionTimeout - elapsed;
    
    return remaining > 0 ? remaining : 0;
  }

  // Extend session
  extendSession() {
    if (!this.currentUser) return false;
    
    this.updateActivity();
    return true;
  }
}

// Create and export singleton instance
const authService = new AuthService();

// Set up session callbacks for the app
authService.setSessionCallbacks({
  onSessionWarning: () => {
    console.warn('Session will expire in 5 minutes');
    // App can show a warning modal here
  },
  onSessionExpired: () => {
    console.warn('Session expired');
    // App will force logout
  },
  onLogout: () => {
    console.log('User logged out');
    // App will redirect to login
  }
});

export default authService;

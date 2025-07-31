// authService.js - Simplified Environment Variable Authentication
class AuthService {
  constructor() {
    // Load users from environment variables or use defaults
    this.users = this.loadUsers();
    this.currentUser = this.loadCurrentUser();
    this.sessionTimeout = 3600000; // 1 hour
    this.loginDuration = 43200000; // 12 hours
    this.inactivityTimer = null;
    
    if (this.currentUser) {
      this.startInactivityTimer();
    }
  }

  // Load users from environment or defaults
  loadUsers() {
    try {
      const envUsers = process.env.REACT_APP_USERS;
      if (envUsers) {
        return JSON.parse(envUsers);
      }
    } catch (error) {
      console.warn('Could not parse REACT_APP_USERS, using defaults');
    }

    // Default users for development
    return {
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
  }

  // Simple password hash (for demo - in production use proper hashing)
  hashPassword(password) {
    // Simple hash for demo purposes
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Generate simple session token
  generateToken(user, username) {
    const tokenData = {
      userId: username,
      username: username,
      role: user.role,
      name: user.name,
      expires: Date.now() + this.loginDuration,
      issued: Date.now()
    };
    
    return btoa(JSON.stringify(tokenData));
  }

  // Verify session token
  verifyToken(token) {
    try {
      const tokenData = JSON.parse(atob(token));
      
      if (Date.now() > tokenData.expires) {
        return null;
      }
      
      return tokenData;
    } catch (error) {
      return null;
    }
  }

  // Login user
  login(username, password) {
    const user = this.users[username];
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check password (you can remove this check for even simpler auth)
    if (user.password && user.password !== password) {
      throw new Error('Invalid credentials');
    }

    // Generate token and store session
    const token = this.generateToken(user, username);
    
    localStorage.setItem('authToken', token);
    localStorage.setItem('lastActivity', Date.now().toString());

    this.currentUser = {
      id: username,
      username: username,
      role: user.role,
      name: user.name
    };

    this.startInactivityTimer();
    return this.currentUser;
  }

  // Load current user from localStorage
  loadCurrentUser() {
    try {
      const token = localStorage.getItem('authToken');
      const lastActivity = localStorage.getItem('lastActivity');

      if (!token || !lastActivity) {
        return null;
      }

      // Check inactivity timeout
      const timeSinceActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceActivity > this.sessionTimeout) {
        this.logout();
        return null;
      }

      const payload = this.verifyToken(token);
      if (!payload) {
        this.logout();
        return null;
      }

      return {
        id: payload.userId,
        username: payload.username,
        role: payload.role,
        name: payload.name
      };
    } catch (error) {
      console.error('Load user error:', error);
      this.logout();
      return null;
    }
  }

  // Logout user
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('lastActivity');
    this.currentUser = null;
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  // Update activity timestamp
  updateActivity() {
    localStorage.setItem('lastActivity', Date.now().toString());
    this.startInactivityTimer();
  }

  // Start inactivity timer
  startInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }

    this.inactivityTimer = setTimeout(() => {
      this.logout();
      window.location.reload();
    }, this.sessionTimeout);
  }

  // Check permissions based on role
  hasPermission(permission) {
    if (!this.currentUser) {
      return false;
    }

    const permissions = {
      super_admin: ['scribe', 'add_patients', 'add_users', 'read_all_notes', 'edit_all_notes'],
      admin: ['scribe', 'add_patients', 'add_users', 'read_own_notes'],
      medical_provider: ['scribe', 'read_own_notes'],
      support_staff: ['add_patients', 'read_all_notes']
    };

    return permissions[this.currentUser.role]?.includes(permission) || false;
  }

  // Check if user can edit specific notes
  canEditNotes(visitCreatedBy) {
    if (!this.currentUser) {
      return false;
    }

    if (this.currentUser.role === 'super_admin') {
      return true;
    }

    return visitCreatedBy === this.currentUser.id;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Create new user (just updates the config - in production you'd want proper user management)
  createUser(userData) {
    if (!this.hasPermission('add_users')) {
      throw new Error('Insufficient permissions');
    }

    // For now, just show success (in production, you'd update your user config)
    console.log('User would be created:', userData);
    return { success: true, message: 'User creation logged (update environment config to add permanently)' };
  }

  // === SIMPLIFIED DATA MANAGEMENT (localStorage) ===

  // Get all patients from localStorage
  getPatients() {
    try {
      const patients = localStorage.getItem('medicalScribePatients');
      return patients ? JSON.parse(patients) : [];
    } catch (error) {
      console.error('Failed to load patients:', error);
      return [];
    }
  }

  // Save patient to localStorage
  savePatient(patient) {
    if (!this.hasPermission('add_patients')) {
      throw new Error('Insufficient permissions');
    }

    try {
      const patients = this.getPatients();
      const existingIndex = patients.findIndex(p => p.id === patient.id);
      
      const patientWithMeta = {
        ...patient,
        createdBy: this.currentUser.id,
        createdByName: this.currentUser.name,
        lastModified: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        patients[existingIndex] = patientWithMeta;
      } else {
        patients.push(patientWithMeta);
      }

      localStorage.setItem('medicalScribePatients', JSON.stringify(patients));
      this.updateActivity();
      return patientWithMeta;
    } catch (error) {
      throw new Error('Failed to save patient: ' + error.message);
    }
  }

  // Get visits for a patient
  getVisits(patientId) {
    try {
      const visits = localStorage.getItem(`visits_${patientId}`);
      const allVisits = visits ? JSON.parse(visits) : [];
      
      // Filter based on permissions
      const filteredVisits = allVisits.filter(visit => {
        return this.hasPermission('read_all_notes') || visit.createdBy === this.currentUser.id;
      });

      this.updateActivity();
      return filteredVisits;
    } catch (error) {
      console.error('Failed to load visits:', error);
      return [];
    }
  }

  // Save visit for a patient
  saveVisit(patientId, visit) {
    if (!this.hasPermission('scribe')) {
      throw new Error('Insufficient permissions');
    }

    try {
      const visits = this.getVisits(patientId) || [];
      const existingIndex = visits.findIndex(v => v.id === visit.id);
      
      const visitWithMeta = {
        ...visit,
        createdBy: this.currentUser.id,
        createdByName: this.currentUser.name,
        lastModified: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        visits[existingIndex] = visitWithMeta;
      } else {
        visits.push(visitWithMeta);
      }

      localStorage.setItem(`visits_${patientId}`, JSON.stringify(visits));
      this.updateActivity();
      return visitWithMeta;
    } catch (error) {
      throw new Error('Failed to save visit: ' + error.message);
    }
  }

  // Check if service is ready (always ready now!)
  isReady() {
    return true;
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;

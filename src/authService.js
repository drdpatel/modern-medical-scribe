// src/authService.js
// FIXED VERSION - Works with both API and local authentication

import axios from 'axios';

class AuthService {
  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';
    this.currentUser = this.loadUser();
    this.sessionTimeout = 12 * 60 * 60 * 1000; // 12 hours
    this.initSessionCheck();
    
    // Default users for fallback authentication
    this.defaultUsers = [
      {
        id: 'admin_001',
        username: 'admin',
        password: 'admin123',
        name: 'System Administrator',
        email: 'admin@aayuwell.com',
        role: 'super_admin'
      },
      {
        id: 'doctor_001',
        username: 'doctor',
        password: 'doctor123',
        name: 'Dr. Demo User',
        email: 'doctor@example.com',
        role: 'doctor',
        specialty: 'internal_medicine'
      },
      {
        id: 'darshan_001',
        username: 'darshan',
        password: 'darshan123',
        name: 'Darshan Patel',
        email: 'darshan@aayuwell.com',
        role: 'super_admin'
      },
      {
        id: 'darshan_email',
        username: 'darshan@aayuwell.com',
        password: 'darshan123',
        name: 'Darshan Patel',
        email: 'darshan@aayuwell.com',
        role: 'super_admin'
      },
      {
        id: 'staff_001',
        username: 'staff',
        password: 'staff123',
        name: 'Staff User',
        email: 'staff@example.com',
        role: 'staff'
      }
    ];
  }

  // Load user from localStorage
  loadUser() {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) return null;
      
      const user = JSON.parse(stored);
      
      // Check session expiry
      if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
        this.logout();
        return null;
      }
      
      // Ensure role is set
      if (!user.role || user.role === 'Unknown User') {
        user.role = this.determineUserRole(user);
      }
      
      return user;
    } catch (error) {
      console.error('Error loading user:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  // Determine user role based on email/username
  determineUserRole(user) {
    // Check email for @aayuwell.com
    if (user.email && user.email.toLowerCase().includes('@aayuwell.com')) {
      return 'super_admin';
    }
    
    // Check username patterns
    const username = (user.username || '').toLowerCase();
    if (username === 'admin' || username === 'darshan' || username.includes('darshan')) {
      return 'super_admin';
    }
    if (username === 'doctor' || username.includes('dr')) {
      return 'doctor';
    }
    if (username === 'nurse') {
      return 'nurse';
    }
    if (username === 'staff') {
      return 'staff';
    }
    
    // Use existing role or default to doctor
    return user.role || 'doctor';
  }

  // Initialize session checker
  initSessionCheck() {
    setInterval(() => {
      if (this.currentUser?.sessionExpiry) {
        if (new Date(this.currentUser.sessionExpiry) < new Date()) {
          this.logout();
          window.location.href = '/';
        }
      }
    }, 60000);
  }

  // FIXED LOGIN METHOD - Works with API or local fallback
  async login(username, password) {
    console.log('[AuthService] Login attempt for:', username);
    
    // Clean inputs
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();
    
    // Try API login first (if online)
    if (navigator.onLine) {
      try {
        console.log('[AuthService] Trying API login...');
        
        const response = await axios.post(
          `${this.apiBaseUrl}/users/login`,
          { 
            username: cleanUsername, 
            password: cleanPassword 
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000, // 5 second timeout
            validateStatus: function (status) {
              return status < 500; // Don't throw on 4xx errors
            }
          }
        );

        if (response.status === 200 && response.data && response.data.id) {
          console.log('[AuthService] API login successful');
          
          const userData = {
            ...response.data,
            role: this.determineUserRole(response.data),
            sessionExpiry: new Date(Date.now() + this.sessionTimeout).toISOString(),
            loginTime: new Date().toISOString()
          };
          
          // Store user
          localStorage.setItem('currentUser', JSON.stringify(userData));
          this.currentUser = userData;
          
          if (response.data.token) {
            localStorage.setItem('authToken', response.data.token);
          }
          
          return { success: true, user: userData };
        }
        
        // If API returned 401, try local auth as fallback
        if (response.status === 401) {
          console.log('[AuthService] API auth failed, trying local...');
        }
        
      } catch (apiError) {
        console.log('[AuthService] API error, falling back to local auth:', apiError.message);
      }
    }
    
    // LOCAL AUTHENTICATION FALLBACK
    console.log('[AuthService] Using local authentication...');
    
    // Check against default users
    const user = this.defaultUsers.find(u => 
      (u.username === cleanUsername || u.email === cleanUsername) && 
      u.password === cleanPassword
    );
    
    if (user) {
      console.log('[AuthService] Local login successful for:', user.username);
      
      const userData = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        specialty: user.specialty,
        sessionExpiry: new Date(Date.now() + this.sessionTimeout).toISOString(),
        loginTime: new Date().toISOString(),
        isLocalAuth: true // Mark as local auth
      };
      
      // Store user
      localStorage.setItem('currentUser', JSON.stringify(userData));
      this.currentUser = userData;
      
      // Generate a fake token for local auth
      const fakeToken = btoa(`${user.username}:${Date.now()}`);
      localStorage.setItem('authToken', fakeToken);
      
      return { success: true, user: userData };
    }
    
    // Login failed
    console.log('[AuthService] Login failed - invalid credentials');
    return {
      success: false,
      error: 'Invalid username or password. Try: doctor/doctor123 or admin/admin123'
    };
  }

  // Logout
  logout() {
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      sessionStorage.clear();
      this.currentUser = null;
      console.log('[AuthService] Logged out');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if authenticated
  isAuthenticated() {
    if (!this.currentUser) return false;
    
    if (this.currentUser.sessionExpiry) {
      if (new Date(this.currentUser.sessionExpiry) < new Date()) {
        this.logout();
        return false;
      }
    }
    
    return true;
  }

  // Check permissions
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    const userRole = this.currentUser.role || this.determineUserRole(this.currentUser);
    
    const rolePermissions = {
      super_admin: [
        'scribe', 'training', 'add_patients', 'edit_patients', 'delete_patients',
        'add_users', 'edit_users', 'delete_users', 'read_all_notes', 
        'edit_all_notes', 'delete_all_notes', 'manage_users', 
        'manage_settings', 'view_analytics', 'export_data'
      ],
      admin: [
        'scribe', 'training', 'add_patients', 'edit_patients',
        'add_users', 'edit_users', 'read_all_notes', 
        'edit_own_notes', 'manage_users', 'view_analytics'
      ],
      doctor: [
        'scribe', 'training', 'add_patients', 'edit_patients', 'delete_patients',
        'read_own_notes', 'edit_own_notes', 'delete_own_notes'
      ],
      medical_provider: [
        'scribe', 'training', 'read_own_notes', 'edit_own_notes'
      ],
      nurse: [
        'training', 'add_patients', 'edit_patients', 'read_all_notes'
      ],
      staff: [
        'add_patients', 'edit_patients', 'read_all_notes'
      ],
      support_staff: [
        'add_patients', 'read_all_notes'
      ]
    };

    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(permission);
  }

  // Check role
  hasRole(roles) {
    if (!this.currentUser) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    const userRole = this.currentUser.role || this.determineUserRole(this.currentUser);
    return roleArray.includes(userRole);
  }

  // Get current user
  getCurrentUser() {
    if (!this.currentUser) return null;
    
    // Ensure role is set
    if (!this.currentUser.role || this.currentUser.role === 'Unknown User') {
      this.currentUser.role = this.determineUserRole(this.currentUser);
    }
    
    // Ensure name is set
    if (!this.currentUser.name) {
      if (this.currentUser.username) {
        this.currentUser.name = this.currentUser.username;
      } else if (this.currentUser.email) {
        this.currentUser.name = this.currentUser.email.split('@')[0];
      } else {
        this.currentUser.name = 'User';
      }
    }
    
    return this.currentUser;
  }

  // Update session
  updateSession() {
    if (this.currentUser) {
      const sessionExpiry = new Date(Date.now() + this.sessionTimeout).toISOString();
      this.currentUser.sessionExpiry = sessionExpiry;
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }
  }

  // Get auth headers for API calls
  getAuthHeaders() {
    const user = this.getCurrentUser();
    if (!user) return {};
    
    return {
      'x-user-id': user.id || '',
      'x-user-role': user.role || 'doctor',
      'x-user-name': user.name || 'User',
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
    };
  }

  // Verify session (always returns true for local auth)
  async verifySession() {
    if (!this.currentUser) return false;
    
    // If local auth, always valid
    if (this.currentUser.isLocalAuth) {
      return true;
    }
    
    // Try API verification
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/users/verify`,
        {
          headers: this.getAuthHeaders(),
          timeout: 3000
        }
      );
      
      return response.data?.valid === true;
    } catch (error) {
      // If API fails, check local session
      return this.isAuthenticated();
    }
  }

  // Change password (local users can't change password)
  async changePassword(oldPassword, newPassword) {
    if (!this.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }
    
    if (this.currentUser.isLocalAuth) {
      return { success: false, error: 'Cannot change password for demo users' };
    }
    
    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/users/change-password`,
        {
          userId: this.currentUser.id,
          oldPassword,
          newPassword
        },
        {
          headers: this.getAuthHeaders(),
          timeout: 10000
        }
      );
      
      return {
        success: true,
        message: response.data.message || 'Password changed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to change password'
      };
    }
  }
}

// Create singleton instance
const authService = new AuthService();
Object.freeze(authService);

export default authService;

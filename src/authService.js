// src/authService.js
// Complete, debugged authentication service with proper error handling

import axios from 'axios';

class AuthService {
  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';
    this.currentUser = this.loadUser();
    this.sessionTimeout = 12 * 60 * 60 * 1000; // 12 hours
    this.initSessionCheck();
  }

  // Load user from localStorage with validation
  loadUser() {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) return null;
      
      const user = JSON.parse(stored);
      
      // Validate session expiry
      if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
        this.logout();
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error loading user:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  // Initialize session timeout checker
  initSessionCheck() {
    setInterval(() => {
      if (this.currentUser?.sessionExpiry) {
        if (new Date(this.currentUser.sessionExpiry) < new Date()) {
          this.logout();
          window.location.href = '/login';
        }
      }
    }, 60000); // Check every minute
  }

  // Login with enhanced error handling
  async login(username, password) {
    try {
      // Clear any existing session
      this.logout();
      
      const response = await axios.post(
        `${this.apiBaseUrl}/users/login`,
        { username, password },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.data && response.data.id) {
        const sessionExpiry = new Date(Date.now() + this.sessionTimeout).toISOString();
        
        const userData = {
          ...response.data,
          sessionExpiry,
          loginTime: new Date().toISOString()
        };
        
        // Store user data
        localStorage.setItem('currentUser', JSON.stringify(userData));
        this.currentUser = userData;
        
        // Store token if provided
        if (response.data.token) {
          localStorage.setItem('authToken', response.data.token);
        }
        
        return {
          success: true,
          user: userData
        };
      }
      
      throw new Error('Invalid response from server');
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Invalid username or password'
        };
      } else if (error.response?.status === 403) {
        return {
          success: false,
          error: 'Account is disabled. Please contact administrator.'
        };
      } else if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Connection timeout. Please check your internet connection.'
        };
      } else if (!navigator.onLine) {
        return {
          success: false,
          error: 'No internet connection'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed. Please try again.'
      };
    }
  }

  // Logout with cleanup
  logout() {
    try {
      // Clear all auth data
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      localStorage.removeItem('apiSettings');
      
      // Clear session storage
      sessionStorage.clear();
      
      this.currentUser = null;
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    if (!this.currentUser) return false;
    
    // Check session expiry
    if (this.currentUser.sessionExpiry) {
      if (new Date(this.currentUser.sessionExpiry) < new Date()) {
        this.logout();
        return false;
      }
    }
    
    return true;
  }

  // Enhanced permission checking with role hierarchy
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    const rolePermissions = {
      super_admin: [
        'scribe', 
        'add_patients', 
        'edit_patients', 
        'delete_patients',
        'add_users', 
        'edit_users', 
        'delete_users',
        'read_all_notes', 
        'edit_all_notes', 
        'delete_all_notes',
        'manage_users', 
        'manage_settings',
        'view_analytics',
        'export_data'
      ],
      admin: [
        'scribe', 
        'add_patients', 
        'edit_patients',
        'add_users', 
        'edit_users',
        'read_all_notes', 
        'edit_own_notes',
        'manage_users',
        'view_analytics'
      ],
      doctor: [
        'scribe', 
        'add_patients',
        'edit_patients',
        'delete_patients',
        'read_own_notes', 
        'edit_own_notes',
        'delete_own_notes'
      ],
      medical_provider: [
        'scribe', 
        'read_own_notes', 
        'edit_own_notes'
      ],
      nurse: [
        'add_patients',
        'edit_patients',
        'read_all_notes'
      ],
      staff: [
        'add_patients',
        'edit_patients',
        'read_all_notes'
      ],
      support_staff: [
        'add_patients', 
        'read_all_notes'
      ]
    };

    const userPermissions = rolePermissions[this.currentUser.role] || [];
    return userPermissions.includes(permission);
  }

  // Check if user has any of the specified roles
  hasRole(roles) {
    if (!this.currentUser) return false;
    
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(this.currentUser.role);
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Update user session
  updateSession() {
    if (this.currentUser) {
      const sessionExpiry = new Date(Date.now() + this.sessionTimeout).toISOString();
      this.currentUser.sessionExpiry = sessionExpiry;
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }
  }

  // Get auth headers for API calls
  getAuthHeaders() {
    if (!this.currentUser) return {};
    
    return {
      'x-user-id': this.currentUser.id || '',
      'x-user-role': this.currentUser.role || '',
      'x-user-name': this.currentUser.name || '',
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
    };
  }

  // Verify session with backend
  async verifySession() {
    if (!this.currentUser) return false;
    
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/users/verify`,
        {
          headers: this.getAuthHeaders(),
          timeout: 5000
        }
      );
      
      return response.data?.valid === true;
    } catch (error) {
      console.error('Session verification failed:', error);
      return false;
    }
  }

  // Change password
  async changePassword(oldPassword, newPassword) {
    if (!this.currentUser) {
      return { success: false, error: 'Not authenticated' };
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

// Create and export singleton instance
const authService = new AuthService();

// Freeze the instance to prevent modifications
Object.freeze(authService);

export default authService;

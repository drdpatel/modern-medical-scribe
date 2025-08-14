// src/authService.js
// THOROUGHLY DEBUGGED - Complete authentication service with proper role detection

import axios from 'axios';

class AuthService {
  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';
    this.currentUser = this.loadUser();
    this.sessionTimeout = 12 * 60 * 60 * 1000; // 12 hours
    this.initSessionCheck();
    this.debugMode = true; // Enable debug logging
  }

  // Debug logger
  debugLog(message, data = null) {
    if (this.debugMode) {
      console.log(`[AuthService] ${message}`, data || '');
    }
  }

  // Load user from localStorage with validation
  loadUser() {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) {
        this.debugLog('No stored user found');
        return null;
      }
      
      const user = JSON.parse(stored);
      this.debugLog('Loaded user from storage', { 
        username: user.username, 
        email: user.email, 
        role: user.role 
      });
      
      // Validate session expiry
      if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
        this.debugLog('Session expired, logging out');
        this.logout();
        return null;
      }
      
      // FIX: Ensure role is properly set
      if (!user.role || user.role === 'Unknown User' || user.role === 'unknown') {
        user.role = this.determineUserRole(user);
        this.debugLog('Fixed user role', { newRole: user.role });
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
      
      return user;
    } catch (error) {
      console.error('Error loading user:', error);
      localStorage.removeItem('currentUser');
      return null;
    }
  }

  // CRITICAL: Determine user role based on email/username
  determineUserRole(user) {
    this.debugLog('Determining role for user', { 
      username: user.username, 
      email: user.email,
      existingRole: user.role 
    });
    
    // Priority 1: Check email domain for Aayuwell
    if (user.email) {
      const email = user.email.toLowerCase();
      if (email.includes('@aayuwell.com')) {
        this.debugLog('Aayuwell email detected - assigning super_admin');
        return 'super_admin';
      }
      // Special case for darshan
      if (email.includes('darshan')) {
        this.debugLog('Darshan email detected - assigning super_admin');
        return 'super_admin';
      }
    }
    
    // Priority 2: Check username patterns
    if (user.username) {
      const username = user.username.toLowerCase();
      
      // Admin usernames
      if (username === 'admin' || username === 'darshan' || username === 'administrator') {
        this.debugLog('Admin username detected - assigning super_admin');
        return 'super_admin';
      }
      
      // Doctor usernames
      if (username === 'doctor' || username.includes('dr.') || username.includes('dr_')) {
        this.debugLog('Doctor username detected - assigning doctor');
        return 'doctor';
      }
      
      // Other medical roles
      if (username === 'nurse') return 'nurse';
      if (username === 'staff') return 'staff';
    }
    
    // Priority 3: Use existing valid role
    if (user.role && user.role !== 'Unknown User' && user.role !== 'unknown') {
      this.debugLog('Using existing valid role', { role: user.role });
      return user.role;
    }
    
    // Default: Assign doctor role for medical users
    this.debugLog('No specific pattern matched - defaulting to doctor');
    return 'doctor';
  }

  // Initialize session timeout checker
  initSessionCheck() {
    setInterval(() => {
      if (this.currentUser?.sessionExpiry) {
        if (new Date(this.currentUser.sessionExpiry) < new Date()) {
          this.debugLog('Session expired during check');
          this.logout();
          window.location.href = '/login';
        }
      }
    }, 60000); // Check every minute
  }

  // Login method with comprehensive error handling
  async login(username, password) {
    try {
      this.debugLog('Login attempt', { username });
      
      // Clear any existing session
      this.logout();
      
      const response = await axios.post(
        `${this.apiBaseUrl}/users/login`,
        { username, password },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      this.debugLog('Login response received', { 
        status: response.status,
        hasData: !!response.data 
      });

      if (response.data && response.data.id) {
        const sessionExpiry = new Date(Date.now() + this.sessionTimeout).toISOString();
        
        // FIX: Ensure role is properly determined
        const properRole = this.determineUserRole(response.data);
        
        const userData = {
          ...response.data,
          role: properRole,
          sessionExpiry,
          loginTime: new Date().toISOString()
        };
        
        // Ensure name is set
        if (!userData.name) {
          if (userData.username) {
            userData.name = userData.username;
          } else if (userData.email) {
            userData.name = userData.email.split('@')[0];
          } else {
            userData.name = 'User';
          }
        }
        
        // Store user data
        localStorage.setItem('currentUser', JSON.stringify(userData));
        this.currentUser = userData;
        
        // Store token if provided
        if (response.data.token) {
          localStorage.setItem('authToken', response.data.token);
        }
        
        this.debugLog('Login successful', {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          name: userData.name
        });
        
        return {
          success: true,
          user: userData
        };
      }
      
      throw new Error('Invalid response from server');
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Detailed error handling
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
      } else if (error.response?.status === 500) {
        return {
          success: false,
          error: 'Server error. Please try again later.'
        };
      }
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Login failed. Please try again.'
      };
    }
  }

  // Logout with complete cleanup
  logout() {
    try {
      this.debugLog('Logging out user');
      
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
    if (!this.currentUser) {
      this.debugLog('Not authenticated - no current user');
      return false;
    }
    
    // Check session expiry
    if (this.currentUser.sessionExpiry) {
      if (new Date(this.currentUser.sessionExpiry) < new Date()) {
        this.debugLog('Not authenticated - session expired');
        this.logout();
        return false;
      }
    }
    
    this.debugLog('User is authenticated', { 
      username: this.currentUser.username,
      role: this.currentUser.role 
    });
    return true;
  }

  // CRITICAL: Permission checking with proper role handling
  hasPermission(permission) {
    if (!this.currentUser) {
      this.debugLog('Permission check failed - no current user');
      return false;
    }
    
    // Get user's actual role (with fallback logic)
    let userRole = this.currentUser.role;
    
    // FIX: Re-determine role if invalid
    if (!userRole || userRole === 'Unknown User' || userRole === 'unknown') {
      userRole = this.determineUserRole(this.currentUser);
      this.currentUser.role = userRole;
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      this.debugLog('Re-determined role for permission check', { newRole: userRole });
    }
    
    // Comprehensive permission matrix
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

    const permissions = rolePermissions[userRole];
    
    if (!permissions) {
      this.debugLog('Unknown role, defaulting to doctor permissions', { role: userRole });
      const defaultPermissions = rolePermissions.doctor;
      return defaultPermissions.includes(permission);
    }
    
    const hasAccess = permissions.includes(permission);
    this.debugLog('Permission check', { 
      permission, 
      role: userRole, 
      granted: hasAccess 
    });
    
    return hasAccess;
  }

  // Check if user has specific role
  hasRole(roles) {
    if (!this.currentUser) return false;
    
    const roleArray = Array.isArray(roles) ? roles : [roles];
    const userRole = this.currentUser.role || this.determineUserRole(this.currentUser);
    
    const hasRequiredRole = roleArray.includes(userRole);
    this.debugLog('Role check', { 
      requiredRoles: roleArray, 
      userRole, 
      hasRole: hasRequiredRole 
    });
    
    return hasRequiredRole;
  }

  // Get current user with all necessary fields
  getCurrentUser() {
    if (!this.currentUser) return null;
    
    // Ensure role is set
    if (!this.currentUser.role || this.currentUser.role === 'Unknown User') {
      this.currentUser.role = this.determineUserRole(this.currentUser);
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
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

  // Update session timeout
  updateSession() {
    if (this.currentUser) {
      const sessionExpiry = new Date(Date.now() + this.sessionTimeout).toISOString();
      this.currentUser.sessionExpiry = sessionExpiry;
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      this.debugLog('Session updated', { newExpiry: sessionExpiry });
    }
  }

  // Get properly formatted auth headers for API calls
  getAuthHeaders() {
    const user = this.getCurrentUser();
    if (!user) {
      this.debugLog('No auth headers - user not logged in');
      return {};
    }
    
    const headers = {
      'x-user-id': user.id || '',
      'x-user-role': user.role || 'doctor',
      'x-user-name': user.name || user.username || 'User',
      'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
    };
    
    this.debugLog('Auth headers generated', { 
      userId: headers['x-user-id'],
      userRole: headers['x-user-role'],
      userName: headers['x-user-name']
    });
    
    return headers;
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
      
      const isValid = response.data?.valid === true;
      this.debugLog('Session verification', { isValid });
      
      return isValid;
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
      
      this.debugLog('Password changed successfully');
      
      return {
        success: true,
        message: response.data.message || 'Password changed successfully'
      };
    } catch (error) {
      console.error('Password change failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to change password'
      };
    }
  }
}

// Create and export singleton instance
const authService = new AuthService();

// Freeze to prevent modifications
Object.freeze(authService);

// Export for use in app
export default authService;

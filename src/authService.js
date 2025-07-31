// authService.js - Azure Table Storage Authentication
import { TableClient } from '@azure/data-tables';
import CryptoJS from 'crypto-js';

class AuthService {
  constructor() {
    this.connectionString = null;
    this.usersTableClient = null;
    this.patientsTableClient = null;
    this.visitsTableClient = null;
    this.currentUser = null;
    this.sessionTimeout = parseInt(process.env.REACT_APP_SESSION_TIMEOUT) || 3600000; // 1 hour
    this.loginDuration = parseInt(process.env.REACT_APP_LOGIN_DURATION) || 43200000; // 12 hours
    this.inactivityTimer = null;
    this.isInitialized = false;
    
    // KEY FIX: Create a Promise that resolves when initialization is complete
    this.ready = this.initialize();
  }

  // Async initialization method
  async initialize() {
    try {
      console.log('=== AuthService Debug Info ===');
      console.log('All environment variables:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
      console.log('Starting AuthService initialization...');
      
      // Get connection string from environment OR temporary hardcode
      this.connectionString = process.env.REACT_APP_AZURE_STORAGE_CONNECTION_STRING || 
                              process.env.REACT_APP_STORAGE_CONNECTION_STRING ||
                              process.env.REACT_APP_CONNECTION_STRING ||
                              process.env.REACT_APP_AZURE_CONNECTION_STRING;
      
      // TEMPORARY: If environment variables aren't working, prompt user
      if (!this.connectionString || this.connectionString === 'your_connection_string_here' || this.connectionString === 'your_actual_connection_string_here') {
        console.error('❌ No environment variables found. Available variables:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
        
        // Temporary fallback - ask user to paste connection string
        const userConnectionString = prompt(
          "Environment variables not working. Please paste your Azure Storage connection string:\n\n" +
          "Go to Azure Portal → aayuscribestorage → Access keys → Connection string"
        );
        
        if (userConnectionString && userConnectionString.startsWith('DefaultEndpointsProtocol=https')) {
          this.connectionString = userConnectionString;
          console.log('✅ Using user-provided connection string');
        } else {
          throw new Error('No valid connection string provided');
        }
      }

      console.log('✅ Connection string found, creating table clients...');
      
      // Initialize table clients
      this.usersTableClient = new TableClient(this.connectionString, 'users');
      this.patientsTableClient = new TableClient(this.connectionString, 'patients');  
      this.visitsTableClient = new TableClient(this.connectionString, 'visits');

      // PERFORMANCE FIX: Skip table creation in production (tables should already exist)
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (isProduction) {
        console.log('✅ Production mode - assuming tables exist, skipping creation');
      } else {
        console.log('✅ Development mode - creating tables if needed...');
        
        // Create tables in parallel without storing results
        await Promise.allSettled([
          this.usersTableClient.createTable(),
          this.patientsTableClient.createTable(),
          this.visitsTableClient.createTable()
        ]);
        
        console.log('✅ Tables created/verified');
      }

      console.log('✅ Creating super admin if needed...');
      
      // Create super admin if no users exist
      await this.createSuperAdminIfNeeded();
      
      this.isInitialized = true;
      console.log('✅ AuthService initialization complete!');
      
      // Return success (this resolves the this.ready Promise)
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize AuthService:', error);
      console.error('Error details:', error.message);
      this.isInitialized = false;
      throw error; // This will reject the this.ready Promise
    }
  }

  // Create default super admin account
  async createSuperAdminIfNeeded() {
    try {
      const users = this.usersTableClient.listEntities();
      const userList = [];
      for await (const user of users) {
        userList.push(user);
      }

      if (userList.length === 0) {
        const superAdmin = {
          partitionKey: 'user',
          rowKey: 'darshan@aayuwell.com',
          username: 'darshan@aayuwell.com',
          passwordHash: this.hashPassword('Aayuscribe1212@'),
          role: 'super_admin',
          name: 'Dr. Darshan Patel',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          isActive: true
        };

        await this.usersTableClient.createEntity(superAdmin);
        console.log('Super admin account created');
      }
    } catch (error) {
      console.error('Failed to create super admin:', error);
    }
  }

  // Hash password securely
  hashPassword(password) {
    return CryptoJS.SHA256(password + 'aayuwell_salt').toString();
  }

  // Simple token generation (replacing complex JWT)
  generateToken(user) {
    const tokenData = {
      userId: user.rowKey,
      username: user.username,
      role: user.role,
      name: user.name,
      expires: Date.now() + this.loginDuration,
      issued: Date.now()
    };
    
    // Simple base64 encoding (for demo - in production use proper JWT)
    return btoa(JSON.stringify(tokenData));
  }

  // Simple token verification
  verifyToken(token) {
    try {
      const tokenData = JSON.parse(atob(token));
      
      // Check if token is expired
      if (Date.now() > tokenData.expires) {
        return null;
      }
      
      return tokenData;
    } catch (error) {
      return null;
    }
  }

  // Login user
  async login(username, password) {
    try {
      // CRITICAL: Wait for initialization to complete before proceeding
      await this.ready;
      
      if (!this.isInitialized) {
        throw new Error('Authentication service failed to initialize');
      }

      const userEntity = await this.usersTableClient.getEntity('user', username);
      
      if (!userEntity || !userEntity.isActive) {
        throw new Error('Invalid credentials or account disabled');
      }

      const hashedPassword = this.hashPassword(password);
      if (userEntity.passwordHash !== hashedPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = this.generateToken(userEntity);

      // Store in localStorage
      localStorage.setItem('authToken', token);
      localStorage.setItem('lastActivity', Date.now().toString());

      this.currentUser = {
        id: userEntity.rowKey,
        username: userEntity.username,
        role: userEntity.role,
        name: userEntity.name
      };

      this.startInactivityTimer();
      return this.currentUser;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Login failed: ' + error.message);
    }
  }

  // Load current user from localStorage
  async loadCurrentUser() {
    try {
      // CRITICAL: Wait for initialization to complete before proceeding
      await this.ready;
      
      if (!this.isInitialized) {
        console.log('AuthService not initialized, cannot load user');
        return null;
      }

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

      this.currentUser = {
        id: payload.userId,
        username: payload.username,
        role: payload.role,
        name: payload.name
      };

      this.startInactivityTimer();
      return this.currentUser;
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

  // Update last activity timestamp
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
      window.location.reload(); // Force re-login
    }, this.sessionTimeout);
  }

  // Check permissions
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

    // Super admin can edit all notes
    if (this.currentUser.role === 'super_admin') {
      return true;
    }

    // Others can only edit their own notes
    return visitCreatedBy === this.currentUser.id;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Create new user (admin and super_admin only)
  async createUser(userData) {
    try {
      await this.ready; // Wait for initialization
      
      if (!this.hasPermission('add_users')) {
        throw new Error('Insufficient permissions');
      }

      const userEntity = {
        partitionKey: 'user',
        rowKey: userData.username,
        username: userData.username,
        passwordHash: this.hashPassword(userData.password),
        role: userData.role,
        name: userData.name,
        createdAt: new Date().toISOString(),
        createdBy: this.currentUser.id,
        isActive: true
      };

      await this.usersTableClient.createEntity(userEntity);
      return { success: true, message: 'User created successfully' };
    } catch (error) {
      throw new Error('Failed to create user: ' + error.message);
    }
  }

  // Patient management methods
  async savePatient(patient) {
    try {
      await this.ready; // Wait for initialization
      
      if (!this.hasPermission('add_patients')) {
        throw new Error('Insufficient permissions');
      }

      const patientEntity = {
        partitionKey: 'patient',
        rowKey: patient.id.toString(),
        ...patient,
        createdBy: this.currentUser.id,
        createdByName: this.currentUser.name,
        lastModified: new Date().toISOString()
      };

      await this.patientsTableClient.upsertEntity(patientEntity);
      this.updateActivity();
      return patientEntity;
    } catch (error) {
      throw new Error('Failed to save patient: ' + error.message);
    }
  }

  async getPatients() {
    try {
      await this.ready; // Wait for initialization
      
      const patients = [];
      const entities = this.patientsTableClient.listEntities();
      
      for await (const entity of entities) {
        patients.push(entity);
      }

      this.updateActivity();
      return patients;
    } catch (error) {
      console.error('Failed to load patients:', error);
      return [];
    }
  }

  // Visit management methods
  async saveVisit(patientId, visit) {
    try {
      await this.ready; // Wait for initialization
      
      if (!this.hasPermission('scribe')) {
        throw new Error('Insufficient permissions');
      }

      const visitEntity = {
        partitionKey: patientId.toString(),
        rowKey: visit.id.toString(),
        ...visit,
        createdBy: this.currentUser.id,
        createdByName: this.currentUser.name
      };

      await this.visitsTableClient.upsertEntity(visitEntity);
      this.updateActivity();
      return visitEntity;
    } catch (error) {
      throw new Error('Failed to save visit: ' + error.message);
    }
  }

  async getVisits(patientId) {
    try {
      await this.ready; // Wait for initialization
      
      const visits = [];
      const entities = this.visitsTableClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${patientId}'` }
      });
      
      for await (const entity of entities) {
        // Check if user can read this visit
        if (this.hasPermission('read_all_notes') || entity.createdBy === this.currentUser.id) {
          visits.push(entity);
        }
      }

      this.updateActivity();
      return visits;
    } catch (error) {
      console.error('Failed to load visits:', error);
      return [];
    }
  }

  // Check if service is ready (deprecated - use await authService.ready instead)
  isReady() {
    return this.isInitialized;
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;

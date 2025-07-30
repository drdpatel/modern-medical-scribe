// authService.js - Azure Table Storage Authentication
import { TableClient } from '@azure/data-tables';
import CryptoJS from 'crypto-js';
import * as jose from 'jose';

class AuthService {
  constructor() {
    this.connectionString = process.env.REACT_APP_AZURE_STORAGE_CONNECTION_STRING;
    this.usersTableClient = null;
    this.patientsTableClient = null;
    this.visitsTableClient = null;
    this.currentUser = null;
    this.sessionTimeout = parseInt(process.env.REACT_APP_SESSION_TIMEOUT) || 3600000; // 1 hour
    this.loginDuration = parseInt(process.env.REACT_APP_LOGIN_DURATION) || 43200000; // 12 hours
    this.inactivityTimer = null;
    
    this.initializeTables();
    this.loadCurrentUser();
    this.startInactivityTimer();
  }

  // Initialize Azure Table Storage clients
  async initializeTables() {
    try {
      if (!this.connectionString || this.connectionString === 'your_connection_string_here') {
        console.warn('Azure connection string not configured');
        return;
      }

      this.usersTableClient = new TableClient(this.connectionString, 'users');
      this.patientsTableClient = new TableClient(this.connectionString, 'patients');
      this.visitsTableClient = new TableClient(this.connectionString, 'visits');

      // Create tables if they don't exist
      await this.usersTableClient.createTable();
      await this.patientsTableClient.createTable();
      await this.visitsTableClient.createTable();

      // Create super admin if no users exist
      await this.createSuperAdminIfNeeded();
    } catch (error) {
      console.error('Failed to initialize tables:', error);
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

  // Generate JWT token
  async generateToken(user) {
    const secret = new TextEncoder().encode('aayuwell_jwt_secret_key_2024');
    const payload = {
      userId: user.rowKey,
      username: user.username,
      role: user.role,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + (this.loginDuration / 1000)
    };

    const jwt = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('12h')
      .sign(secret);

    return jwt;
  }

  // Verify JWT token
  async verifyToken(token) {
    try {
      const secret = new TextEncoder().encode('aayuwell_jwt_secret_key_2024');
      const { payload } = await jose.jwtVerify(token, secret);
      return payload;
    } catch (error) {
      return null;
    }
  }

  // Login user
  async login(username, password) {
    try {
      if (!this.usersTableClient) {
        throw new Error('Authentication service not initialized');
      }

      const userEntity = await this.usersTableClient.getEntity('user', username);
      
      if (!userEntity || !userEntity.isActive) {
        throw new Error('Invalid credentials');
      }

      const hashedPassword = this.hashPassword(password);
      if (userEntity.passwordHash !== hashedPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = await this.generateToken(userEntity);

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
      throw new Error('Login failed: ' + error.message);
    }
  }

  // Load current user from localStorage
  async loadCurrentUser() {
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

      const payload = await this.verifyToken(token);
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

  // Check if service is ready
  isReady() {
    return this.usersTableClient !== null;
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;

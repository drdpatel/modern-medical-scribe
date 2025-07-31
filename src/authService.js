// authService.js - Simple localStorage authentication
class AuthService {
  constructor() {
    this.users = {
      'darshan@aayuwell.com': { name: 'Dr. Darshan Patel', role: 'super_admin', password: 'Aayuscribe1212@' },
      'admin': { name: 'Admin User', role: 'admin', password: 'admin123' },
      'doctor': { name: 'Dr. Provider', role: 'medical_provider', password: 'doctor123' },
      'staff': { name: 'Support Staff', role: 'support_staff', password: 'staff123' }
    };
    
    this.currentUser = this.loadCurrentUser();
    this.sessionTimeout = 3600000; // 1 hour
    
    if (this.currentUser) {
      this.startInactivityTimer();
    }
  }

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

  createUser(userData) {
    if (!this.hasPermission('add_users')) {
      throw new Error('Insufficient permissions');
    }
    return { success: true, message: 'User creation logged (update environment config to add permanently)' };
  }

  getPatients() {
    try {
      const patients = localStorage.getItem('medicalScribePatients');
      return patients ? JSON.parse(patients) : [];
    } catch (error) {
      return [];
    }
  }

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

  getVisits(patientId) {
    try {
      const visits = localStorage.getItem(`visits_${patientId}`);
      const allVisits = visits ? JSON.parse(visits) : [];
      
      const filteredVisits = allVisits.filter(visit => {
        return this.hasPermission('read_all_notes') || visit.createdBy === this.currentUser.id;
      });

      this.updateActivity();
      return filteredVisits;
    } catch (error) {
      return [];
    }
  }

  saveVisit(patientId, visit) {
    if (!this.hasPermission('scribe')) {
      throw new Error('Insufficient permissions');
    }

    try {
      const existingVisits = localStorage.getItem(`visits_${patientId}`);
      const visits = existingVisits ? JSON.parse(existingVisits) : [];
      
      const visitWithMeta = {
        ...visit,
        createdBy: this.currentUser.id,
        createdByName: this.currentUser.name,
        lastModified: new Date().toISOString()
      };

      const existingIndex = visits.findIndex(v => v.id === visit.id);
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

  isReady() {
    return true;
  }
}

const authService = new AuthService();
export default authService;

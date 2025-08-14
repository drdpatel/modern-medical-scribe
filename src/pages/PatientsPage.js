import React from 'react';
import authService from '../authService';
import { calculateAge } from '../utils/helpers';
import apiService from '../services/api';

const PatientsPage = ({
  patients,
  searchTerm,
  setSearchTerm,
  onAddPatient,
  onPatientClick
}) => {
  
  // Filter patients based on search term
  const filteredPatients = React.useMemo(() => {
    if (!searchTerm?.trim()) return patients;
    
    const term = searchTerm.toLowerCase();
    return patients.filter(patient => {
      if (!patient) return false;
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      const dob = patient.dateOfBirth || '';
      const phone = patient.phone || '';
      const email = (patient.email || '').toLowerCase();
      return fullName.includes(term) || dob.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [patients, searchTerm]);

  // Handle edit patient
  const handleEditPatient = (patient) => {
    // This should trigger the edit modal in App.js
    // For now, we'll just navigate to the patient view
    onPatientClick(patient);
  };

  // Handle delete patient
  const handleDeletePatient = async (patientId) => {
    try {
      if (!authService?.hasPermission('delete_patients')) {
        alert('You do not have permission to delete patients');
        return;
      }

      if (window.confirm('Are you sure you want to delete this patient? This action cannot be undone.')) {
        await apiService.deletePatient(patientId);
        // Reload the page or update the patients list
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Failed to delete patient: ' + error.message);
    }
  };

  return (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Patient Management</h2>
        {authService?.hasPermission('add_patients') && (
          <button className="btn btn-glass-primary" onClick={onAddPatient}>
            Add New Patient
          </button>
        )}
      </div>

      <div className="card glass-card">
        <h3 className="card-title">Patient List</h3>
        
        <input
          type="text"
          className="search-input"
          placeholder="Search patients by name, date of birth, phone, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <div className="search-results">{filteredPatients.length} patient(s) found</div>

        <div className="patient-list">
          {filteredPatients.map(patient => (
            <div 
              key={patient.id} 
              className="patient-card-simple"
              style={{ position: 'relative' }}
            >
              <div 
                onClick={() => onPatientClick(patient)}
                style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <div className="patient-info">
                  <div className="patient-name-clickable">{patient.firstName} {patient.lastName}</div>
                  <div className="patient-id">Patient ID: {patient.id}</div>
                  <div className="patient-dob">DOB: {patient.dateOfBirth} ({calculateAge(patient.dateOfBirth)} yo)</div>
                  {patient.phone && <div className="patient-contact">Phone: {patient.phone}</div>}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="patient-visits">{patient.visits?.length || 0} visits</div>
                
                {authService?.hasPermission('edit_patients') && (
                  <button 
                    className="btn-text"
                    style={{ fontSize: '13px', padding: '6px 10px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPatient(patient);
                    }}
                  >
                    Edit
                  </button>
                )}
                
                {authService?.hasPermission('delete_patients') && (
                  <button 
                    className="btn-text"
                    style={{ fontSize: '13px', color: 'var(--error)', padding: '6px 10px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePatient(patient.id);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredPatients.length === 0 && (
          <div className="empty-state">
            {searchTerm ? 
              'No patients found matching your search.' : 
              authService?.hasPermission('add_patients') ? 
                'No patients yet. Add your first patient to get started.' : 
                'No patients available. Contact an administrator to add patients.'}
          </div>
        )}
      </div>

      {/* Information Card */}
      <div className="card glass-card" style={{ marginTop: '24px' }}>
        <h3 className="card-title">Quick Stats</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '16px' 
        }}>
          <div style={{ 
            padding: '16px', 
            background: 'rgba(186, 230, 55, 0.1)', 
            borderRadius: '12px',
            border: '1px solid rgba(186, 230, 55, 0.2)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--primary-navy)' }}>
              {patients.length}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Total Patients</div>
          </div>
          
          <div style={{ 
            padding: '16px', 
            background: 'rgba(155, 47, 205, 0.05)', 
            borderRadius: '12px',
            border: '1px solid rgba(155, 47, 205, 0.2)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--accent-purple)' }}>
              {patients.reduce((sum, p) => sum + (p.visits?.length || 0), 0)}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Total Visits</div>
          </div>
          
          <div style={{ 
            padding: '16px', 
            background: 'rgba(59, 130, 246, 0.05)', 
            borderRadius: '12px',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#3b82f6' }}>
              {patients.filter(p => {
                const today = new Date().toDateString();
                return p.visits?.some(v => new Date(v.date).toDateString() === today);
              }).length}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gray-dark)' }}>Seen Today</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientsPage;

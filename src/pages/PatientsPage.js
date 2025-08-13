import React from 'react';
import authService from '../authService';
import { calculateAge } from '../utils/helpers';

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
              onClick={() => onPatientClick(patient)}
            >
              <div className="patient-info">
                <div className="patient-name-clickable">{patient.firstName} {patient.lastName}</div>
                <div className="patient-id">Patient ID: {patient.id}</div>
                <div className="patient-dob">DOB: {patient.dateOfBirth} ({calculateAge(patient.dateOfBirth)} yo)</div>
                {patient.phone && <div className="patient-contact">Phone: {patient.phone}</div>}
              </div>
              
              <div className="patient-visits">{patient.visits?.length || 0} visits</div>
            </div>
          ))}
        </div>

        {filteredPatients.length === 0 && (
          <div className="empty-state">
            No patients found. {authService?.hasPermission('add_patients') ? 'Add your first patient to get started.' : 'Contact an administrator to add patients.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientsPage;

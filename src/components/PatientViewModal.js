import React from 'react';
import { calculateAge } from '../utils/helpers';
import { MEDICAL_SPECIALTIES } from '../utils/constants';

const PatientViewModal = ({ 
  show, 
  onClose, 
  patient,
  onEdit,
  onViewNote,
  isQuickView = false
}) => {
  if (!show || !patient) return null;

  // Quick view version - simplified
  if (isQuickView) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h3 className="modal-title">{patient.firstName} {patient.lastName}</h3>
              <p className="modal-subtitle">Quick View</p>
            </div>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="patient-quick-view">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">DOB:</span>
                <span className="info-value">{patient.dateOfBirth} ({calculateAge(patient.dateOfBirth)} yo)</span>
              </div>
              <div className="info-item">
                <span className="info-label">Gender:</span>
                <span className="info-value">{patient.gender || 'Not specified'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phone:</span>
                <span className="info-value">{patient.phone || 'Not provided'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{patient.email || 'Not provided'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Insurance:</span>
                <span className="info-value">{patient.insurance || 'Not provided'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Allergies:</span>
                <span className="info-value">{patient.allergies || 'NKDA'}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn btn-glass-primary"
                onClick={() => {
                  onClose();
                  onEdit(patient);
                }}
              >
                View Full Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full view version
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-modal patient-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Patient Profile</h3>
            <p className="modal-subtitle">ID: {patient.id}</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="patient-profile-view">
          <div className="profile-section">
            <h4 className="profile-section-title">Basic Information</h4>
            <div className="profile-grid">
              <div className="profile-item">
                <span className="profile-label">Name:</span>
                <span className="profile-value">{patient.firstName} {patient.lastName}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Date of Birth:</span>
                <span className="profile-value">{patient.dateOfBirth} ({calculateAge(patient.dateOfBirth)} years old)</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Gender:</span>
                <span className="profile-value">{patient.gender || 'Not specified'}</span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h4 className="profile-section-title">Contact Information</h4>
            <div className="profile-grid">
              <div className="profile-item">
                <span className="profile-label">Phone:</span>
                <span className="profile-value">{patient.phone || 'Not provided'}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Email:</span>
                <span className="profile-value">{patient.email || 'Not provided'}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Address:</span>
                <span className="profile-value">
                  {patient.address ? 
                    `${patient.address}, ${patient.city || ''} ${patient.state || ''} ${patient.zipCode || ''}`.trim() : 
                    'Not provided'}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h4 className="profile-section-title">Emergency & Insurance</h4>
            <div className="profile-grid">
              <div className="profile-item">
                <span className="profile-label">Emergency Contact:</span>
                <span className="profile-value">{patient.emergencyContact || 'Not provided'}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Emergency Phone:</span>
                <span className="profile-value">{patient.emergencyPhone || 'Not provided'}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Insurance:</span>
                <span className="profile-value">{patient.insurance || 'Not provided'}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Policy Number:</span>
                <span className="profile-value">{patient.policyNumber || 'Not provided'}</span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h4 className="profile-section-title">Medical Information</h4>
            <div className="profile-grid">
              <div className="profile-item">
                <span className="profile-label">Primary Physician:</span>
                <span className="profile-value">{patient.primaryPhysician || 'Not assigned'}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Preferred Pharmacy:</span>
                <span className="profile-value">{patient.preferredPharmacy || 'Not specified'}</span>
              </div>
              <div className="profile-item full-width">
                <span className="profile-label">Allergies:</span>
                <span className="profile-value">{patient.allergies || 'NKDA'}</span>
              </div>
              <div className="profile-item full-width">
                <span className="profile-label">Medical History:</span>
                <span className="profile-value">{patient.medicalHistory || 'No significant medical history'}</span>
              </div>
              <div className="profile-item full-width">
                <span className="profile-label">Current Medications:</span>
                <span className="profile-value">{patient.medications || 'No current medications'}</span>
              </div>
            </div>
          </div>

          <div className="profile-section">
            <h4 className="profile-section-title">Visit History</h4>
            <div className="visit-timeline">
              {patient.visits?.length > 0 ? (
                patient.visits.slice(-5).reverse().map(visit => (
                  <div key={visit.id} className="visit-timeline-item">
                    <div className="visit-timeline-header">
                      <span className="visit-date">{visit.date} at {visit.time}</span>
                      <button 
                        className="btn-text"
                        onClick={() => onViewNote(visit)}
                      >
                        View Note
                      </button>
                    </div>
                    <div className="visit-timeline-content">
                      <div className="visit-meta">
                        {MEDICAL_SPECIALTIES[visit.specialty]?.name} - {MEDICAL_SPECIALTIES[visit.specialty]?.noteTypes[visit.noteType]}
                      </div>
                      <div className="visit-preview">
                        {visit.notes.substring(0, 150)}...
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">No visits recorded yet</div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="btn btn-glass"
            onClick={() => onEdit(patient)}
          >
            Edit Patient
          </button>
          <button 
            className="btn btn-glass-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientViewModal;

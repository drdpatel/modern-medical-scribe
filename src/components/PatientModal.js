import React from 'react';

const PatientModal = ({ 
  show, 
  onClose, 
  patientData, 
  setPatientData, 
  onSave, 
  isEditing = false 
}) => {
  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-modal patient-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{isEditing ? 'Edit Patient' : 'Add New Patient'}</h3>
            <p className="modal-subtitle">Enter patient information</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="patient-form-grid">
            <div className="form-section">
              <h4 className="form-section-title">Basic Information</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.firstName}
                    onChange={(e) => setPatientData({...patientData, firstName: e.target.value})}
                    placeholder="Enter first name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.lastName}
                    onChange={(e) => setPatientData({...patientData, lastName: e.target.value})}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date of Birth *</label>
                  <input
                    type="date" 
                    className="form-input glass-input"
                    value={patientData.dateOfBirth}
                    onChange={(e) => setPatientData({...patientData, dateOfBirth: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select 
                    className="form-input glass-input"
                    value={patientData.gender}
                    onChange={(e) => setPatientData({...patientData, gender: e.target.value})}
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">Contact Information</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel" 
                    className="form-input glass-input"
                    value={patientData.phone}
                    onChange={(e) => setPatientData({...patientData, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email" 
                    className="form-input glass-input"
                    value={patientData.email}
                    onChange={(e) => setPatientData({...patientData, email: e.target.value})}
                    placeholder="patient@email.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text" 
                  className="form-input glass-input"
                  value={patientData.address}
                  onChange={(e) => setPatientData({...patientData, address: e.target.value})}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.city}
                    onChange={(e) => setPatientData({...patientData, city: e.target.value})}
                    placeholder="City"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.state}
                    onChange={(e) => setPatientData({...patientData, state: e.target.value})}
                    placeholder="IL"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">ZIP</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.zipCode}
                    onChange={(e) => setPatientData({...patientData, zipCode: e.target.value})}
                    placeholder="60169"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">Emergency & Insurance</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Emergency Contact</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.emergencyContact}
                    onChange={(e) => setPatientData({...patientData, emergencyContact: e.target.value})}
                    placeholder="Name of emergency contact"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Emergency Phone</label>
                  <input
                    type="tel" 
                    className="form-input glass-input"
                    value={patientData.emergencyPhone}
                    onChange={(e) => setPatientData({...patientData, emergencyPhone: e.target.value})}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Insurance Provider</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.insurance}
                    onChange={(e) => setPatientData({...patientData, insurance: e.target.value})}
                    placeholder="Insurance company name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Policy Number</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.policyNumber}
                    onChange={(e) => setPatientData({...patientData, policyNumber: e.target.value})}
                    placeholder="Policy #"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4 className="form-section-title">Medical Information</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Primary Physician</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.primaryPhysician}
                    onChange={(e) => setPatientData({...patientData, primaryPhysician: e.target.value})}
                    placeholder="Dr. Smith"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Preferred Pharmacy</label>
                  <input
                    type="text" 
                    className="form-input glass-input"
                    value={patientData.preferredPharmacy}
                    onChange={(e) => setPatientData({...patientData, preferredPharmacy: e.target.value})}
                    placeholder="CVS on Main St"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Allergies</label>
                <textarea
                  className="form-textarea glass-input"
                  value={patientData.allergies}
                  onChange={(e) => setPatientData({...patientData, allergies: e.target.value})}
                  placeholder="List any known allergies..."
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Medical History</label>
                <textarea
                  className="form-textarea glass-input"
                  value={patientData.medicalHistory}
                  onChange={(e) => setPatientData({...patientData, medicalHistory: e.target.value})}
                  placeholder="Enter relevant medical history..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Current Medications</label>
                <textarea
                  className="form-textarea glass-input"
                  value={patientData.medications}
                  onChange={(e) => setPatientData({...patientData, medications: e.target.value})}
                  placeholder="List current medications..."
                  rows="3"
                />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-glass" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-glass-success">
              {isEditing ? 'Save Changes' : 'Save Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientModal;

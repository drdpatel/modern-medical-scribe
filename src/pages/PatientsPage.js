// src/pages/PatientsPage.js
// Complete patient management page with proper permissions and error handling

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import authService from '../authService';

const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    insurance: '',
    medicalHistory: '',
    medications: '',
    allergies: '',
    notes: ''
  });

  const apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  // Load patients from API
  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${apiBaseUrl}/patients`, {
        headers: authService.getAuthHeaders()
      });
      
      setPatients(response.data || []);
    } catch (err) {
      console.error('Error loading patients:', err);
      setError('Failed to load patients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!authService.hasPermission('add_patients') && !authService.hasPermission('edit_patients')) {
      setError('You do not have permission to add or edit patients');
      return;
    }
    
    try {
      setError(null);
      
      const patientData = {
        ...formData,
        id: editingPatient?.id || Date.now().toString(),
        createdBy: authService.getCurrentUser()?.id,
        createdAt: editingPatient?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (editingPatient) {
        // Update existing patient
        const response = await axios.put(
          `${apiBaseUrl}/patients/${editingPatient.id}`,
          patientData,
          { headers: authService.getAuthHeaders() }
        );
        
        setPatients(patients.map(p => 
          p.id === editingPatient.id ? response.data : p
        ));
      } else {
        // Add new patient
        const response = await axios.post(
          `${apiBaseUrl}/patients`,
          patientData,
          { headers: authService.getAuthHeaders() }
        );
        
        setPatients([...patients, response.data]);
      }
      
      // Reset form
      resetForm();
      setShowAddModal(false);
      setEditingPatient(null);
      
    } catch (err) {
      console.error('Error saving patient:', err);
      setError(err.response?.data?.error || 'Failed to save patient. Please try again.');
    }
  };

  // Delete patient
  const handleDelete = async (patientId) => {
    if (!authService.hasPermission('delete_patients')) {
      setError('You do not have permission to delete patients');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this patient?')) {
      return;
    }
    
    try {
      await axios.delete(
        `${apiBaseUrl}/patients/${patientId}`,
        { headers: authService.getAuthHeaders() }
      );
      
      setPatients(patients.filter(p => p.id !== patientId));
    } catch (err) {
      console.error('Error deleting patient:', err);
      setError('Failed to delete patient. Please try again.');
    }
  };

  // Edit patient
  const handleEdit = (patient) => {
    if (!authService.hasPermission('edit_patients')) {
      setError('You do not have permission to edit patients');
      return;
    }
    
    setFormData({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      city: patient.city || '',
      state: patient.state || '',
      zipCode: patient.zipCode || '',
      insurance: patient.insurance || '',
      medicalHistory: patient.medicalHistory || '',
      medications: patient.medications || '',
      allergies: patient.allergies || '',
      notes: patient.notes || ''
    });
    setEditingPatient(patient);
    setShowAddModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      insurance: '',
      medicalHistory: '',
      medications: '',
      allergies: '',
      notes: ''
    });
  };

  // Filter patients based on search
  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    return (
      patient.firstName?.toLowerCase().includes(searchLower) ||
      patient.lastName?.toLowerCase().includes(searchLower) ||
      patient.email?.toLowerCase().includes(searchLower) ||
      patient.phone?.includes(searchTerm)
    );
  });

  return (
    <div className="patients-page">
      <div className="page-header">
        <h1>Patient Management</h1>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search patients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {authService.hasPermission('add_patients') && (
            <button 
              onClick={() => {
                resetForm();
                setEditingPatient(null);
                setShowAddModal(true);
              }}
              className="btn btn-primary"
            >
              Add New Patient
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading patients...</div>
      ) : (
        <div className="patients-grid">
          {filteredPatients.length === 0 ? (
            <div className="no-patients">
              {searchTerm ? 'No patients found matching your search.' : 'No patients yet. Add your first patient to get started.'}
            </div>
          ) : (
            filteredPatients.map(patient => (
              <div key={patient.id} className="patient-card">
                <div className="patient-header">
                  <h3>{patient.firstName} {patient.lastName}</h3>
                  <div className="patient-actions">
                    {authService.hasPermission('edit_patients') && (
                      <button 
                        onClick={() => handleEdit(patient)}
                        className="btn btn-sm btn-secondary"
                      >
                        Edit
                      </button>
                    )}
                    {authService.hasPermission('delete_patients') && (
                      <button 
                        onClick={() => handleDelete(patient.id)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="patient-info">
                  <p><strong>DOB:</strong> {patient.dateOfBirth || 'N/A'}</p>
                  <p><strong>Phone:</strong> {patient.phone || 'N/A'}</p>
                  <p><strong>Email:</strong> {patient.email || 'N/A'}</p>
                  <p><strong>Insurance:</strong> {patient.insurance || 'N/A'}</p>
                  {patient.allergies && (
                    <p className="allergies"><strong>Allergies:</strong> {patient.allergies}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPatient ? 'Edit Patient' : 'Add New Patient'}</h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPatient(null);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="patient-form">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="(123) 456-7890"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="patient@email.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    maxLength="2"
                    placeholder="IL"
                  />
                </div>
                <div className="form-group">
                  <label>ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                    placeholder="12345"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Insurance Provider</label>
                <input
                  type="text"
                  value={formData.insurance}
                  onChange={(e) => setFormData({...formData, insurance: e.target.value})}
                  placeholder="Insurance Company Name"
                />
              </div>

              <div className="form-group">
                <label>Medical History</label>
                <textarea
                  value={formData.medicalHistory}
                  onChange={(e) => setFormData({...formData, medicalHistory: e.target.value})}
                  rows="3"
                  placeholder="Previous conditions, surgeries, etc."
                />
              </div>

              <div className="form-group">
                <label>Current Medications</label>
                <textarea
                  value={formData.medications}
                  onChange={(e) => setFormData({...formData, medications: e.target.value})}
                  rows="2"
                  placeholder="List current medications"
                />
              </div>

              <div className="form-group">
                <label>Allergies</label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                  placeholder="Drug allergies, food allergies, etc."
                />
              </div>

              <div className="form-group">
                <label>Additional Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="2"
                  placeholder="Any additional information"
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPatient(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPatient ? 'Update Patient' : 'Add Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;

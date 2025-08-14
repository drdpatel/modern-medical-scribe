import React from 'react';
import { MEDICAL_SPECIALTIES } from '../utils/constants';
import { formatDuration, calculateAge } from '../utils/helpers';
import authService from '../authService';

const ScribePage = ({
  patients,
  selectedPatient,
  setSelectedPatient,
  patientSearchTerm,
  setPatientSearchTerm,
  trainingData,
  onTrainingDataChange,
  isRecording,
  isPaused,
  recordingDuration,
  status,
  transcript,
  interimTranscript,
  medicalNotes,
  isProcessing,
  onToggleRecording,
  onStopRecording,
  onGenerateNotes,
  onSaveVisit,
  onAddPatient,
  onPatientQuickView
}) => {
  
  // Filter patients for dropdown
  const filteredPatientsForScribe = React.useMemo(() => {
    if (!patientSearchTerm?.trim()) return patients;
    
    const term = patientSearchTerm.toLowerCase();
    return patients.filter(patient => {
      if (!patient) return false;
      const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
      const dob = patient.dateOfBirth || '';
      return fullName.includes(term) || dob.includes(term);
    });
  }, [patients, patientSearchTerm]);

  if (!authService?.hasPermission('scribe')) {
    return (
      <div className="content-container">
        <div className="page-header">
          <h2 className="page-title">Medical Scribe</h2>
        </div>
        <div className="card glass-card">
          <h3 className="card-title">Access Denied</h3>
          <p>You do not have permission to access the scribe functionality.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">Medical Scribe</h2>
      </div>
      
      <div className="scribe-layout">
        {/* Left Panel - Encounter Details and Recording */}
        <div className="scribe-left-panel">
          {/* Encounter Details Card */}
          <div className="card glass-card encounter-card">
            <h3 className="card-title">Encounter Details</h3>
            
            {/* Patient Selection */}
            <div className="config-section">
              <label className="section-label">Patient</label>
              <div className="patient-search-container">
                <input
                  type="text"
                  className="form-input glass-input"
                  placeholder="Search patient by name..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                />
                
                {patientSearchTerm && filteredPatientsForScribe.length > 0 && (
                  <div className="search-dropdown glass-dropdown">
                    {filteredPatientsForScribe.map(patient => (
                      <div
                        key={patient.id}
                        className="search-dropdown-item"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientSearchTerm('');
                        }}
                      >
                        <strong>{patient.firstName} {patient.lastName}</strong>
                        <div className="dropdown-item-meta">DOB: {patient.dateOfBirth}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPatient ? (
                <div className="selected-patient-card-enhanced">
                  <div className="patient-info-compact">
                    <div 
                      className="patient-name-clickable"
                      onClick={() => onPatientQuickView(selectedPatient)}
                    >
                      <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                    </div>
                    <div className="patient-meta">
                      DOB: {selectedPatient.dateOfBirth} ({calculateAge(selectedPatient.dateOfBirth)} yo) | Visits: {selectedPatient.visits?.length || 0}
                    </div>
                  </div>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientSearchTerm('');
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="no-patient-selected">
                  No patient selected
                </div>
              )}

              {authService?.hasPermission('add_patients') && (
                <button 
                  className="btn btn-glass btn-small"
                  onClick={onAddPatient}
                >
                  Add New Patient
                </button>
              )}
            </div>

            {/* Note Type Selection - Modern Glass Style */}
            <div className="config-section">
              <label className="section-label">Note Type</label>
              <div className="custom-select-wrapper">
                <select 
                  className="form-select glass-select"
                  value={trainingData.noteType}
                  onChange={(e) => {
                    const newData = { ...trainingData, noteType: e.target.value };
                    onTrainingDataChange(newData);
                  }}
                >
                  {Object.entries(MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes || {}).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </select>
                <div className="select-arrow">▼</div>
              </div>
            </div>
          </div>

          {/* Recording Controls Card */}
          <div className="card glass-card recording-card">
            <h3 className="card-title">Recording Controls</h3>
            
            {isRecording && (
              <div className="recording-timer">
                Recording Time: {formatDuration(recordingDuration)}
              </div>
            )}
            
            <div className="recording-controls-horizontal">
              <button 
                className={`btn-record-oval ${isRecording && !isPaused ? 'recording' : isPaused ? 'paused' : ''}`}
                onClick={onToggleRecording}
              >
                {!isRecording && !isPaused ? 
                  'Start Recording' : 
                  isPaused ? 
                  'Resume Recording' : 
                  'Pause Recording'}
              </button>
              
              <button 
                className="btn btn-glass"
                onClick={onStopRecording}
                disabled={!isRecording && !isPaused}
              >
                Stop Recording
              </button>
            </div>

            <div className={`status-bar ${isRecording ? 'recording' : isPaused ? 'paused' : isProcessing ? 'processing' : 'ready'}`}>
              {status === 'Login successful - Ready to begin' ? 'Ready to begin' : status}
            </div>

            <div className="action-buttons">
              <button 
                className="btn btn-glass-subtle-accent"
                onClick={onGenerateNotes}
                disabled={!transcript || isProcessing}
              >
                {isProcessing ? 'Generating...' : 'Generate Notes'}
              </button>
              
              <button 
                className="btn btn-glass-subtle-success"
                onClick={onSaveVisit}
                disabled={!medicalNotes || !selectedPatient}
              >
                Save Visit
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Transcript and Notes */}
        <div className="scribe-right-panel">
          {/* Live Transcript */}
          <div className="card glass-card transcript-card">
            <h3 className="card-title">Live Transcript</h3>
            <div className="transcript-container-optimized">
              {transcript || interimTranscript ? (
                <span>
                  {transcript}
                  {interimTranscript && (
                    <span className="interim-text">
                      {transcript ? ' ' : ''}{interimTranscript}
                    </span>
                  )}
                </span>
              ) : (
                <span className="placeholder-text">Transcript will appear here as you speak...</span>
              )}
            </div>
          </div>

          {/* Generated Medical Notes */}
          <div className="card glass-card notes-card">
            <h3 className="card-title">Generated Medical Notes</h3>
            <div className="notes-container-optimized">
              {medicalNotes || <span className="placeholder-text">AI-generated medical notes will appear here...</span>}
            </div>
            {medicalNotes && !selectedPatient && (
              <div className="warning-banner">
                ⚠️ Please select a patient to save these notes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScribePage;

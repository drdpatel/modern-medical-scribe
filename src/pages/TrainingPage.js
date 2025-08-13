import React from 'react';
import { MEDICAL_SPECIALTIES } from '../utils/constants';
import authService from '../authService';

const TrainingPage = ({
  trainingData,
  uploadedNoteText,
  setUploadedNoteText,
  onSpecialtyChange,
  onNoteTypeChange,
  onAddBaselineNote,
  onRemoveBaselineNote
}) => {
  
  if (!authService?.hasPermission('scribe')) {
    return (
      <div className="content-container">
        <div className="page-header">
          <h2 className="page-title">AI Training Center</h2>
        </div>
        <div className="card glass-card">
          <h3 className="card-title">Access Denied</h3>
          <p>You do not have permission to access the training functionality.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">AI Training Center</h2>
      </div>

      {/* Training Configuration */}
      <div className="card glass-card">
        <h3 className="card-title">Current Training Configuration</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label className="form-label">Medical Specialty</label>
            <select 
              className="form-input glass-input"
              value={trainingData.specialty}
              onChange={(e) => onSpecialtyChange(e.target.value)}
            >
              {Object.entries(MEDICAL_SPECIALTIES).map(([key, specialty]) => (
                <option key={key} value={key}>{specialty.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Note Type</label>
            <select 
              className="form-input glass-input"
              value={trainingData.noteType}
              onChange={(e) => onNoteTypeChange(e.target.value)}
            >
              {Object.entries(MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes || {}).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ 
          padding: '16px', 
          backgroundColor: 'rgba(186, 230, 55, 0.1)', 
          borderRadius: '8px',
          border: '2px solid rgba(186, 230, 55, 0.3)',
          fontSize: '14px'
        }}>
          <strong>Current Settings:</strong> {MEDICAL_SPECIALTIES[trainingData.specialty]?.name} - {MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType]}
          <br />
          <strong>Baseline Notes:</strong> {trainingData.baselineNotes?.length || 0} uploaded
        </div>
      </div>

      {/* Add Baseline Note */}
      <div className="card glass-card">
        <h3 className="card-title">Add Baseline Note</h3>
        <p style={{ color: 'var(--gray-dark)', marginBottom: '16px' }}>
          Upload examples of your preferred note style. The AI will learn from these to match your documentation preferences.
        </p>

        <div className="form-group">
          <label className="form-label">Paste Previous Note (up to 5 notes stored)</label>
          <textarea
            className="form-textarea glass-input"
            style={{ minHeight: '200px' }}
            value={uploadedNoteText}
            onChange={(e) => setUploadedNoteText(e.target.value)}
            placeholder={`Paste a ${MEDICAL_SPECIALTIES[trainingData.specialty]?.noteTypes[trainingData.noteType] || 'medical note'} here...

Example:
CHIEF COMPLAINT: Follow-up visit for hypertension

HISTORY OF PRESENT ILLNESS:
Mr. Smith is a 55-year-old male with a history of hypertension...

etc.`}
          />
        </div>

        <button 
          className="btn btn-glass-success"
          onClick={onAddBaselineNote}
          disabled={!uploadedNoteText?.trim()}
        >
          Add to Baseline
        </button>
      </div>

      {/* Current Baseline Notes */}
      <div className="card glass-card">
        <h3 className="card-title">Current Baseline Notes ({trainingData.baselineNotes?.length || 0}/5)</h3>
        
        {!trainingData.baselineNotes?.length ? (
          <div className="empty-state">
            No baseline notes uploaded yet. Add your first example note above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trainingData.baselineNotes.map((note, index) => (
              <div key={note.id} style={{ 
                border: '2px solid var(--primary-navy)', 
                borderRadius: '8px', 
                padding: '16px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div>
                    <strong>Note #{index + 1}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--gray-dark)' }}>
                      {MEDICAL_SPECIALTIES[note.specialty]?.name} - {MEDICAL_SPECIALTIES[note.specialty]?.noteTypes[note.noteType]}
                      <br />
                      Added: {new Date(note.dateAdded).toLocaleDateString()} by {note.addedBy}
                    </div>
                  </div>
                  <button 
                    className="btn btn-glass btn-small"
                    onClick={() => onRemoveBaselineNote(note.id)}
                  >
                    Remove
                  </button>
                </div>
                
                <div style={{ 
                  backgroundColor: '#f9fafb', 
                  padding: '12px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  maxHeight: '150px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace'
                }}>
                  {(note.content || '').substring(0, 500)}
                  {(note.content || '').length > 500 && '...'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingPage;

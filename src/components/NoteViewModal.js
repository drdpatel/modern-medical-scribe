import React from 'react';
import { MEDICAL_SPECIALTIES } from '../utils/constants';

const NoteViewModal = ({ 
  show, 
  onClose, 
  note 
}) => {
  if (!show || !note) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Visit Note</h3>
            <p className="modal-subtitle">
              {note.date} at {note.time}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="note-view">
          <div className="note-metadata">
            <div className="metadata-item">
              <span className="metadata-label">Type:</span>
              <span className="metadata-value">
                {MEDICAL_SPECIALTIES[note.specialty]?.name} - {MEDICAL_SPECIALTIES[note.specialty]?.noteTypes[note.noteType]}
              </span>
            </div>
            <div className="metadata-item">
              <span className="metadata-label">Created By:</span>
              <span className="metadata-value">{note.createdBy}</span>
            </div>
          </div>

          <div className="note-content">
            <h4>Clinical Notes</h4>
            <div className="note-text">
              {note.notes}
            </div>
          </div>

          {note.transcript && (
            <div className="note-transcript">
              <h4>Original Transcript</h4>
              <div className="transcript-text">
                {note.transcript}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-glass" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteViewModal;

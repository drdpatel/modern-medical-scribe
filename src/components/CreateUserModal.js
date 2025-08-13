import React from 'react';
import { USER_ROLES } from '../utils/constants';

const CreateUserModal = ({ 
  show, 
  onClose, 
  userData, 
  setUserData, 
  onSubmit 
}) => {
  if (!show) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Create New User</h3>
            <p className="modal-subtitle">Add a new user to the system</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text" 
              className="form-input glass-input"
              value={userData.name}
              onChange={(e) => setUserData({...userData, name: e.target.value})}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Username *</label>
            <input
              type="text" 
              className="form-input glass-input"
              value={userData.username}
              onChange={(e) => setUserData({...userData, username: e.target.value})}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role *</label>
            <select 
              className="form-input glass-input"
              value={userData.role}
              onChange={(e) => setUserData({...userData, role: e.target.value})}
              required
            >
              {USER_ROLES.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password" 
              className="form-input glass-input"
              value={userData.password}
              onChange={(e) => setUserData({...userData, password: e.target.value})}
              placeholder="Enter password (min 8 characters)"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password *</label>
            <input
              type="password" 
              className="form-input glass-input"
              value={userData.confirmPassword}
              onChange={(e) => setUserData({...userData, confirmPassword: e.target.value})}
              placeholder="Confirm password"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-glass" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-glass-success">
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;

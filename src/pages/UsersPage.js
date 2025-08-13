import React from 'react';

const UsersPage = ({ onCreateUser }) => {
  return (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">User Management</h2>
      </div>

      <div className="card glass-card">
        <h3 className="card-title">System Users</h3>
        
        <div style={{ 
          marginBottom: '16px', 
          padding: '12px', 
          backgroundColor: 'rgba(186, 230, 55, 0.1)', 
          borderRadius: '8px', 
          border: '2px solid rgba(186, 230, 55, 0.3)' 
        }}>
          <strong>Current Users:</strong>
          <div style={{ marginTop: '8px' }}>
            • darshan@aayuwell.com - Dr. Darshan Patel (Super Admin)<br />
            • admin - Admin User (Admin)<br />
            • doctor - Dr. Provider (Medical Provider)<br />
            • staff - Support Staff (Support Staff)
          </div>
        </div>

        <button 
          className="btn btn-glass-success"
          onClick={onCreateUser}
        >
          Add New User
        </button>
        
        <div style={{ 
          marginTop: '16px', 
          padding: '16px', 
          backgroundColor: 'rgba(63, 81, 181, 0.05)', 
          borderRadius: '8px', 
          fontSize: '14px', 
          color: 'var(--gray-dark)' 
        }}>
          <strong>Note:</strong> User creation is currently in demo mode. Contact your IT administrator to permanently add users.
        </div>
      </div>
    </div>
  );
};

export default UsersPage;

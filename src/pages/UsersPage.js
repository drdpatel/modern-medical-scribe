import React from 'react';

const UsersPage = ({ onCreateUser }) => {
  // This would normally fetch from API
  const systemUsers = [
    { 
      username: 'darshan@aayuwell.com', 
      name: 'Dr. Darshan Patel', 
      role: 'Super Admin',
      status: 'Active',
      lastLogin: 'Today at 2:30 PM'
    },
    { 
      username: 'admin', 
      name: 'Admin User', 
      role: 'Administrator',
      status: 'Active',
      lastLogin: 'Yesterday at 4:15 PM'
    },
    { 
      username: 'doctor', 
      name: 'Dr. Provider', 
      role: 'Medical Provider',
      status: 'Active',
      lastLogin: 'Today at 9:00 AM'
    },
    { 
      username: 'staff', 
      name: 'Support Staff', 
      role: 'Support Staff',
      status: 'Active',
      lastLogin: '3 days ago'
    }
  ];

  return (
    <div className="content-container">
      <div className="page-header">
        <h2 className="page-title">User Management</h2>
        <button 
          className="btn btn-glass-primary"
          onClick={onCreateUser}
        >
          Add New User
        </button>
      </div>

      <div className="card glass-card">
        <h3 className="card-title">Active Users ({systemUsers.length})</h3>
        
        <div style={{ 
          display: 'grid',
          gap: '12px'
        }}>
          {systemUsers.map((user, index) => (
            <div 
              key={index}
              style={{ 
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.5)',
                borderRadius: '12px',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(4px)';
                e.currentTarget.style.borderColor = 'rgba(186, 230, 55, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.05)';
              }}
            >
              <div>
                <div style={{ fontWeight: '600', color: 'var(--primary-navy)', fontSize: '15px' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--gray-dark)' }}>
                  {user.username}
                </div>
              </div>
              
              <div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: user.role === 'Super Admin' ? 'rgba(155, 47, 205, 0.1)' :
                             user.role === 'Administrator' ? 'rgba(59, 130, 246, 0.1)' :
                             user.role === 'Medical Provider' ? 'rgba(186, 230, 55, 0.1)' :
                             'rgba(107, 114, 128, 0.1)',
                  color: user.role === 'Super Admin' ? 'var(--accent-purple)' :
                         user.role === 'Administrator' ? '#3b82f6' :
                         user.role === 'Medical Provider' ? 'var(--primary-navy)' :
                         'var(--gray-dark)'
                }}>
                  {user.role}
                </span>
              </div>
              
              <div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--success)'
                }}>
                  {user.status}
                </span>
              </div>
              
              <div style={{ fontSize: '13px', color: 'var(--gray-dark)' }}>
                {user.lastLogin}
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-text"
                  style={{ fontSize: '13px', padding: '4px 8px' }}
                  onClick={() => console.log('Edit user:', user.username)}
                >
                  Edit
                </button>
                {user.username !== 'darshan@aayuwell.com' && (
                  <button 
                    className="btn-text"
                    style={{ fontSize: '13px', padding: '4px 8px', color: 'var(--error)' }}
                    onClick={() => console.log('Deactivate user:', user.username)}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ 
          marginTop: '24px',
          padding: '20px',
          background: 'linear-gradient(135deg, rgba(186, 230, 55, 0.05) 0%, rgba(186, 230, 55, 0.02) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(186, 230, 55, 0.2)'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '12px', color: 'var(--primary-navy)', fontSize: '14px' }}>
            User Permissions by Role
          </h4>
          <div style={{ fontSize: '13px', lineHeight: '1.8', color: 'var(--gray-dark)' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Super Admin:</strong> Full system access including user management, all patient records, and system configuration
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Administrator:</strong> User management, patient management, and access to all medical notes
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Medical Provider:</strong> Create and manage patients, use scribe features, manage own notes
            </div>
            <div>
              <strong>Support Staff:</strong> Add and edit patients, view all notes (read-only)
            </div>
          </div>
        </div>

        <div style={{ 
          marginTop: '16px',
          padding: '16px',
          background: 'rgba(59, 130, 246, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          fontSize: '13px',
          color: 'var(--gray-dark)'
        }}>
          <strong>Security Note:</strong> User authentication is currently managed through secure backend services. 
          Password changes and two-factor authentication can be configured through the Azure Portal.
        </div>
      </div>
    </div>
  );
};

export default UsersPage;

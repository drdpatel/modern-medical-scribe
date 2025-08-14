// src/pages/UsersPage.js
// Complete user management page with role-based access control

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import authService from '../authService';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
    role: 'staff',
    specialty: '',
    isActive: true
  });

  const apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';

  // Available roles based on current user's role
  const getAvailableRoles = () => {
    const currentUser = authService.getCurrentUser();
    
    if (currentUser?.role === 'super_admin') {
      return [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'admin', label: 'Administrator' },
        { value: 'doctor', label: 'Doctor' },
        { value: 'medical_provider', label: 'Medical Provider' },
        { value: 'nurse', label: 'Nurse' },
        { value: 'staff', label: 'Staff' },
        { value: 'support_staff', label: 'Support Staff' }
      ];
    } else if (currentUser?.role === 'admin') {
      return [
        { value: 'doctor', label: 'Doctor' },
        { value: 'medical_provider', label: 'Medical Provider' },
        { value: 'nurse', label: 'Nurse' },
        { value: 'staff', label: 'Staff' },
        { value: 'support_staff', label: 'Support Staff' }
      ];
    }
    
    return [];
  };

  // Load users on mount
  useEffect(() => {
    if (authService.hasPermission('manage_users')) {
      loadUsers();
    } else {
      setError('You do not have permission to manage users');
      setLoading(false);
    }
  }, []);

  // Load users from API
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${apiBaseUrl}/users`, {
        headers: authService.getAuthHeaders()
      });
      
      // Filter out sensitive data
      const sanitizedUsers = (response.data || []).map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        specialty: user.specialty,
        isActive: user.isActive !== false,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));
      
      setUsers(sanitizedUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Validate form
  const validateForm = () => {
    if (!formData.username || formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    
    if (!formData.name) {
      setError('Name is required');
      return false;
    }
    
    if (!editingUser) {
      if (!formData.password || formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Invalid email format');
      return false;
    }
    
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setError(null);
      setSuccess(null);
      
      const userData = {
        username: formData.username.toLowerCase().trim(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        specialty: formData.specialty,
        isActive: formData.isActive
      };
      
      if (!editingUser) {
        userData.password = formData.password;
      }
      
      if (editingUser) {
        // Update existing user
        const response = await axios.put(
          `${apiBaseUrl}/users/${editingUser.id}`,
          userData,
          { headers: authService.getAuthHeaders() }
        );
        
        setUsers(users.map(u => 
          u.id === editingUser.id ? { ...u, ...response.data } : u
        ));
        setSuccess('User updated successfully');
      } else {
        // Create new user
        userData.id = Date.now().toString();
        userData.createdAt = new Date().toISOString();
        
        const response = await axios.post(
          `${apiBaseUrl}/users`,
          userData,
          { headers: authService.getAuthHeaders() }
        );
        
        setUsers([...users, response.data]);
        setSuccess('User created successfully');
      }
      
      // Reset form
      resetForm();
      setShowAddModal(false);
      setEditingUser(null);
      
      // Reload users to ensure consistency
      setTimeout(loadUsers, 1000);
      
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.response?.data?.error || 'Failed to save user');
    }
  };

  // Delete user
  const handleDelete = async (userId) => {
    const currentUser = authService.getCurrentUser();
    
    if (userId === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      setError(null);
      setSuccess(null);
      
      await axios.delete(
        `${apiBaseUrl}/users/${userId}`,
        { headers: authService.getAuthHeaders() }
      );
      
      setUsers(users.filter(u => u.id !== userId));
      setSuccess('User deleted successfully');
      
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  // Toggle user active status
  const handleToggleActive = async (user) => {
    const currentUser = authService.getCurrentUser();
    
    if (user.id === currentUser?.id) {
      setError('You cannot deactivate your own account');
      return;
    }
    
    try {
      setError(null);
      setSuccess(null);
      
      const response = await axios.put(
        `${apiBaseUrl}/users/${user.id}`,
        { ...user, isActive: !user.isActive },
        { headers: authService.getAuthHeaders() }
      );
      
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, isActive: !u.isActive } : u
      ));
      
      setSuccess(`User ${!user.isActive ? 'activated' : 'deactivated'} successfully`);
      
    } catch (err) {
      console.error('Error toggling user status:', err);
      setError(err.response?.data?.error || 'Failed to update user status');
    }
  };

  // Edit user
  const handleEdit = (user) => {
    setFormData({
      username: user.username || '',
      password: '',
      confirmPassword: '',
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'staff',
      specialty: user.specialty || '',
      isActive: user.isActive !== false
    });
    setEditingUser(user);
    setShowAddModal(true);
    setError(null);
    setSuccess(null);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      name: '',
      email: '',
      role: 'staff',
      specialty: '',
      isActive: true
    });
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.role?.toLowerCase().includes(searchLower)
    );
  });

  // Check permissions
  if (!authService.hasPermission('manage_users')) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You do not have permission to access user management.</p>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>User Management</h1>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {authService.hasPermission('add_users') && (
            <button 
              onClick={() => {
                resetForm();
                setEditingUser(null);
                setShowAddModal(true);
                setError(null);
                setSuccess(null);
              }}
              className="btn btn-primary"
            >
              Add New User
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
      
      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess(null)} className="close-btn">×</button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-users">
                    {searchTerm ? 'No users found matching your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className={!user.isActive ? 'inactive' : ''}>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>{user.email || '-'}</td>
                    <td>
                      <span className={`role-badge role-${user.role}`}>
                        {user.role?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <div className="action-buttons">
                        {authService.hasPermission('edit_users') && (
                          <>
                            <button 
                              onClick={() => handleEdit(user)}
                              className="btn btn-sm btn-secondary"
                              title="Edit User"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleToggleActive(user)}
                              className="btn btn-sm btn-warning"
                              title={user.isActive ? 'Deactivate' : 'Activate'}
                              disabled={user.id === authService.getCurrentUser()?.id}
                            >
                              {user.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                        {authService.hasPermission('delete_users') && (
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="btn btn-sm btn-danger"
                            title="Delete User"
                            disabled={user.id === authService.getCurrentUser()?.id}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                  setError(null);
                }}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                  disabled={editingUser}
                  placeholder="Enter username"
                />
              </div>

              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  placeholder="Enter full name"
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="user@example.com"
                />
              </div>

              {!editingUser && (
                <>
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm Password *</label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      required
                      placeholder="Re-enter password"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  required
                >
                  {getAvailableRoles().map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.role === 'doctor' || formData.role === 'medical_provider') && (
                <div className="form-group">
                  <label>Specialty</label>
                  <select
                    value={formData.specialty}
                    onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                  >
                    <option value="">Select Specialty</option>
                    <option value="internal_medicine">Internal Medicine</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="emergency_medicine">Emergency Medicine</option>
                    <option value="surgery">Surgery</option>
                    <option value="psychiatry">Psychiatry</option>
                    <option value="pediatrics">Pediatrics</option>
                    <option value="obesity_medicine">Obesity Medicine</option>
                    <option value="registered_dietician">Registered Dietician</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  Active Account
                </label>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                    setError(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;

// functions/userManagement.js
// Complete user management Azure Function with role-based access control

const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const crypto = require('crypto');

// Initialize Azure Table Storage connection
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const tableName = 'users';

// Create table client
let tableClient;
try {
  if (connectionString) {
    tableClient = TableClient.fromConnectionString(connectionString, tableName);
  }
} catch (error) {
  console.error('Failed to initialize table client:', error);
}

// Hash password with salt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

// Verify password
function verifyPassword(password, hash, salt) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Check user permissions
function hasPermission(userRole, permission) {
  const permissions = {
    super_admin: [
      'manage_users', 'add_users', 'edit_users', 'delete_users',
      'add_patients', 'edit_patients', 'delete_patients',
      'scribe', 'read_all_notes', 'edit_all_notes', 'delete_all_notes',
      'manage_settings', 'view_analytics', 'export_data'
    ],
    admin: [
      'manage_users', 'add_users', 'edit_users',
      'add_patients', 'edit_patients',
      'scribe', 'read_all_notes', 'edit_own_notes',
      'view_analytics'
    ],
    doctor: [
      'add_patients', 'edit_patients', 'delete_patients',
      'scribe', 'read_own_notes', 'edit_own_notes', 'delete_own_notes'
    ],
    medical_provider: [
      'scribe', 'read_own_notes', 'edit_own_notes'
    ],
    nurse: [
      'add_patients', 'edit_patients', 'read_all_notes'
    ],
    staff: [
      'add_patients', 'edit_patients', 'read_all_notes'
    ],
    support_staff: [
      'add_patients', 'read_all_notes'
    ]
  };
  
  return permissions[userRole]?.includes(permission) || false;
}

// Validate user headers
function validateUserHeaders(headers) {
  const userId = headers['x-user-id'];
  const userRole = headers['x-user-role'];
  
  if (!userId || !userRole) {
    return { valid: false, error: 'Authentication required' };
  }
  
  return { valid: true, userId, userRole };
}

// Initialize default users if table is empty
async function initializeDefaultUsers() {
  try {
    // Check if table exists and has users
    const users = [];
    const iter = tableClient.listEntities();
    for await (const entity of iter) {
      users.push(entity);
      if (users.length > 0) break; // Table has users, no need to initialize
    }
    
    if (users.length === 0) {
      console.log('Initializing default users...');
      
      // Create default admin user
      const adminPassword = hashPassword('admin123');
      await tableClient.createEntity({
        partitionKey: 'USER',
        rowKey: 'admin_' + Date.now(),
        id: 'admin_' + Date.now(),
        username: 'admin',
        passwordHash: adminPassword.hash,
        salt: adminPassword.salt,
        name: 'System Administrator',
        email: 'admin@aayuscribe.com',
        role: 'super_admin',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      
      // Create default doctor user
      const doctorPassword = hashPassword('doctor123');
      await tableClient.createEntity({
        partitionKey: 'USER',
        rowKey: 'doctor_' + Date.now(),
        id: 'doctor_' + Date.now(),
        username: 'doctor',
        passwordHash: doctorPassword.hash,
        salt: doctorPassword.salt,
        name: 'Dr. Demo User',
        email: 'doctor@aayuscribe.com',
        role: 'doctor',
        specialty: 'internal_medicine',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      
      // Create default staff user
      const staffPassword = hashPassword('staff123');
      await tableClient.createEntity({
        partitionKey: 'USER',
        rowKey: 'staff_' + Date.now(),
        id: 'staff_' + Date.now(),
        username: 'staff',
        passwordHash: staffPassword.hash,
        salt: staffPassword.salt,
        name: 'Staff User',
        email: 'staff@aayuscribe.com',
        role: 'staff',
        isActive: true,
        createdAt: new Date().toISOString()
      });
      
      console.log('Default users created successfully');
    }
  } catch (error) {
    console.error('Error initializing default users:', error);
  }
}

// Initialize on first load
if (tableClient) {
  initializeDefaultUsers().catch(console.error);
}

// Login endpoint
app.http('users-login', {
  methods: ['POST'],
  route: 'users/login',
  handler: async (request, context) => {
    try {
      if (!tableClient) {
        return {
          status: 500,
          jsonBody: { error: 'Database connection not available' }
        };
      }
      
      const body = await request.json();
      const { username, password } = body;
      
      if (!username || !password) {
        return {
          status: 400,
          jsonBody: { error: 'Username and password are required' }
        };
      }
      
      // Find user by username
      const users = [];
      const iter = tableClient.listEntities({
        queryOptions: { filter: `username eq '${username.toLowerCase()}'` }
      });
      
      for await (const entity of iter) {
        users.push(entity);
      }
      
      if (users.length === 0) {
        return {
          status: 401,
          jsonBody: { error: 'Invalid username or password' }
        };
      }
      
      const user = users[0];
      
      // Check if user is active
      if (!user.isActive) {
        return {
          status: 403,
          jsonBody: { error: 'Account is disabled. Please contact administrator.' }
        };
      }
      
      // Verify password
      if (!verifyPassword(password, user.passwordHash, user.salt)) {
        return {
          status: 401,
          jsonBody: { error: 'Invalid username or password' }
        };
      }
      
      // Update last login
      user.lastLogin = new Date().toISOString();
      await tableClient.updateEntity(user, 'Merge');
      
      // Generate session token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Return user data (without sensitive info)
      return {
        status: 200,
        jsonBody: {
          id: user.id || user.rowKey,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          specialty: user.specialty,
          token: token
        }
      };
      
    } catch (error) {
      console.error('Login error:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' }
      };
    }
  }
});

// Get all users endpoint
app.http('users-list', {
  methods: ['GET'],
  route: 'users',
  handler: async (request, context) => {
    try {
      if (!tableClient) {
        return {
          status: 500,
          jsonBody: { error: 'Database connection not available' }
        };
      }
      
      // Validate user permissions
      const validation = validateUserHeaders(request.headers);
      if (!validation.valid) {
        return {
          status: 401,
          jsonBody: { error: validation.error }
        };
      }
      
      if (!hasPermission(validation.userRole, 'manage_users')) {
        return {
          status: 403,
          jsonBody: { error: 'You do not have permission to view users' }
        };
      }
      
      // Get all users
      const users = [];
      const iter = tableClient.listEntities();
      
      for await (const entity of iter) {
        if (entity.partitionKey === 'USER') {
          users.push({
            id: entity.id || entity.rowKey,
            username: entity.username,
            name: entity.name,
            email: entity.email,
            role: entity.role,
            specialty: entity.specialty,
            isActive: entity.isActive !== false,
            createdAt: entity.createdAt,
            lastLogin: entity.lastLogin
          });
        }
      }
      
      return {
        status: 200,
        jsonBody: users
      };
      
    } catch (error) {
      console.error('Error fetching users:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch users' }
      };
    }
  }
});

// Create user endpoint
app.http('users-create', {
  methods: ['POST'],
  route: 'users',
  handler: async (request, context) => {
    try {
      if (!tableClient) {
        return {
          status: 500,
          jsonBody: { error: 'Database connection not available' }
        };
      }
      
      // Validate user permissions
      const validation = validateUserHeaders(request.headers);
      if (!validation.valid) {
        return {
          status: 401,
          jsonBody: { error: validation.error }
        };
      }
      
      if (!hasPermission(validation.userRole, 'add_users')) {
        return {
          status: 403,
          jsonBody: { error: 'You do not have permission to add users' }
        };
      }
      
      const body = await request.json();
      const { username, password, name, email, role, specialty, isActive } = body;
      
      // Validate required fields
      if (!username || !password || !name || !role) {
        return {
          status: 400,
          jsonBody: { error: 'Username, password, name, and role are required' }
        };
      }
      
      // Check if username already exists
      const existingUsers = [];
      const iter = tableClient.listEntities({
        queryOptions: { filter: `username eq '${username.toLowerCase()}'` }
      });
      
      for await (const entity of iter) {
        existingUsers.push(entity);
      }
      
      if (existingUsers.length > 0) {
        return {
          status: 400,
          jsonBody: { error: 'Username already exists' }
        };
      }
      
      // Hash password
      const { salt, hash } = hashPassword(password);
      
      // Create user entity
      const userId = body.id || `user_${Date.now()}`;
      const userEntity = {
        partitionKey: 'USER',
        rowKey: userId,
        id: userId,
        username: username.toLowerCase(),
        passwordHash: hash,
        salt: salt,
        name: name,
        email: email || '',
        role: role,
        specialty: specialty || '',
        isActive: isActive !== false,
        createdAt: new Date().toISOString(),
        createdBy: validation.userId
      };
      
      await tableClient.createEntity(userEntity);
      
      // Return user data (without password info)
      return {
        status: 201,
        jsonBody: {
          id: userId,
          username: userEntity.username,
          name: userEntity.name,
          email: userEntity.email,
          role: userEntity.role,
          specialty: userEntity.specialty,
          isActive: userEntity.isActive
        }
      };
      
    } catch (error) {
      console.error('Error creating user:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to create user' }
      };
    }
  }
});

// Update user endpoint
app.http('users-update', {
  methods: ['PUT'],
  route: 'users/{id}',
  handler: async (request, context) => {
    try {
      if (!tableClient) {
        return {
          status: 500,
          jsonBody: { error: 'Database connection not available' }
        };
      }
      
      // Validate user permissions
      const validation = validateUserHeaders(request.headers);
      if (!validation.valid) {
        return {
          status: 401,
          jsonBody: { error: validation.error }
        };
      }
      
      if (!hasPermission(validation.userRole, 'edit_users')) {
        return {
          status: 403,
          jsonBody: { error: 'You do not have permission to edit users' }
        };
      }
      
      const userId = request.params.id;
      const body = await request.json();
      
      // Get existing user
      let existingUser;
      try {
        existingUser = await tableClient.getEntity('USER', userId);
      } catch (error) {
        return {
          status: 404,
          jsonBody: { error: 'User not found' }
        };
      }
      
      // Update user fields (excluding password)
      if (body.name !== undefined) existingUser.name = body.name;
      if (body.email !== undefined) existingUser.email = body.email;
      if (body.role !== undefined) existingUser.role = body.role;
      if (body.specialty !== undefined) existingUser.specialty = body.specialty;
      if (body.isActive !== undefined) existingUser.isActive = body.isActive;
      
      existingUser.updatedAt = new Date().toISOString();
      existingUser.updatedBy = validation.userId;
      
      await tableClient.updateEntity(existingUser, 'Replace');
      
      // Return updated user data
      return {
        status: 200,
        jsonBody: {
          id: existingUser.id || existingUser.rowKey,
          username: existingUser.username,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          specialty: existingUser.specialty,
          isActive: existingUser.isActive
        }
      };
      
    } catch (error) {
      console.error('Error updating user:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to update user' }
      };
    }
  }
});

// Delete user endpoint
app.http('users-delete', {
  methods: ['DELETE'],
  route: 'users/{id}',
  handler: async (request, context) => {
    try {
      if (!tableClient) {
        return {
          status: 500,
          jsonBody: { error: 'Database connection not available' }
        };
      }
      
      // Validate user permissions
      const validation = validateUserHeaders(request.headers);
      if (!validation.valid) {
        return {
          status: 401,
          jsonBody: { error: validation.error }
        };
      }
      
      if (!hasPermission(validation.userRole, 'delete_users')) {
        return {
          status: 403,
          jsonBody: { error: 'You do not have permission to delete users' }
        };
      }
      
      const userId = request.params.id;
      
      // Prevent self-deletion
      if (userId === validation.userId) {
        return {
          status: 400,
          jsonBody: { error: 'You cannot delete your own account' }
        };
      }
      
      // Delete user
      try {
        await tableClient.deleteEntity('USER', userId);
      } catch (error) {
        return {
          status: 404,
          jsonBody: { error: 'User not found' }
        };
      }
      
      return {
        status: 200,
        jsonBody: { message: 'User deleted successfully' }
      };
      
    } catch (error) {
      console.error('Error deleting user:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to delete user' }
      };
    }
  }
});

// Verify session endpoint
app.http('users-verify', {
  methods: ['GET'],
  route: 'users/verify',
  handler: async (request, context) => {
    try {
      const validation = validateUserHeaders(request.headers);
      
      if (!validation.valid) {
        return {
          status: 401,
          jsonBody: { valid: false, error: validation.error }
        };
      }
      
      return {
        status: 200,
        jsonBody: { 
          valid: true,
          userId: validation.userId,
          role: validation.userRole
        }
      };
      
    } catch (error) {
      console.error('Verify error:', error);
      return {
        status: 500,
        jsonBody: { valid: false, error: 'Internal server error' }
      };
    }
  }
});

// Change password endpoint
app.http('users-change-password', {
  methods: ['POST'],
  route: 'users/change-password',
  handler: async (request, context) => {
    try {
      if (!tableClient) {
        return {
          status: 500,
          jsonBody: { error: 'Database connection not available' }
        };
      }
      
      const body = await request.json();
      const { userId, oldPassword, newPassword } = body;
      
      if (!userId || !oldPassword || !newPassword) {
        return {
          status: 400,
          jsonBody: { error: 'All fields are required' }
        };
      }
      
      // Get user
      let user;
      try {
        user = await tableClient.getEntity('USER', userId);
      } catch (error) {
        return {
          status: 404,
          jsonBody: { error: 'User not found' }
        };
      }
      
      // Verify old password
      if (!verifyPassword(oldPassword, user.passwordHash, user.salt)) {
        return {
          status: 401,
          jsonBody: { error: 'Current password is incorrect' }
        };
      }
      
      // Hash new password
      const { salt, hash } = hashPassword(newPassword);
      
      // Update password
      user.passwordHash = hash;
      user.salt = salt;
      user.passwordChangedAt = new Date().toISOString();
      
      await tableClient.updateEntity(user, 'Replace');
      
      return {
        status: 200,
        jsonBody: { message: 'Password changed successfully' }
      };
      
    } catch (error) {
      console.error('Error changing password:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to change password' }
      };
    }
  }
});

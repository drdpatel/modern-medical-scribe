const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const bcrypt = require('bcryptjs');

// Configuration
const STORAGE_CONNECTION_STRING = process.env.AzureWebJobsStorage;
const USERS_TABLE_NAME = process.env.USER_TABLE_NAME || 'users';
const SALT_ROUNDS = 12;

// Initialize Table Client
const tableClient = TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, USERS_TABLE_NAME);

// Ensure users table exists
async function ensureTableExists() {
  try {
    await tableClient.createTable();
    console.log(`Table ${USERS_TABLE_NAME} created or already exists`);
  } catch (error) {
    if (error.statusCode !== 409) { // 409 = table already exists
      console.error('Error creating table:', error);
      throw error;
    }
  }
}

// Default admin user creation
async function createDefaultAdmin() {
  try {
    const adminEmail = 'darshan@aayuwell.com';
    
    // Check if admin already exists
    try {
      await tableClient.getEntity('USER', adminEmail);
      console.log('Default admin user already exists');
      return;
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }

    // Create default admin
    const hashedPassword = await bcrypt.hash('Aayuscribe1212@', SALT_ROUNDS);
    const adminUser = {
      partitionKey: 'USER',
      rowKey: adminEmail,
      username: adminEmail,
      name: 'Dr. Darshan Patel',
      role: 'super_admin',
      passwordHash: hashedPassword,
      isActive: true,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    await tableClient.createEntity(adminUser);
    console.log('Default admin user created successfully');
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
}

// Utility functions
function validateUserData(userData) {
  const { username, name, role, password } = userData;
  
  if (!username || !username.trim()) {
    return { valid: false, error: 'Username is required' };
  }
  
  if (!name || !name.trim()) {
    return { valid: false, error: 'Name is required' };
  }
  
  if (!role || !['super_admin', 'admin', 'medical_provider', 'support_staff'].includes(role)) {
    return { valid: false, error: 'Invalid role specified' };
  }
  
  if (password && password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  
  return { valid: true };
}

function hasPermission(userRole, requiredPermission) {
  const permissions = {
    super_admin: ['scribe', 'add_patients', 'add_users', 'read_all_notes', 'edit_all_notes', 'manage_users'],
    admin: ['scribe', 'add_patients', 'add_users', 'read_own_notes', 'manage_users'],
    medical_provider: ['scribe', 'read_own_notes'],
    support_staff: ['add_patients', 'read_all_notes']
  };
  
  return permissions[userRole]?.includes(requiredPermission) || false;
}

function sanitizeUser(user) {
  const { passwordHash, ...sanitizedUser } = user;
  return sanitizedUser;
}

// POST /api/users/validate - Validate login credentials
app.http('validateUser', {
  methods: ['POST'],
  route: 'users/validate',
  handler: async (request, context) => {
    try {
      await ensureTableExists();
      
      const body = await request.json();
      const { username, password } = body;
      
      if (!username || !password) {
        return {
          status: 400,
          jsonBody: { error: 'Username and password are required' }
        };
      }
      
      // Get user from table
      try {
        const user = await tableClient.getEntity('USER', username);
        
        if (!user.isActive) {
          return {
            status: 401,
            jsonBody: { error: 'Account is disabled' }
          };
        }
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        
        if (!passwordMatch) {
          return {
            status: 401,
            jsonBody: { error: 'Invalid credentials' }
          };
        }
        
        // Update last login
        await tableClient.updateEntity({
          partitionKey: 'USER',
          rowKey: username,
          lastLogin: new Date().toISOString()
        }, 'Merge');
        
        // Return user data (without password hash)
        return {
          status: 200,
          jsonBody: {
            success: true,
            user: {
              id: user.username,
              username: user.username,
              name: user.name,
              role: user.role,
              lastLogin: new Date().toISOString()
            }
          }
        };
        
      } catch (error) {
        if (error.statusCode === 404) {
          return {
            status: 401,
            jsonBody: { error: 'Invalid credentials' }
          };
        }
        throw error;
      }
      
    } catch (error) {
      console.error('Validate user error:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' }
      };
    }
  }
});

// GET /api/users - List all users (admin only)
app.http('listUsers', {
  methods: ['GET'],
  route: 'users',
  handler: async (request, context) => {
    try {
      await ensureTableExists();
      
      // Check permissions
      const userRole = request.headers.get('x-user-role');
      
      if (!hasPermission(userRole, 'manage_users')) {
        return {
          status: 403,
          jsonBody: { error: 'Insufficient permissions' }
        };
      }
      
      // Get all users
      const users = [];
      const entitiesIter = tableClient.listEntities({
        queryOptions: { filter: "PartitionKey eq 'USER'" }
      });
      
      for await (const entity of entitiesIter) {
        users.push(sanitizeUser(entity));
      }
      
      return {
        status: 200,
        jsonBody: users
      };
      
    } catch (error) {
      console.error('List users error:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' }
      };
    }
  }
});

// POST /api/users - Create new user (admin only)
app.http('createUser', {
  methods: ['POST'],
  route: 'users',
  handler: async (request, context) => {
    try {
      await ensureTableExists();
      
      // Check permissions
      const userRole = request.headers.get('x-user-role');
      const createdBy = request.headers.get('x-user-id');
      
      if (!hasPermission(userRole, 'manage_users')) {
        return {
          status: 403,
          jsonBody: { error: 'Insufficient permissions' }
        };
      }
      
      const userData = await request.json();
      
      // Validate input
      const validation = validateUserData(userData);
      if (!validation.valid) {
        return {
          status: 400,
          jsonBody: { error: validation.error }
        };
      }
      
      // Check if user already exists
      try {
        await tableClient.getEntity('USER', userData.username);
        return {
          status: 409,
          jsonBody: { error: 'User already exists' }
        };
      } catch (error) {
        if (error.statusCode !== 404) {
          throw error;
        }
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
      
      // Create user entity
      const newUser = {
        partitionKey: 'USER',
        rowKey: userData.username,
        username: userData.username,
        name: userData.name.trim(),
        role: userData.role,
        passwordHash: hashedPassword,
        isActive: true,
        createdBy: createdBy || 'system',
        createdAt: new Date().toISOString(),
        lastLogin: null
      };
      
      await tableClient.createEntity(newUser);
      
      return {
        status: 201,
        jsonBody: {
          success: true,
          message: 'User created successfully',
          user: sanitizeUser(newUser)
        }
      };
      
    } catch (error) {
      console.error('Create user error:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' }
      };
    }
  }
});

// Initialize default data on startup
async function initializeDatabase() {
  try {
    await ensureTableExists();
    await createDefaultAdmin();
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Initialize when module loads
initializeDatabase();

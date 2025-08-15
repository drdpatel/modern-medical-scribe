const { TableClient } = require("@azure/data-tables");
const crypto = require('crypto');

module.exports = async function (context, req) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.WEBSITE_CONTENTAZUREFILECONNECTIONSTRING;
  
  if (!connectionString) {
    context.res = {
      status: 500,
      body: { error: "Storage connection not configured" }
    };
    return;
  }

  const usersTable = TableClient.fromConnectionString(connectionString, "users");

  try {
    // Ensure table exists
    await usersTable.createTable().catch(e => {});

    switch (req.method) {
      case 'GET':
        // Get all users or specific user
        if (req.query.username) {
          try {
            const user = await usersTable.getEntity('user', req.query.username);
            context.res = { body: user };
          } catch (error) {
            context.res = { status: 404, body: { error: "User not found" } };
          }
        } else {
          const users = [];
          const entities = usersTable.listEntities();
          for await (const entity of entities) {
            // Don't send password hash to frontend
            delete entity.passwordHash;
            users.push(entity);
          }
          context.res = { body: users };
        }
        break;

      case 'POST':
        // Create new user or login
        const { action, username, password, userData } = req.body;
        
        if (action === 'login') {
          // Handle login
          try {
            const user = await usersTable.getEntity('user', username);
            const hashedPassword = crypto.createHash('sha256').update(password + 'AayuScribe2024').digest('hex');
            
            if (user.passwordHash === hashedPassword && user.isActive) {
              delete user.passwordHash;
              context.res = { body: { success: true, user } };
            } else {
              context.res = { status: 401, body: { error: "Invalid credentials" } };
            }
          } catch (error) {
            context.res = { status: 401, body: { error: "Invalid credentials" } };
          }
        } else if (action === 'create') {
          // Create new user
          const hashedPassword = crypto.createHash('sha256').update(userData.password + 'AayuScribe2024').digest('hex');
          
          const newUser = {
            partitionKey: 'user',
            rowKey: userData.username,
            username: userData.username,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            specialty: userData.specialty || '',
            passwordHash: hashedPassword,
            isActive: userData.isActive !== false,
            createdAt: new Date().toISOString(),
            createdBy: req.body.createdBy || 'system'
          };
          
          await usersTable.createEntity(newUser);
          delete newUser.passwordHash;
          context.res = { body: { success: true, user: newUser } };
        } else {
          context.res = { status: 400, body: { error: "Invalid action" } };
        }
        break;

      case 'PUT':
        // Update user
        const updateUser = req.body;
        updateUser.partitionKey = 'user';
        updateUser.rowKey = updateUser.username;
        
        if (updateUser.password) {
          updateUser.passwordHash = crypto.createHash('sha256').update(updateUser.password + 'AayuScribe2024').digest('hex');
          delete updateUser.password;
        }
        
        await usersTable.updateEntity(updateUser, 'Merge');
        context.res = { body: { success: true } };
        break;

      case 'DELETE':
        // Deactivate user (soft delete)
        const deleteUsername = req.query.username;
        const userToDelete = await usersTable.getEntity('user', deleteUsername);
        userToDelete.isActive = false;
        await usersTable.updateEntity(userToDelete, 'Merge');
        context.res = { body: { success: true } };
        break;

      default:
        context.res = { status: 405, body: { error: "Method not allowed" } };
    }
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message }
    };
  }
};

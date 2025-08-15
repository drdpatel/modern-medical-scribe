const { app } = require('@azure/functions');
const { TableClient } = require("@azure/data-tables");

app.http('users-simple', {
  methods: ['POST'],
  route: 'users',
  handler: async (request, context) => {
    try {
      const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!conn) {
        console.error("AZURE_STORAGE_CONNECTION_STRING is missing");
        return { status: 500, jsonBody: { error: "Server config missing" } };
      }

      const body = await request.json();
      const { username, password } = body || {};
      
      if (!username || !password) {
        return { status: 400, jsonBody: { error: "username and password required" } };
      }

      const client = TableClient.fromConnectionString(conn, "users");
      const rowKey = String(username).toLowerCase();

      let entity;
      try {
        entity = await client.getEntity("user", rowKey);
      } catch {
        return { status: 401, jsonBody: { error: "Unknown User" } };
      }

      // Check plain text password (for compatibility with existing setup)
      if (entity.password !== password) {
        return { status: 401, jsonBody: { error: "Invalid credentials" } };
      }

      return {
        status: 200,
        jsonBody: {
          username: entity.rowKey || entity.RowKey,
          role: entity.role || "clinician",
          name: entity.name || entity.rowKey || entity.RowKey
        }
      };
    } catch (err) {
      console.error("users error", err);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  }
});

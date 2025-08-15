const { TableClient } = require("@azure/data-tables");
const TABLE_NAME = "users";

module.exports = async function (context, req) {
  try {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!conn) {
      context.log.error("AZURE_STORAGE_CONNECTION_STRING is missing");
      return (context.res = { status: 500, body: { error: "Server config missing" } });
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      return (context.res = { status: 400, body: { error: "username and password required" } });
    }

    const client = TableClient.fromConnectionString(conn, TABLE_NAME);
    const rowKey = String(username).toLowerCase();

    let entity;
    try {
      entity = await client.getEntity("user", rowKey);
    } catch {
      return (context.res = { status: 401, body: { error: "Unknown User" } });
    }

    if (entity.password !== password) {
      return (context.res = { status: 401, body: { error: "Invalid credentials" } });
    }

    return (context.res = {
      status: 200,
      body: {
        username: entity.RowKey,
        role: entity.role || "clinician",
        name: entity.name || entity.RowKey
      }
    });
  } catch (err) {
    context.log.error("users error", err);
    return (context.res = { status: 500, body: { error: "Internal server error" } });
  }
};

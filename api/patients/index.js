const { TableClient, odata } = require("@azure/data-tables");
const TABLE_NAME = "patients";

module.exports = async function (context, req) {
  try {
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!conn) return (context.res = { status: 500, body: { error: "Server config missing" } });

    const client = TableClient.fromConnectionString(conn, TABLE_NAME);
    const id = context.bindingData.id;
    const method = (req.method || "get").toUpperCase();

    if (method === "GET") {
      if (id) {
        const entity = await client.getEntity("patient", String(id));
        return (context.res = { status: 200, body: entity });
      } else {
        const results = [];
        let count = 0;
        for await (const e of client.listEntities({
          queryOptions: { filter: odata`PartitionKey eq ${"patient"}` }
        })) {
          results.push(e);
          if (++count >= 100) break;
        }
        return (context.res = { status: 200, body: results });
      }
    }

    if (method === "POST") {
      const payload = req.body || {};
      if (!payload.id) return (context.res = { status: 400, body: { error: "id is required" } });
      const entity = { partitionKey: "patient", rowKey: String(payload.id), ...payload };
      await client.upsertEntity(entity, "Merge");
      return (context.res = { status: 200, body: entity });
    }

    if (method === "PUT") {
      if (!id) return (context.res = { status: 400, body: { error: "id path param required" } });
      const entity = { partitionKey: "patient", rowKey: String(id), ...(req.body || {}) };
      await client.upsertEntity(entity, "Merge");
      return (context.res = { status: 200, body: entity });
    }

    if (method === "DELETE") {
      if (!id) return (context.res = { status: 400, body: { error: "id path param required" } });
      await client.deleteEntity("patient", String(id));
      return (context.res = { status: 204, body: "" });
    }

    return (context.res = { status: 405, body: { error: "Method not allowed" } });
  } catch (err) {
    context.log.error("patients error", err);
    return (context.res = { status: 500, body: { error: "Internal server error" } });
  }
};

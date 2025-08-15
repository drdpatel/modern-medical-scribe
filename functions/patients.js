const { app } = require('@azure/functions');
const { TableClient, odata } = require("@azure/data-tables");

app.http('patients', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  route: 'patients/{id?}',
  handler: async (request, context) => {
    try {
      const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!conn) return { status: 500, jsonBody: { error: "Server config missing" } };

      const client = TableClient.fromConnectionString(conn, "patients");
      const id = request.params.id;
      const method = request.method.toUpperCase();

      if (method === "GET") {
        if (id) {
          const entity = await client.getEntity("patient", String(id));
          return { status: 200, jsonBody: entity };
        } else {
          const results = [];
          for await (const e of client.listEntities({
            queryOptions: { filter: odata`PartitionKey eq ${"patient"}` }
          })) {
            results.push(e);
            if (results.length >= 100) break;
          }
          return { status: 200, jsonBody: results };
        }
      }

      if (method === "POST") {
        const payload = await request.json();
        if (!payload.id) return { status: 400, jsonBody: { error: "id is required" } };
        const entity = { partitionKey: "patient", rowKey: String(payload.id), ...payload };
        await client.upsertEntity(entity, "Merge");
        return { status: 200, jsonBody: entity };
      }

      if (method === "PUT") {
        if (!id) return { status: 400, jsonBody: { error: "id required" } };
        const payload = await request.json();
        const entity = { partitionKey: "patient", rowKey: String(id), ...payload };
        await client.upsertEntity(entity, "Merge");
        return { status: 200, jsonBody: entity };
      }

      if (method === "DELETE") {
        if (!id) return { status: 400, jsonBody: { error: "id required" } };
        await client.deleteEntity("patient", String(id));
        return { status: 204 };
      }

      return { status: 405, jsonBody: { error: "Method not allowed" } };
    } catch (err) {
      console.error("patients error", err);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  }
});

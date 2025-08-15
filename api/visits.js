const { TableClient } = require("@azure/data-tables");

module.exports = async function (context, req) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.WEBSITE_CONTENTAZUREFILECONNECTIONSTRING;
  
  if (!connectionString) {
    context.res = {
      status: 500,
      body: { error: "Storage connection not configured" }
    };
    return;
  }

  const visitsTable = TableClient.fromConnectionString(connectionString, "visits");

  try {
    // Ensure table exists
    await visitsTable.createTable().catch(e => {});

    switch (req.method) {
      case 'GET':
        // Get visits for a patient
        const patientId = req.query.patientId;
        
        if (!patientId) {
          context.res = { status: 400, body: { error: "Patient ID required" } };
          return;
        }
        
        const visits = [];
        const entities = visitsTable.listEntities({
          queryOptions: { filter: `PartitionKey eq '${patientId}'` }
        });
        
        for await (const entity of entities) {
          visits.push({
            id: entity.rowKey,
            patientId: entity.partitionKey,
            date: entity.date,
            time: entity.time,
            transcript: entity.transcript,
            notes: entity.notes,
            noteType: entity.noteType,
            timestamp: entity.timestamp,
            createdBy: entity.createdBy,
            createdByName: entity.createdByName
          });
        }
        
        context.res = { body: visits };
        break;

      case 'POST':
        // Create new visit
        const visitData = req.body;
        const visitId = visitData.id || Date.now().toString();
        
        const newVisit = {
          partitionKey: visitData.patientId,
          rowKey: visitId,
          date: visitData.date,
          time: visitData.time,
          transcript: visitData.transcript || '',
          notes: visitData.notes || '',
          noteType: visitData.noteType || 'progress',
          timestamp: new Date().toISOString(),
          createdBy: visitData.createdBy || 'system',
          createdByName: visitData.createdByName || 'System'
        };
        
        await visitsTable.createEntity(newVisit);
        context.res = { body: { success: true, visit: { ...newVisit, id: visitId } } };
        break;

      case 'PUT':
        // Update visit
        const updateVisit = req.body;
        updateVisit.partitionKey = updateVisit.patientId;
        updateVisit.rowKey = updateVisit.id;
        
        await visitsTable.updateEntity(updateVisit, 'Merge');
        context.res = { body: { success: true } };
        break;

      case 'DELETE':
        // Delete visit
        const { patientId: pId, visitId: vId } = req.query;
        await visitsTable.deleteEntity(pId, vId);
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

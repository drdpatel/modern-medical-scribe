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

  const patientsTable = TableClient.fromConnectionString(connectionString, "patients");

  try {
    // Ensure table exists
    await patientsTable.createTable().catch(e => {});

    switch (req.method) {
      case 'GET':
        // Get all patients or specific patient
        if (req.query.patientId) {
          try {
            const patient = await patientsTable.getEntity('patient', req.query.patientId);
            context.res = { body: patient };
          } catch (error) {
            context.res = { status: 404, body: { error: "Patient not found" } };
          }
        } else {
          const patients = [];
          const entities = patientsTable.listEntities();
          for await (const entity of entities) {
            patients.push({
              id: entity.rowKey,
              firstName: entity.firstName,
              lastName: entity.lastName,
              dateOfBirth: entity.dateOfBirth,
              medicalHistory: entity.medicalHistory || '',
              medications: entity.medications || '',
              phone: entity.phone || '',
              email: entity.email || '',
              createdAt: entity.createdAt,
              createdBy: entity.createdBy
            });
          }
          context.res = { body: patients };
        }
        break;

      case 'POST':
        // Create new patient
        const patientData = req.body;
        const patientId = patientData.id || Date.now().toString();
        
        const newPatient = {
          partitionKey: 'patient',
          rowKey: patientId,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          dateOfBirth: patientData.dateOfBirth,
          medicalHistory: patientData.medicalHistory || '',
          medications: patientData.medications || '',
          phone: patientData.phone || '',
          email: patientData.email || '',
          createdAt: new Date().toISOString(),
          createdBy: patientData.createdBy || 'system'
        };
        
        await patientsTable.createEntity(newPatient);
        context.res = { body: { success: true, patient: { ...newPatient, id: patientId } } };
        break;

      case 'PUT':
        // Update patient
        const updatePatient = req.body;
        updatePatient.partitionKey = 'patient';
        updatePatient.rowKey = updatePatient.id;
        
        await patientsTable.updateEntity(updatePatient, 'Merge');
        context.res = { body: { success: true } };
        break;

      case 'DELETE':
        // Delete patient
        const patientId = req.query.patientId;
        await patientsTable.deleteEntity('patient', patientId);
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

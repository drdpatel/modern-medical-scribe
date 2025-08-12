const { app } = require('@azure/functions');

// Simple health check endpoint
app.http('health', {
  methods: ['GET'],
  route: 'health',
  handler: async (request, context) => {
    try {
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        jsonBody: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'Medical Scribe API',
          version: '1.0.0'
        }
      };
    } catch (error) {
      context.error('Health check error:', error);
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        jsonBody: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Internal server error'
        }
      };
    }
  }
});

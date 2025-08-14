const { app } = require('@azure/functions');
const axios = require('axios');

// Cache token to avoid unnecessary API calls
let tokenCache = {
  token: null,
  region: null,
  expiresAt: null
};

app.http('getSpeechToken', {
  methods: ['GET', 'POST'],
  route: 'speech-token',
  handler: async (request, context) => {
    try {
      // Check user authentication
      const userRole = request.headers.get('x-user-role');
      const userId = request.headers.get('x-user-id');
      
      if (!userId) {
        return {
          status: 401,
          jsonBody: { error: 'Authentication required' }
        };
      }
      
      // Check if user has permission to use speech services
      if (!hasPermission(userRole, 'scribe')) {
        return {
          status: 403,
          jsonBody: { error: 'Insufficient permissions for speech services' }
        };
      }
      
      // Check token cache
      if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
        return {
          status: 200,
          jsonBody: {
            token: tokenCache.token,
            region: tokenCache.region
          }
        };
      }
      
      // Get configuration from environment variables - MATCHING YOUR AZURE CONFIG
      const speechKey = process.env.SPEECH_KEY;  // Note: Using SPEECH_KEY not AZURE_SPEECH_KEY
      const speechRegion = process.env.SPEECH_REGION || 'eastus';
      
      if (!speechKey) {
        console.error('Speech key not configured');
        return {
          status: 500,
          jsonBody: { error: 'Speech service not configured. Contact administrator.' }
        };
      }
      
      // Request new token from Azure
      const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      
      try {
        const response = await axios.post(tokenUrl, null, {
          headers: {
            'Ocp-Apim-Subscription-Key': speechKey,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        });
        
        // Cache the token (tokens are valid for 10 minutes)
        tokenCache = {
          token: response.data,
          region: speechRegion,
          expiresAt: Date.now() + (9 * 60 * 1000) // 9 minutes to be safe
        };
        
        // Log usage for audit
        console.log(`Speech token issued for user: ${userId}`);
        
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: {
            token: tokenCache.token,
            region: tokenCache.region
          }
        };
        
      } catch (tokenError) {
        console.error('Failed to get speech token:', tokenError.message);
        return {
          status: 500,
          jsonBody: { 
            error: 'Failed to initialize speech service',
            details: process.env.NODE_ENV === 'development' ? tokenError.message : undefined
          }
        };
      }
      
    } catch (error) {
      console.error('Speech token error:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' }
      };
    }
  }
});

// Permission helper
function hasPermission(userRole, permission) {
  const permissions = {
    super_admin: ['scribe', 'add_patients', 'add_users', 'read_all_notes', 'edit_all_notes', 'manage_users'],
    admin: ['scribe', 'add_patients', 'add_users', 'read_all_notes', 'edit_own_notes', 'manage_users'],
    medical_provider: ['scribe', 'read_own_notes', 'edit_own_notes'],
    support_staff: ['add_patients', 'read_all_notes']
  };
  
  return permissions[userRole]?.includes(permission) || false;
}

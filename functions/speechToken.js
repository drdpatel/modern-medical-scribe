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
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { error: 'Authentication required' }
        };
      }
      
      // Check if user has permission to use speech services
      if (!hasPermission(userRole, 'scribe')) {
        return {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { error: 'Insufficient permissions for speech services' }
        };
      }
      
      // Check token cache
      if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
        console.log('Returning cached speech token');
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
      }
      
      // Get configuration from environment variables - MATCHING YOUR AZURE CONFIG
      const speechKey = process.env.SPEECH_KEY;  // Using SPEECH_KEY not AZURE_SPEECH_KEY
      const speechRegion = process.env.SPEECH_REGION || 'eastus';
      
      if (!speechKey) {
        console.error('Speech key not configured in environment variables');
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { 
            error: 'Speech service not configured. Contact administrator.',
            details: 'SPEECH_KEY environment variable is missing'
          }
        };
      }
      
      // Request new token from Azure
      const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      
      console.log(`Requesting new speech token for region: ${speechRegion}`);
      
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
        console.log(`Speech token issued successfully for user: ${userId}`);
        
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          jsonBody: {
            token: tokenCache.token,
            region: tokenCache.region
          }
        };
        
      } catch (tokenError) {
        console.error('Failed to get speech token from Azure:', tokenError.message);
        
        // Clear cache on error
        tokenCache = {
          token: null,
          region: null,
          expiresAt: null
        };
        
        // Provide helpful error messages
        let errorMessage = 'Failed to initialize speech service';
        let statusCode = 500;
        
        if (tokenError.response) {
          if (tokenError.response.status === 401) {
            errorMessage = 'Invalid speech service key. Please check Azure configuration.';
            console.error('Azure Speech API Key is invalid or expired');
          } else if (tokenError.response.status === 403) {
            errorMessage = 'Speech service access denied. Check Azure subscription.';
            console.error('Azure Speech subscription may be disabled or quota exceeded');
          } else {
            errorMessage = `Azure Speech service error: ${tokenError.response.status}`;
          }
        } else if (tokenError.code === 'ECONNABORTED') {
          errorMessage = 'Speech service timeout. Please try again.';
        } else if (tokenError.code === 'ENOTFOUND') {
          errorMessage = `Invalid speech region: ${speechRegion}`;
          console.error('Invalid Azure region specified');
        }
        
        return {
          status: statusCode,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? tokenError.message : undefined
          }
        };
      }
      
    } catch (error) {
      console.error('Unexpected error in speech token handler:', error);
      
      // Clear cache on any error
      tokenCache = {
        token: null,
        region: null,
        expiresAt: null
      };
      
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        jsonBody: { 
          error: 'Internal server error',
          message: 'An unexpected error occurred while processing your request'
        }
      };
    }
  }
});

// UPDATED Permission helper with patient management permissions
function hasPermission(userRole, requiredPermission) {
  const permissions = {
    super_admin: [
      'scribe', 
      'add_patients', 
      'edit_patients',
      'delete_patients',
      'add_users', 
      'read_all_notes', 
      'edit_all_notes', 
      'manage_users',
      'view_all_patients',
      'export_data'
    ],
    admin: [
      'scribe', 
      'add_patients', 
      'edit_patients',
      'delete_patients',
      'add_users', 
      'read_all_notes', 
      'edit_own_notes',
      'manage_users',
      'view_all_patients'
    ],
    medical_provider: [
      'scribe', 
      'add_patients',
      'edit_patients',
      'delete_patients',
      'read_own_notes',
      'edit_own_notes',
      'view_own_patients'
    ],
    support_staff: [
      'add_patients',
      'edit_patients', 
      'read_all_notes',
      'view_all_patients'
    ]
  };
  
  return permissions[userRole]?.includes(requiredPermission) || false;
}

// Health check endpoint for monitoring
app.http('speechHealthCheck', {
  methods: ['GET'],
  route: 'speech-health',
  handler: async (request, context) => {
    const speechKey = process.env.SPEECH_KEY;
    const speechRegion = process.env.SPEECH_REGION || 'eastus';
    
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      jsonBody: {
        status: 'healthy',
        configured: !!speechKey,
        region: speechRegion,
        cacheStatus: tokenCache.token ? 'cached' : 'empty',
        cacheExpiry: tokenCache.expiresAt ? new Date(tokenCache.expiresAt).toISOString() : null
      }
    };
  }
});

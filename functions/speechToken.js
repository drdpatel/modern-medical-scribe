// functions/speechToken.js
// Azure Function for secure speech token generation with role-based access

const { app } = require('@azure/functions');
const axios = require('axios');

// Token cache to reduce API calls
let tokenCache = {
  token: null,
  region: null,
  expiresAt: null
};

// Permission helper
function hasPermission(userRole, permission) {
  const permissions = {
    super_admin: [
      'scribe', 'add_patients', 'add_users', 'read_all_notes', 
      'edit_all_notes', 'manage_users', 'manage_settings'
    ],
    admin: [
      'scribe', 'add_patients', 'add_users', 'read_all_notes', 
      'edit_own_notes', 'manage_users'
    ],
    doctor: [
      'scribe', 'add_patients', 'edit_patients', 'delete_patients',
      'read_own_notes', 'edit_own_notes', 'delete_own_notes'
    ],
    medical_provider: [
      'scribe', 'read_own_notes', 'edit_own_notes'
    ],
    nurse: [
      'add_patients', 'edit_patients', 'read_all_notes'
    ],
    staff: [
      'add_patients', 'edit_patients', 'read_all_notes'
    ],
    support_staff: [
      'add_patients', 'read_all_notes'
    ]
  };
  
  return permissions[userRole]?.includes(permission) || false;
}

// Validate environment variables
function validateConfig() {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;
  
  if (!speechKey || !speechRegion) {
    console.error('Missing Azure Speech configuration');
    return null;
  }
  
  return { speechKey, speechRegion };
}

// Speech token endpoint
app.http('speech-token', {
  methods: ['GET', 'POST'],
  route: 'speech-token',
  handler: async (request, context) => {
    try {
      // Log request for debugging
      console.log('Speech token request received');
      
      // Get user info from headers
      const userId = request.headers['x-user-id'];
      const userRole = request.headers['x-user-role'];
      
      // Validate user authentication
      if (!userId || !userRole) {
        console.log('Missing authentication headers');
        return {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { 
            error: 'Authentication required',
            details: 'Missing user credentials'
          }
        };
      }
      
      // Check user permission for scribe feature
      if (!hasPermission(userRole, 'scribe')) {
        console.log(`User ${userId} with role ${userRole} denied scribe access`);
        return {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { 
            error: 'Access denied',
            details: 'You do not have permission to use the scribe feature'
          }
        };
      }
      
      // Validate Azure Speech configuration
      const config = validateConfig();
      if (!config) {
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { 
            error: 'Speech service not configured',
            details: 'Please contact your administrator'
          }
        };
      }
      
      const { speechKey, speechRegion } = config;
      
      // Check if we have a valid cached token
      if (tokenCache.token && 
          tokenCache.region === speechRegion && 
          tokenCache.expiresAt && 
          Date.now() < tokenCache.expiresAt) {
        
        console.log(`Returning cached token for user ${userId}`);
        
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=540' // 9 minutes
          },
          jsonBody: {
            token: tokenCache.token,
            region: tokenCache.region,
            expiresIn: Math.floor((tokenCache.expiresAt - Date.now()) / 1000)
          }
        };
      }
      
      // Request new token from Azure
      console.log('Requesting new speech token from Azure');
      
      const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      
      try {
        const response = await axios.post(
          tokenUrl,
          null,
          {
            headers: {
              'Ocp-Apim-Subscription-Key': speechKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000, // 10 second timeout
            validateStatus: (status) => status < 500 // Don't throw on 4xx errors
          }
        );
        
        if (response.status !== 200) {
          console.error(`Azure Speech API error: ${response.status}`);
          return {
            status: 502,
            headers: {
              'Content-Type': 'application/json'
            },
            jsonBody: { 
              error: 'Failed to initialize speech service',
              details: 'Unable to obtain speech token'
            }
          };
        }
        
        // Cache the token (tokens are valid for 10 minutes, cache for 9 to be safe)
        tokenCache = {
          token: response.data,
          region: speechRegion,
          expiresAt: Date.now() + (9 * 60 * 1000) // 9 minutes
        };
        
        // Log successful token generation
        console.log(`Speech token issued for user: ${userId} (role: ${userRole})`);
        
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, max-age=540' // 9 minutes
          },
          jsonBody: {
            token: tokenCache.token,
            region: tokenCache.region,
            expiresIn: 540 // 9 minutes in seconds
          }
        };
        
      } catch (tokenError) {
        // Handle Azure API errors
        if (tokenError.response) {
          console.error('Azure API error:', {
            status: tokenError.response.status,
            data: tokenError.response.data
          });
          
          if (tokenError.response.status === 401) {
            return {
              status: 500,
              headers: {
                'Content-Type': 'application/json'
              },
              jsonBody: { 
                error: 'Invalid speech service configuration',
                details: 'Please contact your administrator'
              }
            };
          } else if (tokenError.response.status === 429) {
            return {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60'
              },
              jsonBody: { 
                error: 'Rate limit exceeded',
                details: 'Please try again in a minute'
              }
            };
          }
        } else if (tokenError.code === 'ECONNABORTED') {
          console.error('Azure API timeout');
          return {
            status: 504,
            headers: {
              'Content-Type': 'application/json'
            },
            jsonBody: { 
              error: 'Speech service timeout',
              details: 'Please try again'
            }
          };
        } else {
          console.error('Unexpected error:', tokenError.message);
        }
        
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          },
          jsonBody: { 
            error: 'Failed to initialize speech service',
            details: process.env.NODE_ENV === 'development' ? tokenError.message : 'Internal error'
          }
        };
      }
      
    } catch (error) {
      // Handle unexpected errors
      console.error('Unexpected error in speech-token function:', error);
      
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        jsonBody: { 
          error: 'Internal server error',
          details: 'An unexpected error occurred'
        }
      };
    }
  }
});

// Health check endpoint for speech service
app.http('speech-health', {
  methods: ['GET'],
  route: 'speech-health',
  handler: async (request, context) => {
    try {
      const config = validateConfig();
      
      if (!config) {
        return {
          status: 503,
          jsonBody: {
            status: 'unhealthy',
            error: 'Speech service not configured'
          }
        };
      }
      
      // Check if we can reach Azure Speech API
      const { speechKey, speechRegion } = config;
      const healthUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
      
      try {
        const response = await axios.post(
          healthUrl,
          null,
          {
            headers: {
              'Ocp-Apim-Subscription-Key': speechKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 5000
          }
        );
        
        if (response.status === 200) {
          return {
            status: 200,
            jsonBody: {
              status: 'healthy',
              region: speechRegion,
              timestamp: new Date().toISOString()
            }
          };
        }
      } catch (error) {
        console.error('Health check failed:', error.message);
      }
      
      return {
        status: 503,
        jsonBody: {
          status: 'unhealthy',
          error: 'Cannot reach Azure Speech service'
        }
      };
      
    } catch (error) {
      console.error('Health check error:', error);
      return {
        status: 503,
        jsonBody: {
          status: 'unhealthy',
          error: 'Internal error'
        }
      };
    }
  }
});

// Clear token cache endpoint (admin only)
app.http('speech-clear-cache', {
  methods: ['POST'],
  route: 'speech-clear-cache',
  handler: async (request, context) => {
    try {
      const userRole = request.headers['x-user-role'];
      
      // Only admins can clear cache
      if (userRole !== 'super_admin' && userRole !== 'admin') {
        return {
          status: 403,
          jsonBody: { error: 'Admin access required' }
        };
      }
      
      // Clear the cache
      tokenCache = {
        token: null,
        region: null,
        expiresAt: null
      };
      
      console.log('Speech token cache cleared by admin');
      
      return {
        status: 200,
        jsonBody: { 
          message: 'Cache cleared successfully',
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to clear cache' }
      };
    }
  }
});

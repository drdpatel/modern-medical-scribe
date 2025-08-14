const { app } = require('@azure/functions');

app.http('generateNotes', {
  methods: ['POST'],
  route: 'generate-notes',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const { transcript, patientContext, systemPrompt } = body;
      
      // Get keys from environment variables
      const openaiKey = process.env.OPENAI_KEY;
      const openaiEndpoint = process.env.OPENAI_ENDPOINT;
      const openaiDeployment = process.env.OPENAI_DEPLOYMENT || 'gpt-4';
      const openaiApiVersion = process.env.OPENAI_API_VERSION || '2024-08-01-preview';
      
      if (!openaiKey || !openaiEndpoint) {
        return {
          status: 500,
          jsonBody: { error: 'OpenAI configuration missing' }
        };
      }
      
      // Clean endpoint URL
      const baseUrl = openaiEndpoint.endsWith('/') ? openaiEndpoint.slice(0, -1) : openaiEndpoint;
      const apiUrl = `${baseUrl}/openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiApiVersion}`;
      
      // Make request to OpenAI
      const axios = require('axios');
      const response = await axios.post(
        apiUrl,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${patientContext}\n\nCURRENT VISIT TRANSCRIPT:\n${transcript}\n\nPlease convert this into a structured medical note.` }
          ],
          max_tokens: 2000,
          temperature: 0.1,
          top_p: 0.9,
          frequency_penalty: 0.1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'api-key': openaiKey
          },
          timeout: 30000
        }
      );
      
      return {
        status: 200,
        jsonBody: { 
          notes: response.data.choices[0].message.content 
        }
      };
      
    } catch (error) {
      console.error('Generate notes error:', error);
      return {
        status: 500,
        jsonBody: { 
          error: error.message || 'Failed to generate notes' 
        }
      };
    }
  }
});

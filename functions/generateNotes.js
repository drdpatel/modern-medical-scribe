const { app } = require('@azure/functions');
const axios = require('axios');

app.http('generateNotes', {
  methods: ['POST'],
  route: 'generate-notes',
  handler: async (request, context) => {
    const { transcript, patientContext, systemPrompt } = await request.json();
    
    // Keys from environment variables - NEVER in code
    const openaiKey = process.env.OPENAI_KEY;
    const openaiEndpoint = process.env.OPENAI_ENDPOINT;
    const openaiDeployment = process.env.OPENAI_DEPLOYMENT;
    
    const response = await axios.post(
      `${openaiEndpoint}/openai/deployments/${openaiDeployment}/chat/completions?api-version=2024-08-01-preview`,
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${patientContext}\n\n${transcript}` }
        ],
        max_tokens: 2000,
        temperature: 0.1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': openaiKey
        }
      }
    );
    
    return {
      status: 200,
      jsonBody: { notes: response.data.choices[0].message.content }
    };
  }
});

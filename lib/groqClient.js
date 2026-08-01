const Groq = require('groq-sdk');
require('dotenv').config();

const client1 = new Groq({ apiKey: process.env.GROQ_KEY });
const client2 = process.env.GROQ_KEY_2 ? new Groq({ apiKey: process.env.GROQ_KEY_2 }) : null;

const clients = [client1];
if (client2) {
  clients.push(client2);
}

let currentClientIndex = 0;

const groqWrapper = {
  chat: {
    completions: {
      create: async (params) => {
        let attempts = clients.length;
        let lastError = null;

        for (let i = 0; i < attempts; i++) {
          const clientIdx = (currentClientIndex + i) % clients.length;
          const client = clients[clientIdx];
          try {
            const response = await client.chat.completions.create(params);
            // On success, stick with this client index for future calls
            currentClientIndex = clientIdx;
            return response;
          } catch (error) {
            lastError = error;
            const isRateLimit = (
              error.status === 429 ||
              error.statusCode === 429 ||
              (error.message && error.message.toLowerCase().includes('rate limit')) ||
              error.name === 'RateLimitError'
            );
            if (isRateLimit && clients.length > 1) {
              console.warn(`⚠️ Groq Client ${clientIdx + 1} rate limited. Trying next client...`);
              continue;
            }
            throw error;
          }
        }
        throw lastError;
      }
    }
  }
};

module.exports = groqWrapper;

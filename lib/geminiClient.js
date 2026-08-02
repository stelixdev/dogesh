const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Collect configured Gemini API keys
const keys = [];

if (process.env.GEMINI_KEY && process.env.GEMINI_KEY.trim() !== "" && !process.env.GEMINI_KEY.startsWith("YOUR_")) {
  keys.push(process.env.GEMINI_KEY.trim());
}

for (const envKey in process.env) {
  if (envKey.startsWith('GEMINI_API_KEY_') || envKey.startsWith('GEMINI_KEY_')) {
    const val = process.env[envKey];
    if (val && val.trim() !== "" && !val.startsWith("YOUR_") && !keys.includes(val.trim())) {
      keys.push(val.trim());
    }
  }
}

// Cooldown tracker (key -> expiry timestamp)
const cooldowns = new Map();

function isKeyOnCooldown(key) {
  const expiry = cooldowns.get(key);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    cooldowns.delete(key);
    return false;
  }
  return true;
}

function putKeyOnCooldown(key) {
  cooldowns.set(key, Date.now() + 180000); // 3 minutes in milliseconds
}

async function geminiChatCompletion(systemInstruction, messages) {
  // Find all keys not currently on cooldown
  const activeKeys = keys.filter(k => !isKeyOnCooldown(k));

  if (activeKeys.length === 0) {
    throw new Error('All configured Gemini API keys are currently on cooldown or no keys are configured.');
  }

  let lastError = null;

  for (const key of activeKeys) {
    const keyMask = key.substring(0, 8) + '...';
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        systemInstruction: systemInstruction
      });

      // Convert messages to Gemini format: { role: 'user'|'model', parts: [{ text: '...' }] }
      const contents = messages.map(m => {
        const role = m.role === 'assistant' ? 'model' : 'user';
        return {
          role: role,
          parts: [{ text: m.content }]
        };
      });

      const result = await model.generateContent({
        contents: contents
      });

      const text = result.response.text();
      if (!text) {
        throw new Error('Gemini returned empty response.');
      }
      return text;
    } catch (err) {
      lastError = err;
      const errMsg = err.message || '';
      
      // Determine if error is due to Rate Limit (HTTP 429) or Quota Exceeded
      const isRateLimit = errMsg.includes('429') ||
                          errMsg.toLowerCase().includes('quota') ||
                          errMsg.toLowerCase().includes('rate limit') ||
                          errMsg.toLowerCase().includes('too many requests');

      if (isRateLimit) {
        console.warn(`[Gemini Key ${keyMask} Rate-Limited] Putting key on 3-min cooldown and switching to next key...`);
        putKeyOnCooldown(key);
      } else {
        console.warn(`[Gemini Key ${keyMask} Error]:`, errMsg);
        // Put on cooldown to try other keys or Groq
        putKeyOnCooldown(key);
      }
    }
  }

  throw new Error(`All attempted Gemini API keys failed. Last error: ${lastError ? lastError.message : 'Unknown error'}`);
}

module.exports = {
  geminiChatCompletion,
  isConfigured: keys.length > 0
};

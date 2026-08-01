const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_KEY;
let genAI = null;

if (apiKey && apiKey.trim() !== "" && !apiKey.startsWith("YOUR_")) {
  genAI = new GoogleGenerativeAI(apiKey);
}

async function geminiChatCompletion(systemInstruction, messages) {
  if (!genAI) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
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
}

module.exports = {
  geminiChatCompletion,
  isConfigured: !!genAI
};

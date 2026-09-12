const fs = require('fs');
const path = require('path');
const defaultConfig = require('../config/defaultConfig');

const CONFIG_FILE = path.join(__dirname, '..', 'dogesh_config.json');

// In-memory active configuration
let currentConfig = null;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Deep merge source into target ensuring no field from target (defaults) is lost or blank
 */
function mergeWithDefaults(overrides, defaults) {
  if (!overrides || typeof overrides !== 'object') {
    return deepClone(defaults);
  }

  const result = deepClone(defaults);

  if (typeof overrides.systemPromptBase === 'string' && overrides.systemPromptBase.trim()) {
    result.systemPromptBase = overrides.systemPromptBase.trim();
  }

  if (typeof overrides.customPromptRules === 'string') {
    result.customPromptRules = overrides.customPromptRules.trim();
  }

  if (overrides.toneSettings && typeof overrides.toneSettings === 'object') {
    if (overrides.toneSettings.savageLevel) {
      result.toneSettings.savageLevel = overrides.toneSettings.savageLevel;
    }
    if (overrides.toneSettings.sarcasmLevel) {
      result.toneSettings.sarcasmLevel = overrides.toneSettings.sarcasmLevel;
    }
    if (typeof overrides.toneSettings.bhaicharaMode === 'boolean') {
      result.toneSettings.bhaicharaMode = overrides.toneSettings.bhaicharaMode;
    }
    if (typeof overrides.toneSettings.refereeMode === 'boolean') {
      result.toneSettings.refereeMode = overrides.toneSettings.refereeMode;
    }
    if (typeof overrides.toneSettings.timeVibeEnabled === 'boolean') {
      result.toneSettings.timeVibeEnabled = overrides.toneSettings.timeVibeEnabled;
    }
  }

  if (Array.isArray(overrides.bantersAndJokes) && overrides.bantersAndJokes.length > 0) {
    result.bantersAndJokes = overrides.bantersAndJokes.map(b => String(b).trim()).filter(Boolean);
  }

  return result;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      currentConfig = mergeWithDefaults(parsed, defaultConfig);
      console.log('⚙️ [configManager] Loaded custom configuration from dogesh_config.json');
      return currentConfig;
    }
  } catch (err) {
    console.warn('⚠️ [configManager] Failed to read dogesh_config.json, falling back to defaults:', err.message);
  }

  currentConfig = deepClone(defaultConfig);
  console.log('⚙️ [configManager] Loaded factory default configuration.');
  return currentConfig;
}

function getConfig() {
  if (!currentConfig) {
    loadConfig();
  }
  return deepClone(currentConfig);
}

function updateConfig(newSettings) {
  const merged = mergeWithDefaults(newSettings, currentConfig || defaultConfig);
  currentConfig = merged;

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
    console.log('✅ [configManager] Successfully saved updated configuration to dogesh_config.json');
  } catch (err) {
    console.error('❌ [configManager] Failed to write dogesh_config.json:', err.message);
  }

  return deepClone(currentConfig);
}

function resetToDefaults() {
  currentConfig = deepClone(defaultConfig);
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
    console.log('🔄 [configManager] Successfully reset configuration to factory defaults.');
  } catch (err) {
    console.error('❌ [configManager] Error removing custom config file on reset:', err.message);
  }
  return deepClone(currentConfig);
}

/**
 * Builds the complete system prompt dynamically based on live settings
 */
function buildFullSystemPrompt(extraContext = {}) {
  const cfg = getConfig();
  let prompt = cfg.systemPromptBase + '\n\n';

  // Tone & Attitude Block
  prompt += `[Active Tone & Attitude Settings]:
- Savage Level: ${cfg.toneSettings.savageLevel.toUpperCase()}
- Sarcasm Level: ${cfg.toneSettings.sarcasmLevel.toUpperCase()}
- Bhaichara (Brotherhood) Mode: ${cfg.toneSettings.bhaicharaMode ? 'ENABLED (Treat everyone like a true friend. If a homie is sad or asking for real advice, drop the roast and give genuine brotherly support. If they are talking casually or boasting, banter with them.)' : 'DISABLED'}
- Referee / Lafda Mode: ${cfg.toneSettings.refereeMode ? 'ENABLED (If two friends in the server are arguing, bantering, or fighting, humorously pick a side and roast the other! Never give boring, diplomatic bot answers like "both are right".)' : 'DISABLED'}\n\n`;

  // Banters & Slang inspiration
  if (cfg.bantersAndJokes && cfg.bantersAndJokes.length > 0) {
    prompt += `[Banter & Vernacular Inspiration]:
Examples of your vibe, style, and slang:
${cfg.bantersAndJokes.map(b => `- "${b}"`).join('\n')}
CRITICAL INSTRUCTION ON BANTERS: These are strictly EXAMPLES and inspiration for your casual Delhi/Discord friend tone. Do NOT limit yourself to only these lines and do NOT repeatedly spam the exact same 3-4 phrases in every message. Keep your vocabulary fresh, natural, varied, and contextual!\n\n`;
  }

  // Custom Prompt Rules
  if (cfg.customPromptRules && cfg.customPromptRules.trim()) {
    prompt += `[Custom Server Rules & Context]:
${cfg.customPromptRules.trim()}\n\n`;
  }

  // Time Vibe (if enabled and provided in extraContext)
  if (cfg.toneSettings.timeVibeEnabled && extraContext.timeVibe) {
    prompt += `[Time-of-Day Vibe Context (IST)]:
${extraContext.timeVibe}\n\n`;
  }

  return prompt;
}

// Initialize on require
loadConfig();

module.exports = {
  getConfig,
  updateConfig,
  resetToDefaults,
  buildFullSystemPrompt,
  defaultConfig
};

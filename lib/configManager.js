const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const defaultConfig = require('../config/defaultConfig');

const CONFIG_FILE = path.join(__dirname, '..', 'dogesh_config.json');

// In-memory active configuration
let currentConfig = null;
let memoryChannel = null;
let configMessageId = null;
const CONFIG_TAG = '[DOGESH_CONFIG_STATE]';

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

  // Non-blocking sync to Discord memory channel
  syncToDiscord(currentConfig).catch(err => {
    console.warn('[configManager] Background Discord sync failed:', err.message);
  });

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

  // Non-blocking sync to Discord memory channel
  syncToDiscord(currentConfig).catch(err => {
    console.warn('[configManager] Background Discord sync failed:', err.message);
  });

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

async function findMemoryChannel(client) {
  const channelId = (process.env.GIF_MEMORY_CHANNEL_ID || process.env.MEMORY_CHANNEL_ID || '').trim();
  if (channelId) {
    try {
      const ch = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
      if (ch && ch.isTextBased()) return ch;
      console.warn(`[configManager] Memory channel (${channelId}) not found or not text-based.`);
    } catch (e) {
      console.warn('[configManager] Failed to fetch channel:', e.message);
    }
  }
  return null;
}

function buildConfigPayload(config) {
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const savage = (config.toneSettings?.savageLevel || 'high').toUpperCase();
  const sarcasm = (config.toneSettings?.sarcasmLevel || 'medium').toUpperCase();
  const bhaichara = config.toneSettings?.bhaicharaMode ? 'ON' : 'OFF';
  const referee = config.toneSettings?.refereeMode ? 'ON' : 'OFF';
  const timeVibe = config.toneSettings?.timeVibeEnabled ? 'ON' : 'OFF';
  const bantersCount = Array.isArray(config.bantersAndJokes) ? config.bantersAndJokes.length : 0;

  const summary = `⚙️ **${CONFIG_TAG}** Live Studio Configuration
• **Last Updated:** ${ts} (IST)
• **Savage Level:** ${savage} | **Sarcasm Level:** ${sarcasm}
• **Bhaichara:** ${bhaichara} | **Referee:** ${referee} | **TimeVibe:** ${timeVibe}
• **Banter Pool:** ${bantersCount} phrases loaded
*(Full configuration JSON attached for instant redeploy/restart persistence)*`;

  const jsonBuf = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
  const attachment = new AttachmentBuilder(jsonBuf, { name: 'dogesh_config.json' });

  return {
    content: summary,
    files: [attachment]
  };
}

async function syncToDiscord(config) {
  if (!memoryChannel) return false;
  try {
    const payload = buildConfigPayload(config);

    if (configMessageId) {
      try {
        const msg = await memoryChannel.messages.fetch(configMessageId).catch(() => null);
        if (msg) {
          await msg.edit({
            content: payload.content,
            files: payload.files,
            attachments: []
          });
          console.log(`✅ [configManager] Edited existing Discord config message (${configMessageId}) in #${memoryChannel.name}`);
          return true;
        }
      } catch (e) {
        console.warn('[configManager] Could not edit existing config message, sending fresh one:', e.message);
      }
    }

    const sent = await memoryChannel.send(payload);
    if (sent) {
      configMessageId = sent.id;
      console.log(`✅ [configManager] Sent initial Discord config state message (${sent.id}) to #${memoryChannel.name}`);
      return true;
    }
  } catch (err) {
    console.warn('[configManager] Failed to sync config to Discord:', err.message);
  }
  return false;
}

async function initDiscordSync(client) {
  try {
    memoryChannel = await findMemoryChannel(client);
    if (!memoryChannel) {
      console.log('[configManager] No memory channel configured. Using local config only.');
      return;
    }

    console.log(`[configManager] Connected to memory channel #${memoryChannel.name}. Searching for existing config message...`);

    const messages = await memoryChannel.messages.fetch({ limit: 50 }).catch(err => {
      console.warn('[configManager] Failed to fetch messages from memory channel:', err.message);
      return null;
    });

    let foundMsg = null;
    let restoredConfig = null;

    if (messages && messages.size > 0) {
      for (const msg of messages.values()) {
        if (msg.content && msg.content.includes(CONFIG_TAG)) {
          foundMsg = msg;
          const attachment = extractConfigAttachment(msg);
          if (attachment && attachment.url) {
            try {
              const res = await fetch(attachment.url);
              if (res.ok) {
                const rawText = await res.text();
                restoredConfig = JSON.parse(rawText);
              }
            } catch (e) {
              console.warn('[configManager] Failed to fetch attachment JSON:', e.message);
            }
          }

          if (!restoredConfig && msg.content) {
            const jsonMatch = msg.content.match(/```json\s*([\s\S]*?)\s*```/i);
            if (jsonMatch) {
              try {
                restoredConfig = JSON.parse(jsonMatch[1]);
              } catch (e) {}
            }
          }

          if (foundMsg) break;
        }
      }
    }

    if (foundMsg && restoredConfig) {
      configMessageId = foundMsg.id;
      currentConfig = mergeWithDefaults(restoredConfig, defaultConfig);
      try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
      } catch (e) {}
      console.log(`✅ [configManager] Restored configuration from Discord memory channel (Message ID: ${foundMsg.id})!`);
    } else if (foundMsg && !restoredConfig) {
      configMessageId = foundMsg.id;
      console.warn(`[configManager] Found config message ${foundMsg.id} but JSON was invalid. Updating with active config...`);
      await syncToDiscord(currentConfig || defaultConfig);
    } else {
      console.log('[configManager] No existing configuration message found in memory channel. Creating initial backup...');
      await syncToDiscord(currentConfig || defaultConfig);
    }
  } catch (err) {
    console.error('Error during configManager Discord sync init:', err);
  }
}

function extractConfigAttachment(msg) {
  if (!msg || !msg.attachments) return null;
  const atts = msg.attachments;
  if (typeof atts.find === 'function') {
    return atts.find(a => a.name === 'dogesh_config.json') || (atts.first && atts.first());
  }
  if (Array.isArray(atts)) {
    return atts.find(a => a.name === 'dogesh_config.json') || atts[0];
  }
  if (atts.values) {
    const arr = Array.from(atts.values());
    return arr.find(a => a.name === 'dogesh_config.json') || arr[0];
  }
  return null;
}

function getConfigMessageId() {
  return configMessageId;
}

function onConfigMessageDeleted() {
  console.log('⚠️ [configManager] Discord config message was deleted. Resetting message tracking.');
  configMessageId = null;
}

async function onConfigMessageUpdated(message) {
  try {
    const attachment = extractConfigAttachment(message);
    if (attachment && attachment.url) {
      const res = await fetch(attachment.url);
      if (res.ok) {
        const parsed = JSON.parse(await res.text());
        currentConfig = mergeWithDefaults(parsed, defaultConfig);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
        console.log('🔄 [configManager] Reloaded config from Discord message edit.');
      }
    }
  } catch (e) {
    console.warn('[configManager] Error processing config message update:', e.message);
  }
}

// Initialize on require
loadConfig();

module.exports = {
  getConfig,
  updateConfig,
  resetToDefaults,
  buildFullSystemPrompt,
  initDiscordSync,
  getConfigMessageId,
  onConfigMessageDeleted,
  onConfigMessageUpdated,
  defaultConfig
};

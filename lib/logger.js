const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../bot.log');

// Helpers to capture original console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Truncate logs if they exceed 2MB
function checkAndRotateLog() {
  try {
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size > 2 * 1024 * 1024) { // 2MB limit
        const content = fs.readFileSync(logFilePath, 'utf8');
        const lines = content.split('\n');
        // Keep only the last 1000 lines to free up space
        const keptLines = lines.slice(-1000).join('\n');
        fs.writeFileSync(logFilePath, keptLines, 'utf8');
      }
    }
  } catch (e) {
    originalError.call(console, 'Error rotating logs:', e);
  }
}

// Redact sensitive secrets from console outputs
function redactSecrets(message) {
  if (typeof message !== 'string') {
    try {
      message = JSON.stringify(message);
    } catch (e) {
      message = String(message);
    }
  }

  // Get keys to redact
  const secrets = [
    process.env.BOT_TOKEN,
    process.env.DISCORD_TOKEN,
    process.env.GROQ_API_KEY,
    process.env.GROQ_KEY,
    process.env.GEMINI_KEY,
    process.env.TAVILY_API_KEY,
    process.env.TAVILY_KEY
  ];

  // Also match other dynamic keys from env loader
  for (const envKey in process.env) {
    if (envKey.startsWith('GEMINI_API_KEY_') || envKey.startsWith('GEMINI_KEY_')) {
      secrets.push(process.env[envKey]);
    }
  }

  let redacted = message;
  for (const secret of secrets) {
    if (secret && secret.trim() !== '' && secret.length > 5) {
      const escaped = secret.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      redacted = redacted.replace(regex, '[REDACTED]');
    }
  }
  return redacted;
}

function formatLog(type, args) {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const rawMsg = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  const redactedMsg = redactSecrets(rawMsg);
  return `[${timestamp}] [${type}] ${redactedMsg}\n`;
}

// Overwrite console logging methods to write to bot.log
console.log = function(...args) {
  originalLog.apply(console, args);
  try {
    checkAndRotateLog();
    fs.appendFileSync(logFilePath, formatLog('INFO', args));
  } catch (e) {}
};

console.warn = function(...args) {
  originalWarn.apply(console, args);
  try {
    checkAndRotateLog();
    fs.appendFileSync(logFilePath, formatLog('WARN', args));
  } catch (e) {}
};

console.error = function(...args) {
  originalError.apply(console, args);
  try {
    checkAndRotateLog();
    fs.appendFileSync(logFilePath, formatLog('ERROR', args));
  } catch (e) {}
};

function getRecentLogs(linesCount = 30) {
  try {
    if (!fs.existsSync(logFilePath)) {
      return 'No logs available yet.';
    }
    const content = fs.readFileSync(logFilePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    return lines.slice(-linesCount).join('\n');
  } catch (e) {
    return `Error reading log file: ${e.message}`;
  }
}

module.exports = {
  getRecentLogs,
  logFilePath
};

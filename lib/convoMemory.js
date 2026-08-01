const fs = require('fs').promises;
const path = require('path');

const FILE = path.join(__dirname, '..', 'recent_convos.json');
const MAX_ENTRIES = 20;

async function loadAll() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

async function saveAll(data) {
  try {
    await fs.writeFile(FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // ignore write errors
  }
}

async function addEntry(channelId, role, content, username = null) {
  const data = await loadAll();
  if (!data[channelId]) data[channelId] = [];
  
  const entry = { role, content, ts: Date.now() };
  if (role === 'user' && username) {
    // Sanitize username to fit API rules: a-z, A-Z, 0-9, _, - (max 64 chars)
    entry.name = username.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 64);
  }

  data[channelId].push(entry);
  // keep only last MAX_ENTRIES
  if (data[channelId].length > MAX_ENTRIES) {
    data[channelId] = data[channelId].slice(-MAX_ENTRIES);
  }
  await saveAll(data);
}

async function getRecent(channelId) {
  const data = await loadAll();
  return data[channelId] || [];
}

module.exports = { addEntry, getRecent };

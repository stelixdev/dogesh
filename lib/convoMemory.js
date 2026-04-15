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

async function addEntry(userId, role, content) {
  const data = await loadAll();
  if (!data[userId]) data[userId] = [];
  data[userId].push({ role, content, ts: Date.now() });
  // keep only last MAX_ENTRIES
  if (data[userId].length > MAX_ENTRIES) {
    data[userId] = data[userId].slice(-MAX_ENTRIES);
  }
  await saveAll(data);
}

async function getRecent(userId) {
  const data = await loadAll();
  return data[userId] || [];
}

module.exports = { addEntry, getRecent };

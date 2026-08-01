const fs = require('fs').promises;
const path = require('path');

const FILE = path.join(__dirname, '..', 'reminders.json');
const activeTimers = new Map(); // key: reminder ID, value: Timeout object

async function loadReminders() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function saveReminders(reminders) {
  try {
    await fs.writeFile(FILE, JSON.stringify(reminders, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving reminders:', err);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function scheduleReminder(client, reminder) {
  const delay = reminder.targetTime - Date.now();
  
  if (delay <= 0) {
    // If it passed recently (e.g. within last 2 hours) while bot was offline, fire it now
    const twoHours = 2 * 60 * 60 * 1000;
    if (Math.abs(delay) < twoHours) {
      fireReminder(client, reminder);
    } else {
      console.log(`Skipping expired reminder: "${reminder.reminder}" (passed ${Math.abs(delay)}ms ago)`);
      removeReminder(reminder.id);
    }
    return;
  }

  const timer = setTimeout(() => {
    fireReminder(client, reminder);
  }, delay);

  activeTimers.set(reminder.id, timer);
}

async function removeReminder(id) {
  if (activeTimers.has(id)) {
    clearTimeout(activeTimers.get(id));
    activeTimers.delete(id);
  }

  const reminders = await loadReminders();
  const filtered = reminders.filter(r => r.id !== id);
  await saveReminders(filtered);
}

async function fireReminder(client, reminder) {
  try {
    const channel = await client.channels.fetch(reminder.channelId);
    if (channel) {
      await channel.send(`<@${reminder.userId}>, tera reminder: **"${reminder.reminder}"**!`);
    }
  } catch (err) {
    console.error(`Failed to send reminder for ${reminder.id}:`, err);
  } finally {
    await removeReminder(reminder.id);
  }
}

async function init(client) {
  console.log('⏰ Initializing reminder scheduler...');
  const reminders = await loadReminders();
  
  for (const timer of activeTimers.values()) {
    clearTimeout(timer);
  }
  activeTimers.clear();

  for (const reminder of reminders) {
    scheduleReminder(client, reminder);
  }
  console.log(`⏰ Scheduled ${reminders.length} pending reminders.`);
}

async function addReminder(client, { userId, channelId, reminder, delayMs, targetTimeFormatted }) {
  const targetTime = Date.now() + delayMs;
  const newReminder = {
    id: generateId(),
    userId,
    channelId,
    reminder,
    targetTime,
    targetTimeFormatted,
    createdAt: Date.now()
  };

  const reminders = await loadReminders();
  reminders.push(newReminder);
  await saveReminders(reminders);

  scheduleReminder(client, newReminder);
  return newReminder;
}

module.exports = {
  init,
  addReminder
};

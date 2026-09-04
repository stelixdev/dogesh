require('./lib/logger');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

(async () => {
  console.log('[Connection Test] Testing connection to discord.com...');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const t0 = Date.now();
    const res = await fetch('https://discord.com/api/v10/gateway', { signal: controller.signal });
    clearTimeout(timeoutId);
    const body = await res.text();
    console.log(`[Connection Test] HTTP ${res.status} in ${Date.now() - t0}ms | retry-after: ${res.headers.get('retry-after')} | reset-after: ${res.headers.get('x-ratelimit-reset-after')} | body: ${body.substring(0, 200)}`);
  } catch (err) {
    console.error(`[Connection Test] Failed to connect to discord.com:`, err.message);
  }
})();

const { Client, GatewayIntentBits, ActivityType, PermissionsBitField, AttachmentBuilder, Events } = require('discord.js');
const { handleDogesh } = require('./handlers/dogesh');
const reminderScheduler = require('./lib/reminderScheduler');
const { withTimeout } = require('./lib/utils');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  rest: {
    timeout: 15000,
  }
});

// /dogesh commands handle karna
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Automatically extract and save user shared GIFs
  try {
    const gifManager = require('./lib/gifManager');
    const urls = message.content.match(/https?:\/\/[^\s]+/gi) || [];
    for (const url of urls) {
      gifManager.saveGif(url, message.author.username);
    }
    message.attachments.forEach(attachment => {
      if (attachment.url && (attachment.url.toLowerCase().split('?')[0].endsWith('.gif') || (attachment.contentType && attachment.contentType.startsWith('image/gif')))) {
        gifManager.saveGif(attachment.url, message.author.username);
      }
    });
  } catch (err) {
    console.error('Error saving shared GIF:', err);
  }

  const content = message.content.trim();
  const lower = content.toLowerCase();

  let shouldReply = false;
  let query = '';
  let repliedToMessage = null;
  let originalUserMessage = null;

  const botId = client.user ? client.user.id : null;
  const isMentioned = botId && message.mentions.users.has(botId);
  const isDM = !message.guild;
  const textPrefix = '@dogesh bhai';

  if (isMentioned) {
    query = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
    if (!query) return message.reply('Kuch toh puch bhai! 😅');
    shouldReply = true;
  } else if (lower.startsWith(textPrefix + ' ')) {
    query = content.slice(textPrefix.length).trim();
    if (!query) return message.reply('Kuch toh puch bhai! 😅');
    shouldReply = true;
  } else if (lower === textPrefix) {
    return message.reply('Kuch toh puch bhai! 😅');
  } else if (isDM) {
    query = content;
    shouldReply = true;
  } else if (message.reference && message.reference.messageId) {
    try {
      repliedToMessage = message.channel.messages.cache.get(message.reference.messageId)
        || await withTimeout(message.channel.messages.fetch(message.reference.messageId), 5000, 'Fetch replied message timed out');

      if (repliedToMessage && botId && repliedToMessage.author.id === botId) {
        query = content;
        shouldReply = true;

        if (repliedToMessage.reference && repliedToMessage.reference.messageId) {
          originalUserMessage = message.channel.messages.cache.get(repliedToMessage.reference.messageId)
            || await withTimeout(message.channel.messages.fetch(repliedToMessage.reference.messageId), 5000, 'Fetch original message timed out');
        }
      }
    } catch (err) {
      console.error('Error fetching reply reference:', err);
    }
  }

  let channelContext = null;

  if (shouldReply) {
    const equalNumMatch = query.match(/^=(\d+)\s+(.*)$/s) || query.match(/^=(\d+)$/);
    if (equalNumMatch) {
      const limit = parseInt(equalNumMatch[1], 10);
      const actualQuery = equalNumMatch[2] || '';
      if (limit > 0 && limit <= 50) {
        try {
          const fetched = await withTimeout(
            message.channel.messages.fetch({ limit, before: message.id }),
            5000,
            'Fetch channel context messages timed out'
          );
          const msgArray = Array.from(fetched.values()).reverse();
          channelContext = msgArray.map(m => `${m.author.username}: "${m.content}"`).join('\n');
          query = actualQuery || 'Summarize the recent conversation above.';
        } catch (err) {
          console.error('Error fetching channel context messages:', err);
        }
      }
    }

    if (query.toLowerCase() === '=msginfo') {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('❌ Yeh command sirf Server Administrators hi run kar sakte hain!');
      }

      try {
        const tracker = require('./lib/tracker');
        const logger = require('./lib/logger');
        let recentLogs = logger.getRecentLogs(6);

        const last = tracker.lastExecution;
        const baseMsg = `🤖 **Last Message Info:**
• **Time:** ${last.timestamp}
• **User:** ${last.user}
• **Query:** "${last.query}"
• **Model Used:** \`${last.modelUsed}\`
• **API Key/Source:** \`${last.apiKeyUsed}\`
• **Tavily Search:** \`${last.tavilyUsed}\`
• **Latency:** \`${last.latencyMs}ms\`

📋 **Console Output (Last 6 lines):**
\`\`\`prolog
`;
        const footer = `\n\`\`\``;

        const maxLogsLength = 2000 - baseMsg.length - footer.length - 50;
        if (recentLogs.length > maxLogsLength) {
          recentLogs = '...[Truncated due to length limit]...\n' + recentLogs.substring(recentLogs.length - maxLogsLength + 40);
        }

        const infoMsg = baseMsg + recentLogs + footer;
        return message.reply(infoMsg);
      } catch (err) {
        console.error('Error handling =lastinfo command:', err);
        return message.reply('❌ System metadata retrieve karne mein error aayi.');
      }
    }

    try {
      await handleDogesh(message, query, repliedToMessage, originalUserMessage, channelContext);
    } catch (err) {
      console.error('Dogesh error:', err);
      await message.reply('❌ Kuch gadbad ho gayi, thodi der baad try karo.');
    }
  }
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);
  reminderScheduler.init(client);
  client.user.setPresence({
    activities: [{ name: '@Dogesh Bhai ask anything 👻', type: ActivityType.Custom }],
    status: 'online',
  });
});

const http = require('http');

process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err);
});

// Port binding for Koyeb/Render/Vercel health checks
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/debug') {
    const logger = require('./lib/logger');
    const statusMap = ['READY', 'CONNECTING', 'RECONNECTING', 'IDLE', 'NEARLY', 'DISCONNECTED', 'WAITING_FOR_GUILDS', 'IDENTIFYING', 'RESUMING'];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      wsStatus: statusMap[client.ws.status] || client.ws.status,
      user: client.user ? client.user.tag : null,
      botId: client.user ? client.user.id : null,
      uptimeSeconds: Math.floor(process.uptime()),
      ping: client.ws.ping,
      nodeVersion: process.version,
      recentLogs: logger.getRecentLogs(35)
    }, null, 2));
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Dogesh Bhai is online re! 💀\n');
});

server.listen(PORT, () => {
  console.log(`🤖 HTTP Health-check server listening on port ${PORT}`);
});

client.on('error', (err) => console.error('[Discord Client Error]', err));
client.on('warn', (warning) => console.warn('[Discord Client Warning]', warning));
client.on('invalidated', () => console.warn('[Discord Client Invalidated]'));
client.on('rateLimit', (info) => console.warn('[Discord REST Rate Limit]', info));
client.on('debug', (info) => console.log(`[Discord Debug] ${info}`));

client.login(process.env.BOT_TOKEN ? process.env.BOT_TOKEN.trim() : '').then(() => {
  console.log('✅ client.login resolved successfully!');
}).catch(err => {
  console.error('❌ client.login rejected:', err);
});

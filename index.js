require('./lib/logger');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

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

  const content = message.content.trim();
  const lower = content.toLowerCase();

  let shouldReply = false;
  let query = '';
  let repliedToMessage = null;
  let originalUserMessage = null;

  const mention = client.user ? `<@${client.user.id}>` : '';
  const mentionNick = client.user ? `<@!${client.user.id}>` : '';
  const textPrefix = '@dogesh bhai';

  if (mention && content.startsWith(mention)) {
    query = content.slice(mention.length).trim();
    if (!query) return message.reply('Kuch toh puch bhai! 😅');
    shouldReply = true;
  } else if (mentionNick && content.startsWith(mentionNick)) {
    query = content.slice(mentionNick.length).trim();
    if (!query) return message.reply('Kuch toh puch bhai! 😅');
    shouldReply = true;
  } else if (lower.startsWith(textPrefix + ' ')) {
    query = content.slice(textPrefix.length).trim();
    if (!query) return message.reply('Kuch toh puch bhai! 😅');
    shouldReply = true;
  } else if (lower === textPrefix) {
    return message.reply('Kuch toh puch bhai! 😅');
  } else if (message.reference && message.reference.messageId) {
    try {
      repliedToMessage = message.channel.messages.cache.get(message.reference.messageId)
        || await withTimeout(message.channel.messages.fetch(message.reference.messageId), 5000, 'Fetch replied message timed out');

      if (repliedToMessage && repliedToMessage.author.id === client.user.id) {
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

client.login(process.env.BOT_TOKEN);

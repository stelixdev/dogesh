const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { handleDogesh } = require('./handlers/dogesh');
const reminderScheduler = require('./lib/reminderScheduler');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
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
        || await message.channel.messages.fetch(message.reference.messageId);

      if (repliedToMessage && repliedToMessage.author.id === client.user.id) {
        query = content;
        shouldReply = true;

        if (repliedToMessage.reference && repliedToMessage.reference.messageId) {
          originalUserMessage = message.channel.messages.cache.get(repliedToMessage.reference.messageId)
            || await message.channel.messages.fetch(repliedToMessage.reference.messageId);
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
          const fetched = await message.channel.messages.fetch({ limit, before: message.id });
          const msgArray = Array.from(fetched.values()).reverse();
          channelContext = msgArray.map(m => `${m.author.username}: "${m.content}"`).join('\n');
          query = actualQuery || 'Summarize the recent conversation above.';
        } catch (err) {
          console.error('Error fetching channel context messages:', err);
        }
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

client.once('clientReady', () => {
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

client.login(process.env.BOT_TOKEN);

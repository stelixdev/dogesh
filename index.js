const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { handleDogesh } = require('./handlers/dogesh');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let connection = null;
let manualLeave = false; // jab /dogesh leave karo tab auto-rejoin band ho jaye

function isConnected() {
  return !!(connection && connection.state && connection.state.status !== VoiceConnectionStatus.Destroyed);
}

async function joinVC(guild) {
  try {
    if (!guild) {
      guild = client.guilds.cache.get(process.env.GUILD_ID) || await client.guilds.fetch(process.env.GUILD_ID);
    }
    if (!guild) throw new Error(`Guild nahi mila. GUILD_ID check karo .env mein (current: "${process.env.GUILD_ID}")`);

    const channel = guild.channels.cache.get(process.env.VC_CHANNEL_ID) || await client.channels.fetch(process.env.VC_CHANNEL_ID);
    if (!channel) throw new Error(`Channel nahi mila. VC_CHANNEL_ID check karo .env mein (current: "${process.env.VC_CHANNEL_ID}")`);

    connection = joinVoiceChannel({
      channelId:      channel.id,
      guildId:        guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf:       true,
      selfMute:       true,
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log('✅ VC join ho gaya!');
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (manualLeave) return; // manual leave tha, auto-rejoin mat karo
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        try { connection.destroy(); } catch (_) {}
        connection = null;
        console.log('🔁 10 sec mein wapas join karunga...');
        setTimeout(() => joinVC(null), 10_000);
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      connection = null;
      if (manualLeave) return; // manual leave tha, auto-rejoin mat karo
      setTimeout(() => joinVC(null), 10_000);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (!manualLeave) {
      setTimeout(() => joinVC(null), 15_000);
    }
  }
}

// /dogesh join aur /dogesh leave commands handle karna
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  if (lower === '/dogesh join') {
    manualLeave = false;

    if (isConnected()) {
      return message.reply('Main pehle se VC mein hoon! 👻');
    }

    await message.reply('Aa raha hoon VC mein... 🎤');
    await joinVC(message.guild);

  } else if (lower === '/dogesh leave') {
    if (!isConnected()) {
      return message.reply('Main abhi kisi VC mein nahi hoon! 🤷');
    }

    manualLeave = true;
    connection.destroy();
    connection = null;
    await message.reply('Chal gaya VC se! 👋');
    console.log('🚪 Manual leave ho gaya.');

  } else if (lower.startsWith('/dogesh ')) {
    const query = content.slice('/dogesh '.length).trim();
    if (!query) return message.reply('Kuch toh puch bhai! 😅');
    try {
      await handleDogesh(message, query);
    } catch (err) {
      console.error('Dogesh error:', err);
      await message.reply('❌ Kuch gadbad ho gayi, thodi der baad try karo.');
    }
  }
});

client.once('clientReady', () => {
  console.log(`🤖 Bot ready: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'VC mein AFK 👻', type: ActivityType.Custom }],
    status: 'idle',
  });
  joinVC(null); // startup pe auto-join
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err);
});

client.login(process.env.BOT_TOKEN);

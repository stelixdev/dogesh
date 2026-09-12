const fs = require('fs');
const path = require('path');

const gifsFilePath = path.join(__dirname, '../gifs.json');

// Initialize gifs.json if it doesn't exist
if (!fs.existsSync(gifsFilePath)) {
  fs.writeFileSync(gifsFilePath, JSON.stringify([], null, 2));
}

function getGifDescriptionFromSlug(url) {
  let slug = '';
  try {
    if (url.includes('tenor.com/view/')) {
      const match = url.match(/tenor\.com\/view\/([a-zA-Z0-9-]+?)(?:-gif)?(?:-\d+)?$/i);
      slug = match ? match[1] : '';
    } else if (url.includes('klipy.com/gifs/')) {
      const match = url.match(/klipy\.com\/gifs\/([a-zA-Z0-9-]+)/i);
      slug = match ? match[1] : '';
    } else if (url.includes('giphy.com/gifs/')) {
      const match = url.match(/giphy\.com\/gifs\/([a-zA-Z0-9-]+)/i);
      slug = match ? match[1] : '';
    } else {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/');
      const last = parts[parts.length - 1];
      slug = last.replace(/\.[a-zA-Z0-9]+$/, '');
    }
  } catch (e) {
    slug = 'meme';
  }
  return slug ? slug.replace(/-/g, ' ').trim() : 'meme';
}

async function fetchGifPageMetadata(url) {
  try {
    // Only fetch for HTML pages from Tenor, Giphy, Klipy
    if (!url.includes('tenor.com') && !url.includes('giphy.com') && !url.includes('klipy.com')) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const html = await res.text();

    // Look for og:title or og:description or title tag
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                         html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i) ||
                         html.match(/<title>(.*?)<\/title>/i);

    if (ogTitleMatch && ogTitleMatch[1]) {
      let desc = ogTitleMatch[1].trim();
      // Clean up common portal suffix text
      desc = desc
        .replace(/GIF - Discover & Share GIFs/gi, '')
        .replace(/GIF - Find & Share on GIPHY/gi, '')
        .replace(/GIF/g, '')
        .replace(/on GIPHY/gi, '')
        .replace(/\| Klipy/gi, '')
        .trim();
      return desc || null;
    }
  } catch (err) {
    console.warn(`[gifManager] Metadata fetch failed for ${url}:`, err.message);
  }
  return null;
}

let memoryChannel = null;

async function findMemoryChannel(client) {
  // 1. If explicit channel ID provided in env
  const channelId = process.env.GIF_MEMORY_CHANNEL_ID;
  if (channelId && channelId.trim() !== '') {
    try {
      const ch = client.channels.cache.get(channelId.trim()) || await client.channels.fetch(channelId.trim()).catch(() => null);
      if (ch && ch.isTextBased()) return ch;
    } catch (e) {
      console.warn('[gifManager] Failed to fetch channel by GIF_MEMORY_CHANNEL_ID:', e.message);
    }
  }

  // 2. Search all guilds for a channel named dogesh-memory, bot-memory, or saved-gifs
  for (const guild of client.guilds.cache.values()) {
    const ch = guild.channels.cache.find(c => 
      c.isTextBased() && (c.name === 'dogesh-memory' || c.name === 'bot-memory' || c.name === 'saved-gifs')
    );
    if (ch) return ch;
  }

  return null;
}

async function init(client) {
  try {
    memoryChannel = await findMemoryChannel(client);
    if (!memoryChannel) {
      console.log('[gifManager] No persistent memory channel found (set GIF_MEMORY_CHANNEL_ID or create #dogesh-memory). Using local cache only.');
      return;
    }

    console.log(`[gifManager] Connecting to persistent memory channel #${memoryChannel.name} (ID: ${memoryChannel.id})...`);
    
    // Fetch historical messages from memory channel
    const fetched = await memoryChannel.messages.fetch({ limit: 100 }).catch(err => {
      console.warn('[gifManager] Failed to fetch memory channel messages:', err.message);
      return null;
    });

    if (!fetched || fetched.size === 0) {
      console.log('[gifManager] Memory channel is empty. Checking local cache to back up...');
      const currentGifs = getGifs();
      if (currentGifs.length > 0) {
        console.log(`[gifManager] Backing up ${currentGifs.length} local GIFs to #${memoryChannel.name}...`);
        for (const g of currentGifs.slice().reverse()) {
          const payload = `\`\`\`json\n${JSON.stringify(g, null, 2)}\n\`\`\`\n${g.url}`;
          await memoryChannel.send(payload).catch(() => {});
        }
      }
      return;
    }

    const restoredGifs = [];
    const messages = Array.from(fetched.values());

    for (const msg of messages) {
      // Look for ```json ... ``` block
      const jsonMatch = msg.content.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed && parsed.url) {
            restoredGifs.push(parsed);
          }
        } catch (e) {
          // not valid json, skip
        }
      }
    }

    if (restoredGifs.length > 0) {
      // Merge with local gifs
      const localGifs = getGifs();
      const combined = [...restoredGifs];
      for (const lg of localGifs) {
        if (!combined.some(cg => cg.url.toLowerCase() === lg.url.toLowerCase())) {
          combined.push(lg);
        }
      }

      // Sort by addedAt descending
      combined.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
      const finalGifs = combined.slice(0, 100);

      fs.writeFileSync(gifsFilePath, JSON.stringify(finalGifs, null, 2));
      console.log(`✅ [gifManager] Successfully restored ${restoredGifs.length} GIFs from #${memoryChannel.name}! Total active: ${finalGifs.length}`);
    }
  } catch (err) {
    console.error('[gifManager] Error initializing memory channel:', err);
  }
}

function isGifUrl(url) {
  return (
    /https?:\/\/(www\.)?(tenor\.com\/view|giphy\.com\/gifs|giphy\.com\/media|klipy\.com\/gifs)\/[^\s]+/i.test(url) ||
    url.toLowerCase().split('?')[0].endsWith('.gif')
  );
}

function getGifs() {
  try {
    const data = fs.readFileSync(gifsFilePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading gifs.json:', err);
    return [];
  }
}

async function saveGif(url, username) {
  if (!isGifUrl(url)) return false;

  try {
    const gifs = getGifs();
    
    // Check if GIF already exists
    const exists = gifs.some(g => g.url.toLowerCase() === url.toLowerCase());
    if (exists) return false;

    // Try fetching page metadata for rich human-generated tags, fallback to slug
    let description = await fetchGifPageMetadata(url);
    if (!description) {
      description = getGifDescriptionFromSlug(url);
    }

    const newGif = {
      url,
      description,
      addedBy: username,
      addedAt: new Date().toISOString()
    };

    gifs.unshift(newGif); // Add new GIF to the start
    
    // Limit to top 100 GIFs
    const trimmedGifs = gifs.slice(0, 100);
    
    fs.writeFileSync(gifsFilePath, JSON.stringify(trimmedGifs, null, 2));
    console.log(`[GIF Saved] Added: "${description}" by ${username}`);

    // Persist to Discord memory channel
    if (memoryChannel) {
      try {
        const payload = `\`\`\`json\n${JSON.stringify(newGif, null, 2)}\n\`\`\`\n${newGif.url}`;
        await memoryChannel.send(payload);
      } catch (err) {
        console.warn('[gifManager] Failed to post saved GIF to memory channel:', err.message);
      }
    }

    return true;
  } catch (err) {
    console.error('Error saving GIF:', err);
    return false;
  }
}

module.exports = {
  init,
  isGifUrl,
  saveGif,
  getGifs
};

const fs = require('fs');
const path = require('path');

const gifsFilePath = path.join(__dirname, '../gifs.json');

// Initialize gifs.json if it doesn't exist
if (!fs.existsSync(gifsFilePath)) {
  fs.writeFileSync(gifsFilePath, JSON.stringify([], null, 2));
}

/**
 * Strips wrapping quotes, commas, brackets, markdown, and trailing punctuation.
 */
function cleanAndNormalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  // Strip leading punctuation/quotes/brackets
  url = url.replace(/^[<"'(]+/, '');
  // Strip trailing punctuation/quotes/brackets
  url = url.replace(/[>"'),;.`\]]+$/, '');
  url = url.trim();

  // Normalize specific GIF host URLs
  try {
    if (url.includes('klipy.com/gifs/')) {
      const match = url.match(/klipy\.com\/gifs\/([a-zA-Z0-9-]+)/i);
      if (match) {
        return `https://klipy.com/gifs/${match[1].toLowerCase()}`;
      }
    } else if (url.includes('tenor.com/view/')) {
      const match = url.match(/tenor\.com\/view\/([a-zA-Z0-9-]+?)(?:-gif)?(?:-\d+)?(?:\/|\?|$)/i);
      if (match) {
        const fullMatch = url.match(/(https:\/\/tenor\.com\/view\/[a-zA-Z0-9-]+)/i);
        return fullMatch ? fullMatch[1] : url.split('?')[0].replace(/\/+$/, '');
      }
    } else if (url.includes('giphy.com/gifs/')) {
      const match = url.match(/(https:\/\/giphy\.com\/gifs\/[a-zA-Z0-9-]+)/i);
      if (match) {
        return match[1];
      }
    } else {
      // General GIF - strip query and trailing slash
      const u = new URL(url);
      return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
    }
  } catch (e) {
    // If URL parsing fails, return stripped string
  }
  return url.replace(/\/+$/, '');
}

/**
 * Returns a canonical identifier key for deduplication.
 * E.g., "klipy:sus-suspicious-69", "tenor:15069425042867155745", "giphy:abc123"
 */
function getGifKey(rawUrl) {
  const url = cleanAndNormalizeUrl(rawUrl);
  if (!url) return '';

  try {
    if (url.includes('klipy.com/gifs/')) {
      const match = url.match(/klipy\.com\/gifs\/([a-zA-Z0-9-]+)/i);
      if (match) return `klipy:${match[1].toLowerCase()}`;
    }
    if (url.includes('tenor.com/view/')) {
      const idMatch = url.match(/(?:-|\/)(\d{15,22})(?:\/|\?|$)/) || url.match(/tenor\.com\/view\/([a-zA-Z0-9-]+)/i);
      if (idMatch) return `tenor:${idMatch[1].toLowerCase()}`;
    }
    if (url.includes('giphy.com/gifs/')) {
      const match = url.match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)(?:\/|\?|$)/i);
      if (match) return `giphy:${match[1].toLowerCase()}`;
    }
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname.toLowerCase().replace(/\/+$/, '')}`;
  } catch (e) {
    return url.toLowerCase();
  }
}

function getGifDescriptionFromSlug(url) {
  let slug = '';
  try {
    const clean = cleanAndNormalizeUrl(url);
    if (clean.includes('tenor.com/view/')) {
      const match = clean.match(/tenor\.com\/view\/([a-zA-Z0-9-]+?)(?:-gif)?(?:-\d+)?$/i);
      slug = match ? match[1] : '';
    } else if (clean.includes('klipy.com/gifs/')) {
      const match = clean.match(/klipy\.com\/gifs\/([a-zA-Z0-9-]+)/i);
      slug = match ? match[1] : '';
    } else if (clean.includes('giphy.com/gifs/')) {
      const match = clean.match(/giphy\.com\/gifs\/([a-zA-Z0-9-]+)/i);
      slug = match ? match[1] : '';
    } else {
      const pathname = new URL(clean).pathname;
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
    const clean = cleanAndNormalizeUrl(url);
    if (!clean.includes('tenor.com') && !clean.includes('giphy.com') && !clean.includes('klipy.com')) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

    const res = await fetch(clean, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const html = await res.text();

    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i) ||
                         html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i) ||
                         html.match(/<title>(.*?)<\/title>/i);

    if (ogTitleMatch && ogTitleMatch[1]) {
      let desc = ogTitleMatch[1].trim();
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
    // metadata fetch timeout or failure is normal, fall back to slug
  }
  return null;
}

let memoryChannel = null;

async function findMemoryChannel(client) {
  const channelId = (process.env.GIF_MEMORY_CHANNEL_ID || process.env.MEMORY_CHANNEL_ID || '').trim();
  if (channelId) {
    try {
      const ch = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
      if (ch && ch.isTextBased()) return ch;
      console.warn(`[gifManager] Channel with ID ${channelId} not found or is not a text channel.`);
    } catch (e) {
      console.warn('[gifManager] Failed to fetch channel by ID:', e.message);
    }
  }
  return null;
}

function getGifs() {
  try {
    const data = fs.readFileSync(gifsFilePath, 'utf8');
    const parsed = JSON.parse(data || '[]');
    // Clean and deduplicate in memory
    const seen = new Set();
    const unique = [];
    for (const g of parsed) {
      if (!g || !g.url) continue;
      const key = getGifKey(g.url);
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push({
          ...g,
          url: cleanAndNormalizeUrl(g.url)
        });
      }
    }
    return unique;
  } catch (err) {
    console.error('Error reading gifs.json:', err);
    return [];
  }
}

async function init(client) {
  try {
    memoryChannel = await findMemoryChannel(client);
    if (!memoryChannel) {
      console.log('[gifManager] No persistent memory channel configured. Using local cache only.');
      return;
    }

    console.log(`[gifManager] Connected to persistent memory channel #${memoryChannel.name} (ID: ${memoryChannel.id}).`);
    
    // Fetch historical messages from memory channel
    const fetched = await memoryChannel.messages.fetch({ limit: 100 }).catch(err => {
      console.warn('[gifManager] Failed to fetch memory channel messages:', err.message);
      return null;
    });

    // Only backup if fetched is valid AND truly empty (size === 0)
    if (fetched && fetched.size === 0) {
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

    if (!fetched) return;

    const restoredGifs = [];
    const messages = Array.from(fetched.values());

    for (const msg of messages) {
      const jsonMatch = msg.content.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed && parsed.url) {
            parsed.url = cleanAndNormalizeUrl(parsed.url);
            restoredGifs.push(parsed);
          }
        } catch (e) {
          // skip invalid json
        }
      }
    }

    // Merge with local gifs using canonical keys to prevent duplicates
    const localGifs = getGifs();
    const seenKeys = new Set();
    const combined = [];

    // Add restored from Discord first (they represent official channel state)
    for (const rg of restoredGifs) {
      const key = getGifKey(rg.url);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push(rg);
      }
    }

    // Add local cached gifs if not already restored
    for (const lg of localGifs) {
      const key = getGifKey(lg.url);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push(lg);
      }
    }

    // Sort by addedAt descending
    combined.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
    const finalGifs = combined.slice(0, 100);

    fs.writeFileSync(gifsFilePath, JSON.stringify(finalGifs, null, 2));
    console.log(`✅ [gifManager] Successfully synced ${finalGifs.length} GIFs (Restored from #${memoryChannel.name})!`);
  } catch (err) {
    console.error('[gifManager] Error initializing memory channel:', err);
  }
}

function isGifUrl(rawUrl) {
  const url = cleanAndNormalizeUrl(rawUrl);
  if (!url) return false;
  return (
    /https?:\/\/(www\.)?(tenor\.com\/view|giphy\.com\/gifs|giphy\.com\/media|klipy\.com\/gifs)\/[^\s]+/i.test(url) ||
    url.toLowerCase().split('?')[0].endsWith('.gif')
  );
}

// In-flight concurrency lock & recent save cache to prevent duplicate spam
const inFlightSaves = new Set();
const recentSavedMap = new Map(); // key -> timestamp

async function saveGif(rawUrl, username) {
  const url = cleanAndNormalizeUrl(rawUrl);
  if (!isGifUrl(url)) return false;

  const key = getGifKey(url);
  if (!key) return false;

  // Check 1: In-flight concurrency lock
  if (inFlightSaves.has(key)) {
    console.log(`[gifManager] GIF ${key} is already being processed, ignoring duplicate request.`);
    return false;
  }

  // Check 2: Recently saved within last 60 seconds
  const lastSaved = recentSavedMap.get(key);
  if (lastSaved && (Date.now() - lastSaved < 60000)) {
    console.log(`[gifManager] GIF ${key} was already saved moments ago, skipping duplicate.`);
    return false;
  }

  try {
    const gifs = getGifs();
    
    // Check 3: Canonical key deduplication
    const exists = gifs.some(g => getGifKey(g.url) === key);
    if (exists) {
      console.log(`[gifManager] GIF "${key}" already exists in storage, skipping.`);
      return false;
    }

    inFlightSaves.add(key);

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
    recentSavedMap.set(key, Date.now());
    console.log(`[GIF Saved] Added: "${description}" by ${username} (Key: ${key})`);

    // Persist to Discord memory channel with duplicate check
    if (memoryChannel) {
      try {
        // Fetch recent messages to verify this GIF wasn't already posted by another instance
        const recent = await memoryChannel.messages.fetch({ limit: 10 }).catch(() => null);
        const slug = key.split(':')[1];
        const alreadyPosted = recent && Array.from(recent.values()).some(m => {
          return m.content.includes(url) || (slug && m.content.includes(slug));
        });

        if (!alreadyPosted) {
          const payload = `\`\`\`json\n${JSON.stringify(newGif, null, 2)}\n\`\`\`\n${newGif.url}`;
          await memoryChannel.send(payload);
        } else {
          console.log(`[gifManager] GIF ${key} is already present in recent #${memoryChannel.name} messages, skipping Discord send.`);
        }
      } catch (err) {
        console.warn('[gifManager] Failed to post saved GIF to memory channel:', err.message);
      }
    }

    return true;
  } catch (err) {
    console.error('Error saving GIF:', err);
    return false;
  } finally {
    inFlightSaves.delete(key);
  }
}

module.exports = {
  init,
  cleanAndNormalizeUrl,
  getGifKey,
  isGifUrl,
  saveGif,
  getGifs
};

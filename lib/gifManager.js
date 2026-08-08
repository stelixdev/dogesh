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
    
    // Limit to top 50 GIFs
    const trimmedGifs = gifs.slice(0, 50);
    
    fs.writeFileSync(gifsFilePath, JSON.stringify(trimmedGifs, null, 2));
    console.log(`[GIF Saved] Added: "${description}" by ${username}`);
    return true;
  } catch (err) {
    console.error('Error saving GIF:', err);
    return false;
  }
}

module.exports = {
  isGifUrl,
  saveGif,
  getGifs
};

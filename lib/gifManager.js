const fs = require('fs');
const path = require('path');

const gifsFilePath = path.join(__dirname, '../gifs.json');

// Initialize gifs.json if it doesn't exist
if (!fs.existsSync(gifsFilePath)) {
  fs.writeFileSync(gifsFilePath, JSON.stringify([], null, 2));
}

function getGifDescription(url) {
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

function saveGif(url, username) {
  if (!isGifUrl(url)) return false;

  try {
    const gifs = getGifs();
    
    // Check if GIF already exists
    const exists = gifs.some(g => g.url.toLowerCase() === url.toLowerCase());
    if (exists) return false;

    const description = getGifDescription(url);
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

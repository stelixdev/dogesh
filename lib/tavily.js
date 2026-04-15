require('dotenv').config();

async function tavilySearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_KEY,
      query,
      max_results: 5,
      search_depth: 'basic',
    }),
  });
  const data = await res.json();
  return (data.results || [])
    .map(r => `- ${r.title}: ${r.content}`)
    .join('\n');
}

module.exports = { tavilySearch };

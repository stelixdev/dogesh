require('dotenv').config();

async function tavilySearch(query, mode = 'basic') {
  const includeAnswer = mode === 'advanced';
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_KEY,
      query,
      max_results: 5,
      search_depth: mode,
      include_answer: includeAnswer,
    }),
  });
  const data = await res.json();
  const rawResults = (data.results || [])
    .map(r => `- ${r.title}: ${r.content}`)
    .join('\n');
  const nativeAnswer = data.answer ? `Tavily AI Answer Summary: ${data.answer}\n\n` : '';
  return `${nativeAnswer}Web Search Results:\n${rawResults}`;
}

module.exports = { tavilySearch };

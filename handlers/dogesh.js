const groq = require('../lib/groqClient');
const { tavilySearch } = require('../lib/tavily');
const { addEntry, getRecent } = require('../lib/convoMemory');
async function handleDogesh(message, query) {
  // Always use the two-stage Groq flow; remove special-case math handling.
  let prompt = '';

  // Two-stage flow: ask Groq if the question requires realtime data.
  const REALTIME_TOKEN = '<<<REALTIME_REQUIRED>>>';
  const recent = await getRecent(message.author?.id || 'global');
  const recentText = recent.map(r => `${r.role === 'user' ? 'User' : 'Assistant'}: ${r.content}`).join('\n');

  const checkPrompt = `You are Dogesh — a friendly Discord helper which helps the user in doing calculations checking some facts or getting information as a helper in in-friends discussion. First, your job is only to DECIDE whether this question REQUIRES real-time/up-to-date information (examples: current prices, live sports scores, ongoing events, live status, "as of now" facts).

Rules (decision-only):
- If the question REQUIRES realtime/up-to-date data, do NOT answer the user's question. Reply ONLY with the exact token: ${REALTIME_TOKEN}
- If the question does NOT require realtime data, reply directly as Dogesh following these length rules:
  * Simple casual questions or quick facts → 1-2 short lines (punchy, friendly).
  * Requests for explanations, steps, comparisons, or multi-part questions → detailed answer (3-6 lines).
 - Tone: natural Hinglish with English technical terms; keep humor subtle and conversational (avoid being such friendly to be cringy). Use emojis sparingly.
 - Never invent facts; if unsure, say you are not sure.
 - If the user tell you to do some random picks/choices do it random with no bias and no overthinking, just pick one option randomly and no explanation is needed in that case, just give the answer.
 - If the question should be answered in some serious tone, answer in that tone, and proivde response with logical reasoning and no jokes, but if the question can be answered in a light-hearted tone, then answer in a light-hearted tone with subtle humor if appropriate.

Now, based on the above rules, does the user's question require realtime/up-to-date information? Answer only with either ${REALTIME_TOKEN} or the direct answer to the user's question.

Recent conversation (last 20 entries):
${recentText}

User question: "${query}"`;

  const checking = await message.reply('🔎 Checking if realtime info is required...');
  const systemMsg = recentText ? { role: 'system', content: `Recent conversation (last ${recent.length}):\n${recentText}` } : null;
  const messagesForCheck = systemMsg ? [systemMsg, { role: 'user', content: checkPrompt }] : [{ role: 'user', content: checkPrompt }];
  const checkRes = await groq.chat.completions.create({ model: 'openai/gpt-oss-120b', messages: messagesForCheck });
  const checkAnswer = (checkRes.choices[0].message.content || '').trim();
  await checking.delete().catch(() => {});

  // If Groq returned the realtime token, fetch Tavily and ask Groq again with web evidence.
  if (checkAnswer.includes(REALTIME_TOKEN)) {
    const thinkingMsg = await message.reply('🔍 Realtime required — searching Tavily...');
    const results = await tavilySearch(query);
    const followupPrompt = `You are Dogesh — the Discord AFK helper. The user asked: "${query}"

  Web search results (Tavily):
  ${results}

  Answering rules:
  - Start with a concise, friendly Hinglish line (1 short sentence). Keep any joke subtle and natural. And only joke if not being cringe and if the answer can be replied with a light-hearted tone.
  - If a single clear source in the web results answers the question, give a concise 1-2 line answer and cite that source briefly.
  - If results are mixed, incomplete, or conflicting, give a clear 3-5 line explanation, mention the differences, and conclude with the most likely answer.
  - Always include a short citation phrase (e.g., "From Tavily: - Title: ...") pointing to which result you used.
  - Tone: casual Hinglish with English terms; subtle, low-cringe humor only when appropriate.
  - If web data is insufficient, say so clearly and offer to search again.
  `;
    await thinkingMsg.delete().catch(() => {});

    const messagesForFollowup = systemMsg ? [systemMsg, { role: 'user', content: followupPrompt }] : [{ role: 'user', content: followupPrompt }];
    const finalRes = await groq.chat.completions.create({ model: 'openai/gpt-oss-120b', messages: messagesForFollowup });
    const finalAnswer = finalRes.choices[0].message.content;
    await message.reply(finalAnswer);
    // record convo: user's query and assistant's reply
    try { await addEntry(message.author?.id || 'global', 'user', query); } catch (e) {}
    try { await addEntry(message.author?.id || 'global', 'assistant', finalAnswer); } catch (e) {}
    return;
  }

  // Otherwise, Groq answered directly (non-realtime)
  await message.reply(checkAnswer);
  // record convo: user's query and assistant's reply
  try { await addEntry(message.author?.id || 'global', 'user', query); } catch (e) {}
  try { await addEntry(message.author?.id || 'global', 'assistant', checkAnswer); } catch (e) {}
}

module.exports = { handleDogesh };

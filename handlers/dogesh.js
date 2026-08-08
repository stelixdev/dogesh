const groq = require('../lib/groqClient');
const gemini = require('../lib/geminiClient');
const { tavilySearch } = require('../lib/tavily');
const { addEntry, getRecent } = require('../lib/convoMemory');
const tracker = require('../lib/tracker');
const { withTimeout } = require('../lib/utils');

const MODEL_NAME = 'llama-3.3-70b-versatile';

function postProcessResponse(text, guild) {
  if (!text) return text;
  
  // 1. Fix any @ID that the model output (e.g. @1131199268498178190 -> <@1131199268498178190>)
  text = text.replace(/(?<!<)@(\d{17,20})/g, '<@$1>');

  if (!guild) return text;

  // 2. Resolve any @username or @displayName mentions to <@ID>
  const members = Array.from(guild.members.cache.values());
  
  // Create a list of replacement targets: { name: string, id: string }
  const targets = [];
  for (const m of members) {
    if (m.displayName) {
      targets.push({ name: m.displayName, id: m.user.id });
    }
    if (m.user.username) {
      targets.push({ name: m.user.username, id: m.user.id });
    }
  }

  // Remove duplicates and sort by length descending to match longest names first (handles spaces cleanly)
  const seenNames = new Set();
  const sortedTargets = targets
    .filter(t => {
      const lowerName = t.name.toLowerCase();
      if (seenNames.has(lowerName)) return false;
      seenNames.add(lowerName);
      return true;
    })
    .sort((a, b) => b.name.length - a.name.length);

  // Replace each name
  for (const target of sortedTargets) {
    const escapedName = target.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // We match @Name case-insensitive (lookbehind ensures we don't match <@ID)
    const regex = new RegExp(`(?<!<)@${escapedName}\\b`, 'gi');
    text = text.replace(regex, `<@${target.id}>`);
    
    // Check if name ends with trailing punctuation (like dot, dash, underscore)
    const punctuationRegex = new RegExp(`(?<!<)@${escapedName}([._-]+)?\\b`, 'gi');
    text = text.replace(punctuationRegex, (match, trailing) => {
      return `<@${target.id}>${trailing || ''}`;
    });
  }

  return text;
}

async function handleDogesh(message, query, repliedToMessage, originalUserMessage, channelContext) {
  const startTime = Date.now();
  tracker.lastExecution.tavilyUsed = 'no';
  console.log(`💬 Processing message from @${message.author.username}: "${query}"`);
  // Check if it's a reminder command
  const reminderMatch = query.match(/^=remind(?:er)?(?:\s+(.*))?$/i);
  if (reminderMatch) {
    const reminderText = reminderMatch[1] ? reminderMatch[1].trim() : '';
    if (!reminderText) {
      return message.reply('Bhai, kya yaad dilana hai aur kab? Thoda details do! ⏰\nExample: `@Dogesh Bhai =reminder 10 minutes mein paani peena hai`');
    }

    const thinkingMsg = await message.reply('⏰ Parsing your reminder...');
    try {
      const now = new Date();
      const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const currentDateIST = {
        year: istDate.getUTCFullYear(),
        month: istDate.getUTCMonth() + 1,
        day: istDate.getUTCDate(),
        hour: istDate.getUTCHours(),
        minute: istDate.getUTCMinutes(),
        second: istDate.getUTCSeconds(),
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][istDate.getUTCDay()]
      };

      const optimizeRes = await groq.chat.completions.create({
        model: MODEL_NAME,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert reminder assistant. Your task is to analyze the user's request (in English, Hindi, or Hinglish) and return a JSON object with the target date/time details when they want to be reminded. All user times are relative to India Standard Time (IST, UTC+5:30).

Current India Standard Time (IST):
- Year: ${currentDateIST.year}
- Month: ${currentDateIST.month}
- Day: ${currentDateIST.day} (${currentDateIST.dayOfWeek})
- Hour: ${currentDateIST.hour} (24-hour format)
- Minute: ${currentDateIST.minute}
- Second: ${currentDateIST.second}

Rules:
- Identify the target date/time when the reminder should trigger, and return its individual year, month, day, hour, minute, second in India Standard Time (IST).
- If the requested time has already passed today (e.g. they ask for "6:00 AM" or "6 baje" and it is currently 10:00 AM IST today), assume they mean the next occurrence (which is tomorrow at 6:00 AM), so increment the day accordingly.
- "targetTimeFormatted": A friendly description of when it will trigger (e.g., "kal subhe 6:00 baje", "10 minutes mein").
- "reminder": A clean description of what to remind the user (e.g., "notes likhne hai"). Keep this in the user's Hinglish/English style.
- "error": Set to a helpful Hinglish error string if the request is invalid, in the past (where no next occurrence makes sense), or not specified. Set to null on success.

Example:
User request: "kal subhe 6 baje yaad dila diyo notes likhne hai"
Assuming Current IST is: Friday, August 1, 2026, 7:30 PM.
Target IST: Saturday, August 2, 2026, 6:00 AM.
Response:
{
  "targetYear": 2026,
  "targetMonth": 8,
  "targetDay": 2,
  "targetHour": 6,
  "targetMinute": 0,
  "targetSecond": 0,
  "targetTimeFormatted": "kal subhe 6:00 baje (Aug 2)",
  "reminder": "notes likhne hai",
  "error": null
}`
          },
          {
            role: 'user',
            content: `Request: "${reminderText}"`
          }
        ]
      });

      const parsedRes = JSON.parse(optimizeRes.choices[0].message.content || '{}');
      await thinkingMsg.delete().catch(() => {});

      if (parsedRes.error) {
        return message.reply(`❌ ${parsedRes.error}`);
      }

      if (!parsedRes.targetYear || !parsedRes.targetMonth || !parsedRes.targetDay) {
        return message.reply('❌ Bhai, time samajh nahi aaya. Please try again with clear timing (e.g., "in 5 minutes", "kal subhe 10 baje").');
      }

      // Construct target date timezone-independent for India (UTC+5:30)
      const isoString = `${parsedRes.targetYear}-${String(parsedRes.targetMonth).padStart(2, '0')}-${String(parsedRes.targetDay).padStart(2, '0')}T${String(parsedRes.targetHour || 0).padStart(2, '0')}:${String(parsedRes.targetMinute || 0).padStart(2, '0')}:${String(parsedRes.targetSecond || 0).padStart(2, '0')}+05:30`;
      const targetDate = new Date(isoString);
      const delayMs = targetDate.getTime() - Date.now();

      if (isNaN(delayMs) || delayMs <= 0) {
        return message.reply('❌ Bhai, set kiya hua time past mein hai ya invalid hai. Ek baar check kar lo.');
      }

      // Limit reminder to 20 days max to prevent large timeout issues
      const maxDelay = 20 * 24 * 60 * 60 * 1000;
      if (delayMs > maxDelay) {
        return message.reply('❌ Bhai, max 20 days tak ka hi reminder set kar sakta hoon main! 😅');
      }

      const reminderScheduler = require('../lib/reminderScheduler');
      await reminderScheduler.addReminder(message.client, {
        userId: message.author.id,
        channelId: message.channel.id,
        reminder: parsedRes.reminder,
        delayMs: delayMs,
        targetTimeFormatted: parsedRes.targetTimeFormatted
      });

      const options = {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      const exactTimeStr = targetDate.toLocaleString('en-IN', options);

      return message.reply(`⏰ **Reminder Set!** ${parsedRes.targetTimeFormatted} par aapko yaad dila dunga: **"${parsedRes.reminder}"**.\n*(Exact Time: ${exactTimeStr} IST)*`);

    } catch (err) {
      console.error('Error parsing reminder:', err);
      await thinkingMsg.delete().catch(() => {});
      return message.reply('❌ Sorry bhai, reminder set karne mein dikkat aayi. Fir se try karo.');
    }
  }

  // Always use the two-stage Groq flow; remove special-case math handling.
  let prompt = '';

  // Extract Tenor GIFs
  const tenorUrls = query.match(/https:\/\/tenor\.com\/view\/[^\s]+/gi) || [];
  let gifContextBlock = '';
  if (tenorUrls.length > 0) {
    gifContextBlock = `[User Sent GIFs]:\n`;
    for (const url of tenorUrls) {
      const match = url.match(/https:\/\/tenor\.com\/view\/([a-zA-Z0-9-]+?)(?:-gif)?(?:-\d+)?$/i);
      const slug = match ? match[1] : '';
      const description = slug ? slug.replace(/-/g, ' ') : 'unknown';
      gifContextBlock += `- URL: ${url}\n  Description: ${description}\n`;
    }
    gifContextBlock += '\n';
  }

  let replyContext = '';
  if (repliedToMessage) {
    replyContext = `[Context from Reply Chain]:\n`;
    if (originalUserMessage) {
      replyContext += `Original User Message (which Dogesh was replying to): "${originalUserMessage.content}"\n`;
    }
    replyContext += `Dogesh's Response (which user is replying to): "${repliedToMessage.content}"\n\n`;
  }

  let infoBlock = `[User Details]:
- Username: ${message.author.username}
- Display Name: ${message.member?.nickname || message.author.displayName || message.author.username}
- Roles: ${message.member?.roles.cache.map(r => r.name).filter(name => name !== '@everyone').join(', ') || 'None'}

[Server Details]:
- Server Name: ${message.guild?.name || 'DM (Direct Message)'}
- Channel Name: ${message.channel.name || 'DM'}
- Total Members: ${message.guild?.memberCount || 1}
`;

  if (message.guild) {
    let membersArray = Array.from(message.guild.members.cache.values());
    
    // If the cache is not fully loaded, try to fetch to get the complete list
    if (membersArray.length < message.guild.memberCount) {
      try {
        const fetchedMembers = await withTimeout(
          message.guild.members.fetch(),
          5000,
          'Guild members fetch timed out'
        );
        membersArray = Array.from(fetchedMembers.values());
      } catch (err) {
        console.warn('⚠️ Error fetching server members, using cache fallback:', err.message || err);
      }
    }

    if (membersArray.length > 0) {
      const maxMembersToList = 35;
      const memberLines = membersArray.slice(0, maxMembersToList).map(m => {
        const roles = m.roles.cache.map(r => r.name).filter(n => n !== '@everyone').join(', ') || 'None';
        return `- ${m.displayName} (@${m.user.username}) [ID: ${m.user.id}]${m.user.bot ? ' [BOT]' : ''} (Roles: ${roles})`;
      });

      infoBlock += `\n[Server Members]:\n${memberLines.join('\n')}`;
      if (membersArray.length > maxMembersToList) {
        infoBlock += `\n- ... and ${membersArray.length - maxMembersToList} more members.`;
      }
      infoBlock += '\n';
    }
  }

  let contextBlock = infoBlock + '\n';
  if (gifContextBlock) {
    contextBlock += gifContextBlock;
  }
  if (replyContext) {
    contextBlock += replyContext;
  }
  if (channelContext) {
    contextBlock += `[Recent Channel Messages Context]:\n${channelContext}\n\n`;
  }

  // Two-stage flow: ask Groq if the question requires realtime data.
  const REALTIME_TOKEN = '<<<REALTIME_REQUIRED>>>';
  const recent = await getRecent(message.channel.id);
  const currentDate = new Date().toDateString();

  const checkPromptSystem = `You are a search decision assistant. Your task is to analyze the user's message and decide whether answering it REQUIRES fetching real-time/live web information (examples: live sports scores, current stock/crypto prices, today's weather, flight status, live server status, recent news from the last few days, "as of today/now" statistics).

Current Calendar Date: ${currentDate}

CRITICAL RULES:
1. Do NOT require search for general suggestions, brainstorming, ideas, or tips (e.g. "party ideas", "gift for sister", "recipe for pizza", "fun things to do", "lets do party", "party plans bta"). These should be answered using static knowledge!
2. Do NOT require search for casual chat, greetings, banter, insults, or roleplay (e.g. "hello", "kaisa hai", "lets do party", "laat maar", "tu nalla hai").
3. Do NOT require search for coding help, math, general history, general science, or general knowledge (e.g. "how to write quicksort", "capital of France", "who wrote Hamlet").
4. ONLY return "${REALTIME_TOKEN}" if the question cannot be answered truthfully without checking the live web right now.
5. Otherwise, return "<<<NO_REALTIME>>>".
6. Output ONLY "${REALTIME_TOKEN}" or "<<<NO_REALTIME>>>". Do NOT include any other text, prefix, or explanation.`;

  const userContent = contextBlock
    ? `${contextBlock}User question: "${query}"`
    : `User question: "${query}"`;

  const messagesForCheck = [
    { role: 'system', content: checkPromptSystem }
  ];

  // Add history but WITHOUT names or heavy blocks, just raw contents for minimal token load
  for (const entry of recent) {
    messagesForCheck.push({
      role: entry.role,
      content: entry.content
    });
  }

  // Add current query (WITHOUT the heavy server members / context block)
  messagesForCheck.push({
    role: 'user',
    content: query
  });

  // Start typing indicator immediately
  message.channel.sendTyping().catch(() => {});

  let checkAnswer = '';
  try {
    const checkRes = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: messagesForCheck,
      max_tokens: 10
    }, {
      timeout: 10000
    });
    checkAnswer = (checkRes.choices[0].message.content || '').trim();
  } catch (err) {
    console.error('Error during check stage:', err);
    checkAnswer = '<<<NO_REALTIME>>>';
  }

  const directSystemPrompt = `You are Dogesh — a friendly Discord helper which helps the user in doing calculations checking some facts or getting information as a helper in in-friends discussion.

Answering rules:
- Simple casual questions or quick facts → 1-2 short lines (punchy, friendly).
- Requests for explanations, steps, comparisons, or multi-part questions → detailed answer (3-6 lines).
- Tone: natural Hinglish with English technical terms; keep humor subtle and conversational (avoid being too friendly to be cringy). Use emojis sparingly (e.g. 😂, 💀, 😭, 👍, capped at 1-2).
- Never invent facts; if unsure, say you are not sure.
- If asked to do random picks/choices, do it randomly with no bias and no overthinking. Just pick one option randomly and give the answer directly with no explanation.
- If tagging/mentioning a user, you MUST find their ID from the [Server Members] list and output it exactly as: <@USER_ID> (e.g. <@847016062176460810>). Do NOT output <@username>.
- **Conversational Logic & Command Translation**: Speak like a natural human friend on Discord. Do NOT repeat the user's command/request phrasing back to them. If a user tells you to tell or ask another user to do something (e.g. "X ko Y bolo", "X ko bol Y", "tell X to do Y", "X ko Y bol de"), you must translate that into a direct instruction/question addressed to X in the second person.
  * Correct example: If user says "Priyanshu ko padhne ke liye bolo", you reply: "@Priyanshu Raj bhai padhne baith jaa re 💀" or "@Priyanshu Raj padh le bhai".
  * Incorrect example: "@Priyanshu Raj padhne ke liye bolo". (Never say this).
- **Address Users Correctly in Replies**: If you are replying to a message from a user (like when they tagged you or replied to your message), speak to them directly in the second person ("tu", "tum", "bhai"). Do NOT speak about them in the third person. For example, if Priyanshu replies to you, do NOT say "Priyanshu ko reminder mil gaya hoga", instead say: "Haan bhai, pee liya na paani? 👍" or "Ok ok, pee le ab 👍".
- **Hinglish Slang & Banter Understanding**: Understand casual Indian Hinglish slang naturally. Never interpret "ek number" (or "1 number") literally as a digits query or phone number; it means "awesome", "excellent", or "doing great" (e.g. "ek number bhai tu apna bta" means "I am doing great bro, how about you?"). Never interpret "apna bta" or "tu apna bta" literally; it means "how about you?" or "what about you?". Reply to banters like "nalla", "faltu", "cringe" with casual wit, not explanations. Do NOT share your bot ID or technical details unless explicitly asked.
- If user sent a GIF (listed under [User Sent GIFs]), make sure to include/append the user's GIF URL in your reply to keep the meme.`;

  // If Groq returned the realtime token, fetch Tavily and ask Groq again with web evidence.
  if (checkAnswer.includes(REALTIME_TOKEN)) {
    // Show a single search update message to inform the user since search + generation can take 2-3s
    const searchingMsg = await message.reply('🔍 Searching web & thinking...');
    
    let optimizedQuery = query;
    let searchMode = 'basic';
    try {
      const messagesForOptimize = [
        {
          role: 'system',
          content: `You are an expert search query optimizer. The user is asking a question in a Discord server, possibly in a casual Hinglish style.
Analyze the conversation history, context, and user request to rewrite it into a clean, concise, keyword-rich English search query.

Rules:
- Output a JSON object containing exactly two keys: "query" and "mode".
- "query": The optimized search query rewritten in clean, concise, keyword-rich English. If the user's query contains a URL (like a Tenor GIF URL), ignore the URL for the search query and optimize only the text part. If the user's request is short/conversational (like "haa kar", "yes", "do it", "what about him?") or references a subject from the history or context, resolve the references using the context to form a complete English search query. Include calendar date context if the query is time-sensitive (Current Date: ${currentDate}).
- "mode": Decide whether the search needs "basic" or "advanced" depth. Use "basic" for simple, direct, or straightforward questions (like stats, scores, prices, weather, basic facts). Use "advanced" ONLY for complex, multi-part, technical, or research-heavy questions that require deep analysis.

Example Output:
{
  "query": "Sergey Brin net worth 2026",
  "mode": "basic"
}`
        }
      ];

      // Add recent history for context
      for (const entry of recent) {
        const msg = {
          role: entry.role,
          content: (entry.role === 'user' && entry.name) ? `[${entry.name}]: ${entry.content}` : entry.content
        };
        if (entry.name) {
          msg.name = entry.name;
        }
        messagesForOptimize.push(msg);
      }

      // Add user request with context block
      const userReqContent = contextBlock
        ? `${contextBlock}User request: "${query}"\n\nOptimize this request for search based on the context above.`
        : `User request: "${query}"\n\nOptimize this request for search.`;

      messagesForOptimize.push({
        role: 'user',
        content: userReqContent
      });

      const optimizeRes = await groq.chat.completions.create({
        model: MODEL_NAME,
        response_format: { type: 'json_object' },
        messages: messagesForOptimize
      });
      const parsedRes = JSON.parse(optimizeRes.choices[0].message.content || '{}');
      optimizedQuery = (parsedRes.query || query).trim().replace(/^"|"$/g, '');
      searchMode = parsedRes.mode === 'advanced' ? 'advanced' : 'basic';
      console.log(`🔍 Search Optimization: Original: "${query}" -> Optimized: "${optimizedQuery}" (Mode: ${searchMode})`);
    } catch (err) {
      console.error('Failed to optimize query, falling back to original basic search:', err);
    }

    tracker.lastExecution.tavilyUsed = `yes (${searchMode})`;
    const results = await withTimeout(
      tavilySearch(optimizedQuery, searchMode),
      10000,
      'Tavily search timed out'
    );

    const followupSystemPrompt = `You are Dogesh — the Discord AFK helper. Use the provided web search results to answer the user's question.

Current Calendar Date: ${currentDate}

Web search results (Tavily):
${results}

Answering rules:
- Start with a concise, friendly Hinglish line (1 short sentence). Keep any joke subtle and natural. Only joke if not being cringe.
- If a single clear source in the web results answers the question, give a concise 1-2 line answer and cite that source briefly.
- If results are mixed, incomplete, or conflicting, give a clear 3-5 line explanation, mention the differences, and conclude with the most likely answer.
- Always include a short citation phrase (e.g., "From Tavily: - Title: ...") pointing to which result you used.
- Tone: casual Hinglish with English terms; subtle, low-cringe humor only when appropriate. Emojis should be used sparingly (e.g. 😂, 💀, 😭, 👍, capped at 1-2).
- If web data is insufficient, say so clearly and offer to search again.
- If tagging/mentioning a user, you MUST find their ID from the [Server Members] list and output it exactly as: <@USER_ID> (e.g. <@847016062176460810>). Do NOT output <@username>.
- **Conversational Logic & Command Translation**: Speak like a natural human friend on Discord. Do NOT repeat the user's command/request phrasing back to them. If a user tells you to tell or ask another user to do something (e.g. "X ko Y bolo", "X ko bol Y", "tell X to do Y", "X ko Y bol de"), you must translate that into a direct instruction/question addressed to X in the second person.
  * Correct example: If user says "Priyanshu ko padhne ke liye bolo", you reply: "@Priyanshu Raj bhai padhne baith jaa re 💀" or "@Priyanshu Raj padh le bhai".
  * Incorrect example: "@Priyanshu Raj padhne ke liye bolo". (Never say this).
- **Address Users Correctly in Replies**: If you are replying to a message from a user (like when they tagged you or replied to your message), speak to them directly in the second person ("tu", "tum", "bhai"). Do NOT speak about them in the third person. For example, if Priyanshu replies to you, do NOT say "Priyanshu ko reminder mil gaya hoga", instead say: "Haan bhai, pee liya na paani? 👍" or "Ok ok, pee le ab 👍".
- **Hinglish Slang & Banter Understanding**: Understand casual Indian Hinglish slang naturally. Never interpret "ek number" (or "1 number") literally as a digits query or phone number; it means "awesome", "excellent", or "doing great" (e.g. "ek number bhai tu apna bta" means "I am doing great bro, how about you?"). Never interpret "apna bta" or "tu apna bta" literally; it means "how about you?" or "what about you?". Reply to banters like "nalla", "faltu", "cringe" with casual wit, not explanations. Do NOT share your bot ID or technical details unless explicitly asked.
- If user sent a GIF (listed under [User Sent GIFs]), make sure to include/append the user's GIF URL in your reply to keep the meme.`;

    const messagesForFollowup = [
      { role: 'system', content: followupSystemPrompt }
    ];

    for (const entry of recent) {
      const msg = {
        role: entry.role,
        content: (entry.role === 'user' && entry.name) ? `[${entry.name}]: ${entry.content}` : entry.content
      };
      if (entry.name) {
        msg.name = entry.name;
      }
      messagesForFollowup.push(msg);
    }

    const followupUserContent = contextBlock
      ? `${contextBlock}User question: "${query}"`
      : `User question: "${query}"`;

    messagesForFollowup.push({
      role: 'user',
      content: followupUserContent
    });

    let finalAnswer = '';

    if (gemini.isConfigured) {
      try {
        finalAnswer = await gemini.geminiChatCompletion(followupSystemPrompt, messagesForFollowup.slice(1));
      } catch (err) {
        console.warn('⚠️ Gemini search response generation failed, falling back to Groq:', err.message || err);
      }
    }

    if (!finalAnswer) {
      const finalRes = await groq.chat.completions.create({ model: MODEL_NAME, messages: messagesForFollowup }, { timeout: 15000 });
      finalAnswer = finalRes.choices[0].message.content;
      tracker.lastExecution.modelUsed = MODEL_NAME;
      tracker.lastExecution.apiKeyUsed = 'Groq Fallback';
    }

    await searchingMsg.delete().catch(() => {});
    const processedAnswer = postProcessResponse(finalAnswer, message.guild);
    await message.reply(processedAnswer);

    // Record tracker details
    tracker.lastExecution.timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST';
    tracker.lastExecution.user = `${message.author.username} (ID: ${message.author.id})`;
    tracker.lastExecution.query = query;
    tracker.lastExecution.latencyMs = Date.now() - startTime;

    console.log(`✅ Sent reply in ${tracker.lastExecution.latencyMs}ms. Model: ${tracker.lastExecution.modelUsed}, API: ${tracker.lastExecution.apiKeyUsed}, Tavily: ${tracker.lastExecution.tavilyUsed}`);

    // record convo
    try { await addEntry(message.channel.id, 'user', query, message.author.username); } catch (e) {}
    try { await addEntry(message.channel.id, 'assistant', processedAnswer); } catch (e) {}
    return;

  } else {
    // Stage 2: Direct answering (non-realtime)
    const messagesForDirect = [
      { role: 'system', content: directSystemPrompt }
    ];

    for (const entry of recent) {
      const msg = {
        role: entry.role,
        content: (entry.role === 'user' && entry.name) ? `[${entry.name}]: ${entry.content}` : entry.content
      };
      if (entry.name) {
        msg.name = entry.name;
      }
      messagesForDirect.push(msg);
    }

    const directUserContent = contextBlock
      ? `${contextBlock}User question: "${query}"`
      : `User question: "${query}"`;

    messagesForDirect.push({
      role: 'user',
      content: directUserContent
    });

    let finalAnswer = '';

    if (gemini.isConfigured) {
      try {
        finalAnswer = await gemini.geminiChatCompletion(directSystemPrompt, messagesForDirect.slice(1));
      } catch (err) {
        console.warn('⚠️ Gemini direct response generation failed, falling back to Groq:', err.message || err);
      }
    }

    if (!finalAnswer) {
      const finalRes = await groq.chat.completions.create({ model: MODEL_NAME, messages: messagesForDirect }, { timeout: 15000 });
      finalAnswer = finalRes.choices[0].message.content;
      tracker.lastExecution.modelUsed = MODEL_NAME;
      tracker.lastExecution.apiKeyUsed = 'Groq Fallback';
    }

    const processedAnswer = postProcessResponse(finalAnswer, message.guild);
    await message.reply(processedAnswer);

    // Record tracker details
    tracker.lastExecution.timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST';
    tracker.lastExecution.user = `${message.author.username} (ID: ${message.author.id})`;
    tracker.lastExecution.query = query;
    tracker.lastExecution.latencyMs = Date.now() - startTime;

    console.log(`✅ Sent reply in ${tracker.lastExecution.latencyMs}ms. Model: ${tracker.lastExecution.modelUsed}, API: ${tracker.lastExecution.apiKeyUsed}, Tavily: ${tracker.lastExecution.tavilyUsed}`);

    // record convo
    try { await addEntry(message.channel.id, 'user', query, message.author.username); } catch (e) {}
    try { await addEntry(message.channel.id, 'assistant', processedAnswer); } catch (e) {}
  }
}

module.exports = { handleDogesh };

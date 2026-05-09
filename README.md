# AFK-Bot-AI

Lightweight Discord AFK bot with AI-powered replies and simple integrations.

Features
- Context-aware AFK responses using conversation memory in `lib/`.
- Integrations with Groq and Tavily for AI-powered content.
- Extensible command handlers in the `handlers/` folder.

Quick start
1. Copy `.env.example` to a local `.env` and fill in real values.
2. Install dependencies:

```bash
pnpm install
```

3. Run the bot:

```bash
node index.js
```

Environment
Create a local `.env` (do not commit) with the following variables (see `.env.example`):

- `BOT_TOKEN` — your Discord bot token
- `VC_CHANNEL_ID` — voice channel ID (optional)
- `GUILD_ID` — server (guild) ID
- `GROQ_KEY` — Groq API key
- `TAVILY_KEY` — Tavily API key
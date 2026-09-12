const configManager = require('./configManager');

const DASHBOARD_PASSWORD = (process.env.DASHBOARD_PASS || 'dogesh123').trim();

function getDashboardHtml(client) {
  const statusMap = ['READY', 'CONNECTING', 'RECONNECTING', 'IDLE', 'NEARLY', 'DISCONNECTED', 'WAITING_FOR_GUILDS', 'IDENTIFYING', 'RESUMING'];
  const wsStatus = statusMap[client.ws.status] || client.ws.status || 'ONLINE';
  const botTag = client.user ? client.user.tag : 'Dogesh#0000';
  const ping = client.ws.ping >= 0 ? `${client.ws.ping}ms` : 'Connecting...';
  const uptimeHours = (process.uptime() / 3600).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dogesh Bhai - Live Control Dashboard</title>
  <link rel="icon" href="https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f436.png">
  <style>
    :root {
      --bg-primary: #1e1f22;
      --bg-secondary: #2b2d31;
      --bg-tertiary: #313338;
      --text-normal: #dbdee1;
      --text-muted: #949ba4;
      --text-header: #f2f3f5;
      --brand: #5865f2;
      --brand-hover: #4752c4;
      --success: #23a55a;
      --danger: #f23f43;
      --warning: #f0b232;
      --border: #3f4147;
      --radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-normal);
      line-height: 1.5;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--bg-secondary);
      border-radius: var(--radius);
      margin-bottom: 20px;
      border: 1px solid var(--border);
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-brand h1 {
      font-size: 1.3rem;
      color: var(--text-header);
    }
    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: var(--success);
      background: rgba(35, 165, 90, 0.15);
      padding: 4px 10px;
      border-radius: 20px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 8px var(--success);
    }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: var(--bg-secondary);
      padding: 12px 16px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
    }
    .stat-card .label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
    }
    .stat-card .value {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-header);
      margin-top: 4px;
    }
    .card {
      background: var(--bg-secondary);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid var(--border);
    }
    .card h2 {
      font-size: 1.1rem;
      color: var(--text-header);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card p.desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 16px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    @media (max-width: 650px) {
      .form-grid { grid-template-columns: 1fr; }
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }
    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-header);
    }
    select, input[type="password"], input[type="text"], textarea {
      width: 100%;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-normal);
      padding: 10px 12px;
      font-size: 0.95rem;
      font-family: inherit;
      outline: none;
      transition: border 0.2s;
    }
    select:focus, input:focus, textarea:focus {
      border-color: var(--brand);
    }
    textarea {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 0.85rem;
      resize: vertical;
      line-height: 1.4;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border: 1px solid var(--border);
      margin-bottom: 10px;
    }
    .toggle-info .toggle-title {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text-header);
    }
    .toggle-info .toggle-desc {
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    /* Switch styling */
    .switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #4e5058;
      transition: .25s;
      border-radius: 24px;
    }
    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .25s;
      border-radius: 50%;
    }
    input:checked + .slider { background-color: var(--brand); }
    input:checked + .slider:before { transform: translateX(20px); }

    .btn-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: flex-end;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    button {
      padding: 10px 20px;
      border-radius: 6px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
      transition: opacity 0.2s, background 0.2s;
    }
    .btn-save {
      background: var(--brand);
      color: white;
    }
    .btn-save:hover { background: var(--brand-hover); }
    .btn-reset {
      background: #4e5058;
      color: var(--text-header);
    }
    .btn-reset:hover { background: #6d6f78; }
    .password-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-tertiary);
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    .password-box input {
      background: transparent;
      border: none;
      padding: 4px;
      font-size: 0.85rem;
      width: 140px;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: var(--bg-secondary);
      border-radius: 8px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
      z-index: 1000;
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }
    .toast.success { border-left: 4px solid var(--success); }
    .toast.error { border-left: 4px solid var(--danger); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-brand">
        <span style="font-size: 2rem;">🐕</span>
        <div>
          <h1>Dogesh Bhai - Live Dashboard</h1>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${botTag} • Real-Time Controller</div>
        </div>
      </div>
      <div class="badge-status">
        <span class="status-dot"></span>
        <span>${wsStatus}</span>
      </div>
    </header>

    <div class="stats-bar">
      <div class="stat-card">
        <div class="label">WS Ping</div>
        <div class="value">${ping}</div>
      </div>
      <div class="stat-card">
        <div class="label">Uptime</div>
        <div class="value">${uptimeHours} hrs</div>
      </div>
      <div class="stat-card">
        <div class="label">Primary Model</div>
        <div class="value" style="font-size: 0.95rem;">openai/gpt-oss-120b</div>
      </div>
      <div class="stat-card">
        <div class="label">Time Vibe</div>
        <div class="value" id="stat-time-vibe" style="font-size: 0.95rem;">Active (IST)</div>
      </div>
    </div>

    <!-- Tone & Sliders Card -->
    <div class="card">
      <h2>🎭 Tone, Attitude & Bhaichara Settings</h2>
      <p class="desc">Manage Dogesh's live personality and banter behavior in real-time without restarting the bot.</p>

      <div class="form-grid">
        <div class="form-group">
          <label for="savageLevel">Savage Level</label>
          <select id="savageLevel">
            <option value="chill">Chill 😇 (Friendly & polite)</option>
            <option value="balanced">Balanced 😎 (Light roasts & jokes)</option>
            <option value="high" selected>Savage 🔥 (Default: Peak Chad Dogesh)</option>
            <option value="unhinged">Unhinged 💀 (Toxic Bakchodi & Maximum Roasts)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="sarcasmLevel">Sarcasm Level</label>
          <select id="sarcasmLevel">
            <option value="low">Low (Direct & plain)</option>
            <option value="medium" selected>Medium (Natural subtle wit)</option>
            <option value="high">High (Heavy sarcasm & punchlines)</option>
          </select>
        </div>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-title">Bhaichara Mode (Brotherhood on Top)</div>
          <div class="toggle-desc">Treat members like true homies. If someone is sad/stressed, drop roasts and show brotherly support.</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="bhaicharaMode" checked>
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-title">Referee & Lafda Mode</div>
          <div class="toggle-desc">When two friends in the server argue or banter, humorously take a side and roast the other instead of neutral diplomacy.</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="refereeMode" checked>
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-title">Time-of-Day Vibe (IST Calibrated)</div>
          <div class="toggle-desc">Automatically roast late-night overthinking (12 AM-5 AM) and early-morning waking in Indian Standard Time.</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="timeVibeEnabled" checked>
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <!-- System Prompt Editor -->
    <div class="card">
      <h2>🧠 System Prompt Base (Core Identity)</h2>
      <p class="desc">The foundational prompt guiding Dogesh's personality. Always backed by factory defaults so it will never be blank.</p>
      <div class="form-group">
        <textarea id="systemPromptBase" rows="12" placeholder="Loading system prompt..."></textarea>
      </div>
    </div>

    <!-- Custom Rules & Lore -->
    <div class="card">
      <h2>📜 Custom Server Rules & Member Lore</h2>
      <p class="desc">Add specific instructions for your friends, running jokes, or server rules.</p>
      <div class="form-group">
        <textarea id="customPromptRules" rows="5" placeholder="Enter custom server rules or member notes..."></textarea>
      </div>
    </div>

    <!-- Banters & Slang -->
    <div class="card">
      <h2>💬 Banter & Slang Examples (Inspiration Pool)</h2>
      <p class="desc">Enter sample banters (one per line). <em>Dogesh uses these as tone inspiration and will not repetitively spam only these lines.</em></p>
      <div class="form-group">
        <textarea id="bantersAndJokes" rows="6" placeholder="Bhaichara on top hamesha&#10;Scene set hai&#10;Lafda ho gaya"></textarea>
      </div>
    </div>

    <!-- Actions & Password -->
    <div class="card" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
      <div class="password-box">
        <span style="font-size: 0.9rem;">🔑 PIN:</span>
        <input type="password" id="adminPin" placeholder="Enter PIN" value="dogesh123">
      </div>

      <div class="btn-bar" style="margin-top: 0;">
        <button class="btn-reset" onclick="resetDefaults()">🔄 Reset to Factory Defaults</button>
        <button class="btn-save" onclick="saveConfig()">💾 Save Live Changes</button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function showToast(msg, isError = false) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + (isError ? 'error' : 'success') + ' show';
      setTimeout(() => { t.className = 'toast'; }, 3500);
    }

    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Failed to fetch config');
        const cfg = await res.json();

        // Populate fields (Guaranteed to have defaults)
        document.getElementById('savageLevel').value = cfg.toneSettings?.savageLevel || 'high';
        document.getElementById('sarcasmLevel').value = cfg.toneSettings?.sarcasmLevel || 'medium';
        document.getElementById('bhaicharaMode').checked = cfg.toneSettings?.bhaicharaMode !== false;
        document.getElementById('refereeMode').checked = cfg.toneSettings?.refereeMode !== false;
        document.getElementById('timeVibeEnabled').checked = cfg.toneSettings?.timeVibeEnabled !== false;

        document.getElementById('systemPromptBase').value = cfg.systemPromptBase || '';
        document.getElementById('customPromptRules').value = cfg.customPromptRules || '';
        document.getElementById('bantersAndJokes').value = Array.isArray(cfg.bantersAndJokes) ? cfg.bantersAndJokes.join('\\n') : '';
      } catch (err) {
        showToast('Error loading config: ' + err.message, true);
      }
    }

    async function saveConfig() {
      const pin = document.getElementById('adminPin').value.trim();
      const bantersText = document.getElementById('bantersAndJokes').value;
      const bantersArray = bantersText.split('\\n').map(l => l.trim()).filter(Boolean);

      const payload = {
        pin: pin,
        systemPromptBase: document.getElementById('systemPromptBase').value,
        customPromptRules: document.getElementById('customPromptRules').value,
        toneSettings: {
          savageLevel: document.getElementById('savageLevel').value,
          sarcasmLevel: document.getElementById('sarcasmLevel').value,
          bhaicharaMode: document.getElementById('bhaicharaMode').checked,
          refereeMode: document.getElementById('refereeMode').checked,
          timeVibeEnabled: document.getElementById('timeVibeEnabled').checked,
        },
        bantersAndJokes: bantersArray
      };

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Update failed');
        }
        showToast('✅ Changes saved! Live personality updated instantly.');
      } catch (err) {
        showToast('❌ ' + err.message, true);
      }
    }

    async function resetDefaults() {
      if (!confirm('Are you sure you want to reset all prompts, tones, and banters back to factory defaults?')) {
        return;
      }
      const pin = document.getElementById('adminPin').value.trim();
      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pin })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Reset failed');
        }
        await loadConfig();
        showToast('🔄 Reset to factory defaults successfully!');
      } catch (err) {
        showToast('❌ ' + err.message, true);
      }
    }

    window.addEventListener('DOMContentLoaded', loadConfig);
  </script>
</body>
</html>`;
}

function handleHttpRequest(req, res, client) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // GET / -> Serve dashboard HTML
  if (req.method === 'GET' && (pathname === '/' || pathname === '/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getDashboardHtml(client));
  }

  // GET /api/config -> Return live configuration
  if (req.method === 'GET' && pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(configManager.getConfig(), null, 2));
  }

  // POST /api/config -> Update live configuration
  if (req.method === 'POST' && pathname === '/api/config') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (data.pin !== DASHBOARD_PASSWORD) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid PIN / Password!' }));
        }

        const updated = configManager.updateConfig({
          systemPromptBase: data.systemPromptBase,
          customPromptRules: data.customPromptRules,
          toneSettings: data.toneSettings,
          bantersAndJokes: data.bantersAndJokes
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, config: updated }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload: ' + err.message }));
      }
    });
    return;
  }

  // POST /api/reset -> Reset to defaults
  if (req.method === 'POST' && pathname === '/api/reset') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (data.pin !== DASHBOARD_PASSWORD) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid PIN / Password!' }));
        }

        const resetConfig = configManager.resetToDefaults();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, config: resetConfig }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // GET /debug -> Existing debug status endpoint
  if (req.method === 'GET' && pathname === '/debug') {
    const logger = require('./logger');
    const statusMap = ['READY', 'CONNECTING', 'RECONNECTING', 'IDLE', 'NEARLY', 'DISCONNECTED', 'WAITING_FOR_GUILDS', 'IDENTIFYING', 'RESUMING'];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      wsStatus: statusMap[client.ws.status] || client.ws.status,
      user: client.user ? client.user.tag : null,
      botId: client.user ? client.user.id : null,
      uptimeSeconds: Math.floor(process.uptime()),
      ping: client.ws.ping,
      nodeVersion: process.version,
      recentLogs: logger.getRecentLogs(35)
    }, null, 2));
  }

  // Fallback for unrecognized routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

module.exports = { handleHttpRequest };

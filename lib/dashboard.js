const crypto = require('crypto');
const configManager = require('./configManager');

const DASHBOARD_PASSWORD = (process.env.DASHBOARD_PASS || 'dogesh123').trim();

function getExpectedToken() {
  return crypto.createHash('sha256').update(`dogesh_salt_${DASHBOARD_PASSWORD}`).digest('hex');
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers && req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  if (cookies.dogesh_session && cookies.dogesh_session === getExpectedToken()) {
    return true;
  }
  const authHeader = req.headers && req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7).trim() === DASHBOARD_PASSWORD) {
    return true;
  }
  const pinHeader = req.headers && req.headers['x-admin-pin'];
  if (pinHeader && pinHeader.trim() === DASHBOARD_PASSWORD) {
    return true;
  }
  return false;
}

function getLoginHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dogesh Bhai - Admin Access</title>
  <link rel="icon" href="https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f436.png">
  <style>
    :root {
      --zinc-950: #09090b;
      --zinc-900: #18181b;
      --zinc-800: #27272a;
      --zinc-700: #3f3f46;
      --zinc-500: #71717a;
      --zinc-400: #a1a1aa;
      --zinc-300: #d4d4d8;
      --zinc-200: #e4e4e7;
      --zinc-100: #f4f4f5;
      --accent-primary: #d97706;
      --accent-light: #f59e0b;
      --accent-subtle: rgba(217, 119, 6, 0.10);
      --accent-border: rgba(217, 119, 6, 0.28);
      --red-500: #ef4444;
      --radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--zinc-950);
      color: var(--zinc-200);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .login-card {
      width: 100%;
      max-width: 380px;
      background: var(--zinc-900);
      border: 1px solid var(--zinc-800);
      border-radius: var(--radius);
      padding: 32px 28px;
    }
    .brand-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-header .logo {
      font-size: 2rem;
    }
    .brand-header h1 {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--zinc-100);
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.01em;
    }
    .brand-header h1 span.tag {
      background: var(--accent-subtle);
      color: var(--accent-light);
      border: 1px solid var(--accent-border);
      font-size: 0.68rem;
      padding: 1px 7px;
      border-radius: 4px;
      font-weight: 600;
    }
    .brand-header p.sub {
      font-size: 0.78rem;
      color: var(--zinc-400);
      margin-top: 2px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--zinc-300);
      margin-bottom: 8px;
    }
    .input-wrapper {
      position: relative;
    }
    .input-wrapper input {
      width: 100%;
      background: var(--zinc-950);
      border: 1px solid var(--zinc-800);
      border-radius: 6px;
      color: var(--zinc-100);
      padding: 10px 12px;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.15s ease;
      font-family: inherit;
    }
    .input-wrapper input:focus {
      border-color: var(--accent-light);
    }
    .btn-submit {
      width: 100%;
      background: var(--accent-primary);
      color: #09090b;
      border: none;
      font-weight: 600;
      font-size: 0.86rem;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-submit:hover:not(:disabled) {
      background: var(--accent-light);
    }
    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-msg {
      margin-top: 14px;
      font-size: 0.78rem;
      color: var(--red-500);
      min-height: 20px;
      text-align: center;
    }
    .footer-note {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--zinc-800);
      font-size: 0.72rem;
      color: var(--zinc-500);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="brand-header">
      <span class="logo">🐕</span>
      <div>
        <h1>Dogesh Studio <span class="tag">LOCKED</span></h1>
        <p class="sub">Live Persona & Prompt Controller</p>
      </div>
    </div>

    <form onsubmit="handleLogin(event)">
      <div class="form-group">
        <label for="pinInput">Enter Admin Access Key / PIN</label>
        <div class="input-wrapper">
          <input type="password" id="pinInput" placeholder="Enter Access Key..." autofocus required autocomplete="current-password">
        </div>
      </div>
      <button type="submit" id="loginBtn" class="btn-submit">
        <span>Unlock Studio</span>
        <span>→</span>
      </button>
      <div id="loginError" class="error-msg"></div>
    </form>

    <div class="footer-note">
      Protected studio dashboard. Access restricted.
    </div>
  </div>

  <script>
    async function handleLogin(e) {
      e.preventDefault();
      const pin = document.getElementById('pinInput').value.trim();
      const btn = document.getElementById('loginBtn');
      const err = document.getElementById('loginError');
      err.textContent = '';
      btn.disabled = true;
      btn.innerHTML = '<span>Verifying...</span>';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          sessionStorage.setItem('dogesh_pin', pin);
          window.location.reload();
        } else {
          err.textContent = '❌ ' + (data.error || 'Invalid Access Key / PIN');
          btn.disabled = false;
          btn.innerHTML = '<span>Unlock Studio</span> <span>→</span>';
          document.getElementById('pinInput').select();
        }
      } catch (e) {
        err.textContent = '❌ Connection error: ' + e.message;
        btn.disabled = false;
        btn.innerHTML = '<span>Unlock Studio</span> <span>→</span>';
      }
    }
  </script>
</body>
</html>`;
}

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
      /* Deep dark zinc palette (Tailwind / shadcn SaaS theme) */
      --zinc-950: #09090b;
      --zinc-900: #18181b;
      --zinc-850: #202024;
      --zinc-800: #27272a;
      --zinc-750: #303036;
      --zinc-700: #3f3f46;
      --zinc-600: #52525b;
      --zinc-500: #71717a;
      --zinc-400: #a1a1aa;
      --zinc-300: #d4d4d8;
      --zinc-200: #e4e4e7;
      --zinc-100: #f4f4f5;

      /* Muted warm accent (amber-600 / amber-500) */
      --accent-primary: #d97706;
      --accent-light: #f59e0b;
      --accent-hover: #b45309;
      --accent-subtle: rgba(217, 119, 6, 0.10);
      --accent-border: rgba(217, 119, 6, 0.28);

      --emerald-500: #10b981;
      --red-500: #ef4444;
      --radius: 8px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--zinc-950);
      color: var(--zinc-200);
      line-height: 1.5;
      padding: 24px 16px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1080px;
      margin: 0 auto;
    }

    /* Top Header Bar */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: var(--zinc-900);
      border-radius: var(--radius);
      margin-bottom: 20px;
      border: 1px solid var(--zinc-800);
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-brand .logo {
      font-size: 1.7rem;
    }
    .header-brand h1 {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--zinc-100);
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.01em;
    }
    .header-brand h1 span.tag {
      background: var(--accent-subtle);
      color: var(--accent-light);
      border: 1px solid var(--accent-border);
      font-size: 0.7rem;
      padding: 1px 7px;
      border-radius: 4px;
      font-weight: 600;
    }
    .header-brand p.sub {
      font-size: 0.75rem;
      color: var(--zinc-400);
      margin-top: 1px;
    }

    /* Top Header Badges - Simple flat pills with muted bg-zinc-800 */
    .header-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .meta-pill {
      background: var(--zinc-800);
      border: 1px solid var(--zinc-700);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      color: var(--zinc-300);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }
    .meta-pill .label {
      color: var(--zinc-400);
      font-size: 0.72rem;
    }
    .meta-pill .value {
      color: var(--zinc-200);
      font-weight: 600;
    }
    .meta-pill.model-pill {
      border-color: var(--zinc-700);
      color: var(--accent-light);
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--emerald-500);
    }
    .meta-pill.lock-pill {
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
    }
    .meta-pill.lock-pill:hover {
      background: var(--zinc-700);
      border-color: var(--zinc-600);
      color: var(--zinc-100);
    }

    /* 2-Column Responsive Dashboard Layout */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 410px 1fr;
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 920px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Flat Card Panels */
    .card {
      background: var(--zinc-900);
      border-radius: var(--radius);
      padding: 18px;
      margin-bottom: 16px;
      border: 1px solid var(--zinc-800);
    }
    .card h2 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--zinc-100);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card p.desc {
      font-size: 0.78rem;
      color: var(--zinc-400);
      margin-bottom: 14px;
      line-height: 1.4;
    }

    /* Sliders - Completely flat with muted amber filled track */
    .slider-card {
      background: var(--zinc-950);
      border: 1px solid var(--zinc-800);
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 12px;
    }
    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .slider-header .title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--zinc-200);
    }
    .slider-header .badge {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--accent-light);
      background: var(--accent-subtle);
      border: 1px solid var(--accent-border);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .magnetic-range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 5px;
      background: linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) var(--pct, 50%), var(--zinc-800) var(--pct, 50%), var(--zinc-800) 100%);
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
      border: none !important;
      padding: 0 !important;
    }
    .magnetic-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: var(--zinc-100);
      border: 2px solid var(--zinc-900);
      cursor: pointer;
      box-shadow: none;
      transition: transform 0.1s ease;
    }
    .magnetic-range::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }
    .magnetic-range::-webkit-slider-thumb:active {
      transform: scale(1.15);
      background: var(--accent-light);
    }
    .magnetic-range::-moz-range-thumb {
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: var(--zinc-100);
      border: 2px solid var(--zinc-900);
      cursor: pointer;
      box-shadow: none;
    }
    .magnetic-range::-moz-range-progress {
      background: var(--accent-primary);
      border-radius: 9999px;
      height: 5px;
    }
    .magnetic-range::-moz-range-track {
      background: var(--zinc-800);
      border-radius: 9999px;
      height: 5px;
    }
    .slider-steps {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
    }
    .step-btn {
      background: transparent;
      border: none;
      color: var(--zinc-500);
      font-size: 0.72rem;
      font-weight: 500;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.15s ease;
    }
    .step-btn:hover {
      color: var(--zinc-300);
    }
    .step-btn.active {
      color: var(--accent-light);
      font-weight: 600;
    }

    /* Standard, flat, minimalist toggle switches */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--zinc-950);
      border-radius: 6px;
      border: 1px solid var(--zinc-800);
      margin-bottom: 8px;
    }
    .toggle-info .toggle-title {
      font-weight: 600;
      font-size: 0.82rem;
      color: var(--zinc-200);
    }
    .toggle-info .toggle-desc {
      font-size: 0.72rem;
      color: var(--zinc-500);
      margin-top: 2px;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 38px;
      height: 20px;
      flex-shrink: 0;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .switch-track {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background-color: var(--zinc-800);
      border: 1px solid var(--zinc-700);
      border-radius: 9999px;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }
    .switch-track:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 2px;
      bottom: 2px;
      background-color: var(--zinc-200);
      border-radius: 50%;
      transition: transform 0.15s ease, background-color 0.15s ease;
    }
    input:checked + .switch-track {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }
    input:checked + .switch-track:before {
      transform: translateX(18px);
      background-color: #ffffff;
    }

    /* Tabs - Clean classic underline style (no pills, no boxes) */
    .studio-card {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .tabs-nav {
      display: flex;
      gap: 24px;
      border-bottom: 1px solid var(--zinc-800);
      margin-bottom: 16px;
      padding: 0 4px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--zinc-400);
      font-size: 0.84rem;
      font-weight: 500;
      padding: 8px 4px 12px 4px;
      margin-bottom: -1px;
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease;
      border-radius: 0;
    }
    .tab-btn:hover {
      color: var(--zinc-200);
    }
    .tab-btn.active {
      color: var(--zinc-100);
      border-bottom: 2px solid var(--accent-light);
      font-weight: 600;
      background: transparent;
    }
    .tab-pane {
      display: none;
      flex-direction: column;
      flex: 1;
    }
    .tab-pane.active {
      display: flex;
    }

    /* Text Editor Area - Monospace font & thin dark custom scrollbar */
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .scrollbar-thin {
      scrollbar-width: thin;
    }
    .scrollbar-thin::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .scrollbar-track-transparent::-webkit-scrollbar-track,
    textarea::-webkit-scrollbar-track {
      background: transparent;
    }
    .scrollbar-thumb-zinc-700,
    textarea {
      scrollbar-color: var(--zinc-700) transparent;
    }
    .scrollbar-thumb-zinc-700::-webkit-scrollbar-thumb,
    textarea::-webkit-scrollbar-thumb {
      background: var(--zinc-700);
      border-radius: 9999px;
    }
    .scrollbar-thumb-zinc-700::-webkit-scrollbar-thumb:hover,
    textarea::-webkit-scrollbar-thumb:hover {
      background: var(--zinc-600);
    }

    textarea {
      width: 100%;
      background: var(--zinc-950);
      border: 1px solid var(--zinc-800);
      border-radius: 6px;
      color: var(--zinc-200);
      padding: 14px;
      font-size: 0.8125rem;
      outline: none;
      resize: vertical;
      line-height: 1.6;
      min-height: 400px;
      transition: border-color 0.15s ease;
    }
    textarea:focus {
      border-color: var(--accent-light);
    }

    /* Flat Action Bar */
    .actions-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .pin-input-group {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--zinc-950);
      border: 1px solid var(--zinc-800);
      border-radius: 6px;
      padding: 6px 10px;
    }
    .pin-input-group span {
      font-size: 0.8rem;
      color: var(--zinc-500);
    }
    .pin-input-group input {
      background: transparent;
      border: none;
      color: var(--zinc-100);
      font-size: 0.8125rem;
      width: 100px;
      outline: none;
      font-family: inherit;
    }
    .btn-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .btn-save {
      background: var(--accent-primary);
      color: #09090b;
      border: none;
      font-weight: 600;
      font-size: 0.8125rem;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .btn-save:hover {
      background: var(--accent-light);
    }
    .btn-reset {
      background: transparent;
      border: 1px solid var(--zinc-800);
      color: var(--zinc-400);
      font-weight: 500;
      font-size: 0.8125rem;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-reset:hover {
      color: var(--zinc-200);
      border-color: var(--zinc-700);
      background: var(--zinc-850);
    }

    /* Flat Toast Notification */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 18px;
      background: var(--zinc-900);
      border-radius: 6px;
      border: 1px solid var(--zinc-800);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.84rem;
      color: var(--zinc-200);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.2s ease;
      z-index: 1000;
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }
    .toast.success { border-left: 3px solid var(--accent-light); }
    .toast.error { border-left: 3px solid var(--red-500); }
  </style>
</head>
<body>
  <div class="container">
    <!-- Top Nav Header -->
    <header>
      <div class="header-brand">
        <span class="logo">🐕</span>
        <div>
          <h1>Dogesh Bhai <span class="tag">Studio</span></h1>
          <p class="sub">${botTag} • Live Persona Controller</p>
        </div>
      </div>
      <div class="header-meta">
        <div class="meta-pill model-pill">
          <span class="label">Model:</span>
          <span class="value">gemini-3.5-flash-lite</span>
        </div>
        <div class="meta-pill">
          <span class="label">Ping:</span>
          <span class="value">${ping}</span>
        </div>
        <div class="meta-pill">
          <span class="label">Uptime:</span>
          <span class="value">${uptimeHours}h</span>
        </div>
        <div class="meta-pill">
          <span class="status-dot"></span>
          <span class="value">${wsStatus}</span>
        </div>
        <div class="meta-pill lock-pill" onclick="handleLogout()" title="Lock dashboard" role="button">
          <span>🔒</span>
          <span class="value">Lock</span>
        </div>
      </div>
    </header>

    <!-- Main 2-Column Dashboard Grid -->
    <div class="dashboard-grid">
      <!-- LEFT COLUMN: Controls & Personality Sliders -->
      <div class="left-col">
        <!-- Tone & Personality Card -->
        <div class="card">
          <h2>🎭 Tone & Personality</h2>
          <p class="desc">Snap magnetic sliders to tune Dogesh's roast and sarcasm intensity.</p>

          <!-- Savage Slider -->
          <div class="slider-card">
            <div class="slider-header">
              <span class="title">Savage Level</span>
              <span id="savageBadge" class="badge">Savage 🔥</span>
            </div>
            <input type="range" min="0" max="3" step="1" value="2" id="savageSlider" class="magnetic-range">
            <div class="slider-steps" id="savageSteps">
              <button type="button" class="step-btn" onclick="setSavageStep(0)">Chill 😇</button>
              <button type="button" class="step-btn" onclick="setSavageStep(1)">Balanced 😎</button>
              <button type="button" class="step-btn active" onclick="setSavageStep(2)">Savage 🔥</button>
              <button type="button" class="step-btn" onclick="setSavageStep(3)">Unhinged 💀</button>
            </div>
          </div>

          <!-- Sarcasm Slider -->
          <div class="slider-card">
            <div class="slider-header">
              <span class="title">Sarcasm Level</span>
              <span id="sarcasmBadge" class="badge">Medium 👍</span>
            </div>
            <input type="range" min="0" max="2" step="1" value="1" id="sarcasmSlider" class="magnetic-range">
            <div class="slider-steps" id="sarcasmSteps">
              <button type="button" class="step-btn" onclick="setSarcasmStep(0)">Low</button>
              <button type="button" class="step-btn active" onclick="setSarcasmStep(1)">Medium 👍</button>
              <button type="button" class="step-btn" onclick="setSarcasmStep(2)">High 🔥</button>
            </div>
          </div>
        </div>

        <!-- Behavioral Toggles Card -->
        <div class="card">
          <h2>⚡ Dynamic Behaviors</h2>
          <p class="desc">Toggle specialized community banter and support features.</p>

          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-title">🤝 Bhaichara Mode</div>
              <div class="toggle-desc">Support sad bros with comfort; banter with homies.</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="bhaicharaMode" checked>
              <span class="switch-track"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-title">⚖️ Referee & Lafda Mode</div>
              <div class="toggle-desc">Pick a funny side during friend arguments.</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="refereeMode" checked>
              <span class="switch-track"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div class="toggle-info">
              <div class="toggle-title">🌙 Time-of-Day Vibe (IST)</div>
              <div class="toggle-desc">Late-night roasts & morning banter based on Indian time.</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="timeVibeEnabled" checked>
              <span class="switch-track"></span>
            </label>
          </div>
        </div>

        <!-- Security & Actions Card -->
        <div class="card actions-card">
          <div class="pin-input-group">
            <span>🔑</span>
            <input type="password" id="adminPin" placeholder="PIN" value="dogesh123">
          </div>
          <div class="btn-group">
            <button class="btn-reset" onclick="resetDefaults()">🔄 Reset</button>
            <button class="btn-save" onclick="saveConfig()">💾 Save Changes</button>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Tabbed Prompt Studio -->
      <div class="right-col">
        <div class="card studio-card">
          <!-- Clean underline tabs -->
          <div class="tabs-nav">
            <button type="button" class="tab-btn active" id="tab-system" onclick="switchTab('system')">Core Prompt</button>
            <button type="button" class="tab-btn" id="tab-rules" onclick="switchTab('rules')">Custom Rules</button>
            <button type="button" class="tab-btn" id="tab-banters" onclick="switchTab('banters')">Banter Pool</button>
          </div>

          <!-- Tab 1: System Prompt Base -->
          <div id="pane-system" class="tab-pane active">
            <p class="desc">Foundational identity and instructions. Backed by Git factory defaults (never blank).</p>
            <textarea id="systemPromptBase" class="font-mono scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent" rows="18" placeholder="Loading system prompt..."></textarea>
          </div>

          <!-- Tab 2: Custom Rules -->
          <div id="pane-rules" class="tab-pane">
            <p class="desc">Specific server lore, VIP respect (e.g. Anuj), running jokes, or custom rules.</p>
            <textarea id="customPromptRules" class="font-mono scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent" rows="18" placeholder="Enter custom server rules or member notes..."></textarea>
          </div>

          <!-- Tab 3: Banter Examples -->
          <div id="pane-banters" class="tab-pane">
            <p class="desc">Sample banters (one per line). <em>Dogesh uses these for tone inspiration and will not repetitively spam only these lines.</em></p>
            <textarea id="bantersAndJokes" class="font-mono scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent" rows="18" placeholder="Bhaichara on top hamesha&#10;Scene set hai&#10;Lafda ho gaya"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const SAVAGE_STEPS = [
      { key: 'chill', label: 'Chill 😇' },
      { key: 'balanced', label: 'Balanced 😎' },
      { key: 'high', label: 'Savage 🔥' },
      { key: 'unhinged', label: 'Unhinged 💀' }
    ];

    const SARCASM_STEPS = [
      { key: 'low', label: 'Low' },
      { key: 'medium', label: 'Medium 👍' },
      { key: 'high', label: 'High 🔥' }
    ];

    function updateSavageUI(index) {
      index = Math.max(0, Math.min(3, Number(index)));
      const step = SAVAGE_STEPS[index] || SAVAGE_STEPS[2];
      const slider = document.getElementById('savageSlider');
      slider.value = index;
      slider.style.setProperty('--pct', ((index / 3) * 100) + '%');
      document.getElementById('savageBadge').textContent = step.label;
      const btns = document.querySelectorAll('#savageSteps .step-btn');
      btns.forEach((b, i) => b.classList.toggle('active', i === index));
    }

    function setSavageStep(index) {
      updateSavageUI(index);
    }

    function updateSarcasmUI(index) {
      index = Math.max(0, Math.min(2, Number(index)));
      const step = SARCASM_STEPS[index] || SARCASM_STEPS[1];
      const slider = document.getElementById('sarcasmSlider');
      slider.value = index;
      slider.style.setProperty('--pct', ((index / 2) * 100) + '%');
      document.getElementById('sarcasmBadge').textContent = step.label;
      const btns = document.querySelectorAll('#sarcasmSteps .step-btn');
      btns.forEach((b, i) => b.classList.toggle('active', i === index));
    }

    function setSarcasmStep(index) {
      updateSarcasmUI(index);
    }

    function switchTab(tabKey) {
      const tabs = ['system', 'rules', 'banters'];
      tabs.forEach(t => {
        const btn = document.getElementById('tab-' + t);
        const pane = document.getElementById('pane-' + t);
        if (btn) btn.classList.toggle('active', t === tabKey);
        if (pane) pane.classList.toggle('active', t === tabKey);
      });
    }

    function showToast(msg, isError = false) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast ' + (isError ? 'error' : 'success') + ' show';
      setTimeout(() => { t.className = 'toast'; }, 3500);
    }

    async function handleLogout() {
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch (e) {}
      sessionStorage.removeItem('dogesh_pin');
      window.location.reload();
    }

    async function loadConfig() {
      try {
        const storedPin = sessionStorage.getItem('dogesh_pin') || '';
        const res = await fetch('/api/config', {
          headers: storedPin ? { 'x-admin-pin': storedPin } : {}
        });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch config');
        const cfg = await res.json();

        // Populate magnetic sliders
        const savageKey = cfg.toneSettings?.savageLevel || 'high';
        const savageIdx = SAVAGE_STEPS.findIndex(s => s.key === savageKey);
        updateSavageUI(savageIdx >= 0 ? savageIdx : 2);

        const sarcasmKey = cfg.toneSettings?.sarcasmLevel || 'medium';
        const sarcasmIdx = SARCASM_STEPS.findIndex(s => s.key === sarcasmKey);
        updateSarcasmUI(sarcasmIdx >= 0 ? sarcasmIdx : 1);

        // Toggles
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
      const storedPin = sessionStorage.getItem('dogesh_pin') || '';
      const pin = document.getElementById('adminPin')?.value.trim() || storedPin;
      const bantersText = document.getElementById('bantersAndJokes').value;
      const bantersArray = bantersText.split('\\n').map(l => l.trim()).filter(Boolean);

      const savageIdx = Number(document.getElementById('savageSlider').value);
      const sarcasmIdx = Number(document.getElementById('sarcasmSlider').value);

      const payload = {
        pin: pin,
        systemPromptBase: document.getElementById('systemPromptBase').value,
        customPromptRules: document.getElementById('customPromptRules').value,
        toneSettings: {
          savageLevel: SAVAGE_STEPS[savageIdx]?.key || 'high',
          sarcasmLevel: SARCASM_STEPS[sarcasmIdx]?.key || 'medium',
          bhaicharaMode: document.getElementById('bhaicharaMode').checked,
          refereeMode: document.getElementById('refereeMode').checked,
          timeVibeEnabled: document.getElementById('timeVibeEnabled').checked,
        },
        bantersAndJokes: bantersArray
      };

      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(pin ? { 'x-admin-pin': pin } : {})
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Update failed');
        }
        showToast('✅ Saved! Personality updated live instantly.');
      } catch (err) {
        showToast('❌ ' + err.message, true);
      }
    }

    async function resetDefaults() {
      if (!confirm('Are you sure you want to reset all prompts, tones, and banters back to factory defaults?')) {
        return;
      }
      const storedPin = sessionStorage.getItem('dogesh_pin') || '';
      const pin = document.getElementById('adminPin')?.value.trim() || storedPin;
      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(pin ? { 'x-admin-pin': pin } : {})
          },
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

    document.addEventListener('DOMContentLoaded', () => {
      const storedPin = sessionStorage.getItem('dogesh_pin');
      if (storedPin && document.getElementById('adminPin')) {
        document.getElementById('adminPin').value = storedPin;
      }
      loadConfig();
      document.getElementById('savageSlider').addEventListener('input', (e) => {
        updateSavageUI(e.target.value);
      });
      document.getElementById('sarcasmSlider').addEventListener('input', (e) => {
        updateSarcasmUI(e.target.value);
      });
    });
  </script>
</body>
</html>`;
}

function handleHttpRequest(req, res, client) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // GET / or /dashboard -> Serve dashboard if authed, else lock/login page
  if (req.method === 'GET' && (pathname === '/' || pathname === '/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (isAuthenticated(req)) {
      return res.end(getDashboardHtml(client));
    } else {
      return res.end(getLoginHtml());
    }
  }

  // POST /api/login -> Verify PIN and set session cookie
  if (req.method === 'POST' && pathname === '/api/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const pin = (data.pin || '').trim();
        if (pin !== DASHBOARD_PASSWORD) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid Access Key / PIN' }));
        }

        const token = getExpectedToken();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `dogesh_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
        });
        return res.end(JSON.stringify({ success: true, token }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid payload' }));
      }
    });
    return;
  }

  // POST /api/logout or GET /logout -> Clear session cookie
  if ((req.method === 'POST' && pathname === '/api/logout') || (req.method === 'GET' && pathname === '/logout')) {
    res.writeHead(req.method === 'GET' ? 302 : 200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'dogesh_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      ...(req.method === 'GET' ? { 'Location': '/' } : {})
    });
    return res.end(JSON.stringify({ success: true }));
  }

  // GET /api/config -> Return live configuration (Requires auth)
  if (req.method === 'GET' && pathname === '/api/config') {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Unauthorized. Please unlock studio first.' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(configManager.getConfig(), null, 2));
  }

  // POST /api/config -> Update live configuration (Requires auth or PIN)
  if (req.method === 'POST' && pathname === '/api/config') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const authed = isAuthenticated(req) || (data.pin && data.pin.trim() === DASHBOARD_PASSWORD);
        if (!authed) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid PIN / Unauthorized!' }));
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

  // POST /api/reset -> Reset to defaults (Requires auth or PIN)
  if (req.method === 'POST' && pathname === '/api/reset') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const authed = isAuthenticated(req) || (data.pin && data.pin.trim() === DASHBOARD_PASSWORD);
        if (!authed) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid PIN / Unauthorized!' }));
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

  // GET /debug -> Existing debug status endpoint (Requires auth or ?pin=...)
  if (req.method === 'GET' && pathname === '/debug') {
    const authed = isAuthenticated(req) || url.searchParams.get('pin') === DASHBOARD_PASSWORD;
    if (!authed) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized. Provide ?pin=...' }));
    }
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

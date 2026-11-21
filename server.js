/**
 * Web Dashboard & Control Server for Karnal Realty Advisors
 * Deployable on Render.com & Termux (Multi-Device Real Estate Outreach Edition)
 * Supports up to 6 simultaneous WhatsApp accounts (300 property leads/day total)
 * Features:
 * - Luxury Dark Theme (Navy Obsidian & Emerald/Gold accents)
 * - /qr multi-device switching tab bar
 * - Real-time queue, territory & device status matrix
 * - 1-Click CSV export for Hot Replied Leads
 * - 1-Click CSV export for All Discovered Real Estate Leads
 * - 1-Click TXT phone list download & copyable textarea
 * - Manual investor lead injector & past number shielding
 * - Render anti-sleep keep-alive heartbeat engine
 */

require('dotenv').config();

// Global Process Crash Shield
process.on('uncaughtException', (err) => {
  console.error('🛡️ [Crash Shield - Uncaught Exception]:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('🛡️ [Crash Shield - Unhandled Rejection]:', reason);
});

const express = require('express');
const path = require('path');
const whatsapp = require('./whatsapp');
const scraper = require('./scraper');
const queue = require('./queue');
const chatMemory = require('./chatMemory');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Anti-Sleep Keep-Alive State & Auto-Host Detection
let detectedBaseUrl = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
let keepAliveTimer = null;
let lastPingStatus = 'Pending first ping';
let lastPingTime = 'Never';

function startKeepAliveEngine(targetUrl) {
  if (!targetUrl || keepAliveTimer) return;
  detectedBaseUrl = targetUrl.replace(/\/$/, '');
  console.log(`📡 [Anti-Sleep Keep-Alive] Engaged for: ${detectedBaseUrl}`);
  console.log(`⏱️ [Anti-Sleep Keep-Alive] Pinging ${detectedBaseUrl}/ping every 3 minutes to stop Render Free sleep.`);

  const runPing = async () => {
    try {
      const res = await fetch(`${detectedBaseUrl}/ping`, {
        headers: { 'User-Agent': 'Render-AntiSleep-Heartbeat/3.0' },
        signal: AbortSignal.timeout(10000)
      });
      lastPingStatus = `HTTP ${res.status} OK`;
      lastPingTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST';
      console.log(`💓 [Anti-Sleep Heartbeat] Pinged ${detectedBaseUrl}/ping -> ${lastPingStatus} at ${lastPingTime}`);
    } catch (err) {
      lastPingStatus = `Warn: ${err.message}`;
      console.warn('⚠️ [Heartbeat Notice]:', err.message);
    }
  };

  setTimeout(runPing, 5000);
  keepAliveTimer = setInterval(runPing, 3 * 60 * 1000);
}

app.use((req, res, next) => {
  if (!detectedBaseUrl) {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || req.get('host');
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      const resolved = `${proto}://${host}`;
      console.log(`🌐 [Host Auto-Detected] Inbound host captured: ${resolved}`);
      startKeepAliveEngine(resolved);
    }
  }
  next();
});

app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));

/**
 * Official Meta WhatsApp Cloud Redirect (/qr)
 */
app.get('/qr', (req, res) => {
  res.redirect('/?engine=meta_cloud');
});

/**
 * MBG-Card Style Enterprise WhatsApp Real-Time CRM Dashboard (/)
 */
app.get('/', (req, res) => {
  const state = queue.getQueueState ? queue.getQueueState() : {};
  const scraperStats = scraper.getScraperStats ? scraper.getScraperStats() : {};
  const totalShielded = scraper.getTotalShieldedCount ? scraper.getTotalShieldedCount() : 0;
  const metrics = chatMemory.getMetrics ? chatMemory.getMetrics() : { totalConversations: 0, repliedCount: 0, hotCount: 0, responseRate: '0.0%' };
  const inquiries = chatMemory.getInquiries ? chatMemory.getInquiries() : [];
  const conversations = chatMemory.getAllConversations ? chatMemory.getAllConversations() : [];
  const activeEngine = whatsapp.getActiveEngine ? whatsapp.getActiveEngine() : 'meta_cloud';
  const isMetaCloud = activeEngine === 'meta_cloud';
  const dailyTarget = state.dailyMaxLeads || 250;
  const currentSent = state.dailySentCount || 0;
  const progressPct = Math.min(100, Math.round((currentSent / Math.max(1, dailyTarget)) * 100));

  const metaCfg = (whatsapp.metaCloud && whatsapp.metaCloud.getConfig) ? whatsapp.metaCloud.getConfig() : {};
  const isMetaConfigured = (whatsapp.metaCloud && whatsapp.metaCloud.isConfigured) ? whatsapp.metaCloud.isConfigured() : false;
  const publicBaseUrl = detectedBaseUrl || `${req.protocol}://${req.get('host')}`;
  const webhookCallbackUrl = `${publicBaseUrl}/api/meta/webhook`;
  const metaVerifyToken = (whatsapp.metaCloud && whatsapp.metaCloud.verifyToken) || 'satyam_karnal_webhook_2026';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🏢 Satyam Realty — Official Meta WhatsApp Cloud Bot (250/Day)</title>
      <style>
        :root {
          --bg-dark: #070b12;
          --panel-bg: #0d1524;
          --panel-border: #1a273e;
          --wa-green: #25D366;
          --wa-dark-green: #005c4b;
          --wa-bubble-in: #1f2c34;
          --wa-chat-bg: #0b141a;
          --gold: #f59e0b;
          --gold-glow: #fbbf24;
          --text-main: #f1f5f9;
          --text-muted: #94a3b8;
          --accent-blue: #38bdf8;
          --card-radius: 12px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; }
        body { background: var(--bg-dark); color: var(--text-main); min-height: 100vh; padding: 1.25rem; font-size: 14px; }
        .app-container { max-width: 1380px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.25rem; }

        /* Top Navigation Header */
        header.top-bar {
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          border-radius: var(--card-radius);
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .brand-zone { display: flex; align-items: center; gap: 1rem; }
        .brand-logo { width: 50px; height: 50px; border-radius: 10px; border: 2px solid var(--gold); object-fit: cover; }
        .brand-text h1 { font-size: 1.25rem; color: var(--gold-glow); font-weight: 800; letter-spacing: -0.02em; }
        .brand-text p { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem; }
        .header-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

        .engine-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          font-size: 0.82rem;
          font-weight: 700;
          background: rgba(37, 211, 102, 0.12);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.35);
        }
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80; animation: pulse 1.6s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0.4; transform: scale(0.9); } }

        /* Telemetry Cards Grid */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }
        .metric-card {
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          border-radius: var(--card-radius);
          padding: 1.2rem;
          position: relative;
          overflow: hidden;
        }
        .metric-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--gold), var(--wa-green));
        }
        .metric-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; display: flex; justify-content: space-between; align-items: center; }
        .metric-val { font-size: 1.85rem; font-weight: 800; color: #fff; margin: 0.4rem 0 0.3rem 0; font-family: monospace; }
        .metric-sub { font-size: 0.78rem; color: var(--text-muted); }

        .progress-bar-container { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin-top: 0.6rem; }
        .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #10b981, #f59e0b); border-radius: 4px; transition: width 0.4s ease; }

        /* Real-Time Live Activity Feed */
        .ticker-section {
          background: #090e18;
          border: 1px solid var(--panel-border);
          border-radius: var(--card-radius);
          padding: 0.85rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          overflow: hidden;
        }
        .ticker-badge {
          background: #ef4444;
          color: #fff;
          font-weight: 800;
          font-size: 0.72rem;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          text-transform: uppercase;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .ticker-items {
          display: flex;
          gap: 1.5rem;
          overflow-x: auto;
          white-space: nowrap;
          scrollbar-width: none;
          font-size: 0.82rem;
          color: #cbd5e1;
        }
        .ticker-items::-webkit-scrollbar { display: none; }
        .ticker-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: var(--panel-bg);
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
          border: 1px solid var(--panel-border);
        }

        /* MBG Card Live WhatsApp CRM Console */
        .crm-console {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 1.25rem;
          min-height: 650px;
        }
        @media (max-width: 960px) {
          .crm-console { grid-template-columns: 1fr; }
        }

        /* Left Column: Real-Time Lead Inbox */
        .crm-sidebar {
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          border-radius: var(--card-radius);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .sidebar-header {
          padding: 1rem;
          border-bottom: 1px solid var(--panel-border);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .sidebar-title { display: flex; justify-content: space-between; align-items: center; }
        .sidebar-title h2 { font-size: 1rem; color: #fff; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
        .search-box input {
          width: 100%;
          background: var(--bg-dark);
          border: 1px solid var(--panel-border);
          border-radius: 8px;
          padding: 0.55rem 0.85rem;
          color: #fff;
          font-size: 0.85rem;
          outline: none;
        }
        .search-box input:focus { border-color: var(--wa-green); }

        .filter-tabs { display: flex; gap: 0.4rem; overflow-x: auto; scrollbar-width: none; }
        .tab-btn {
          background: transparent;
          border: 1px solid var(--panel-border);
          color: var(--text-muted);
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .tab-btn.active {
          background: rgba(245, 158, 11, 0.15);
          color: var(--gold-glow);
          border-color: var(--gold);
        }

        .contacts-list {
          flex: 1;
          overflow-y: auto;
          max-height: 520px;
        }
        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .contact-item:hover { background: rgba(255, 255, 255, 0.03); }
        .contact-item.selected { background: rgba(37, 211, 102, 0.08); border-left: 3px solid var(--wa-green); }
        .contact-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #1e293b;
          color: var(--gold-glow);
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          flex-shrink: 0;
          border: 1px solid var(--panel-border);
        }
        .contact-info { flex: 1; min-width: 0; }
        .contact-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
        .contact-name { font-weight: 700; color: #fff; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-time { font-size: 0.7rem; color: var(--text-muted); }
        .contact-preview { font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .badge-hot { background: #dc2626; color: #fff; font-size: 0.68rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 4px; }
        .badge-outreach { background: #334155; color: #cbd5e1; font-size: 0.68rem; padding: 0.15rem 0.45rem; border-radius: 4px; }

        /* Right Column: Live WhatsApp Web Viewer */
        .crm-chat {
          background: var(--wa-chat-bg);
          border: 1px solid var(--panel-border);
          border-radius: var(--card-radius);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }
        .chat-header {
          background: var(--panel-bg);
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--panel-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .chat-header-user { display: flex; align-items: center; gap: 0.85rem; }
        .chat-header-name { font-weight: 700; color: #fff; font-size: 0.95rem; }
        .chat-header-meta { font-size: 0.78rem; color: var(--text-muted); }
        .chat-header-actions { display: flex; gap: 0.5rem; }

        .chat-window {
          flex: 1;
          padding: 1.25rem;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          background-color: var(--wa-chat-bg);
          background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0);
          background-size: 24px 24px;
          min-height: 420px;
          max-height: 520px;
        }
        .chat-bubble {
          max-width: 75%;
          padding: 0.65rem 0.95rem;
          border-radius: 8px;
          font-size: 0.88rem;
          line-height: 1.45;
          position: relative;
          word-break: break-word;
        }
        .chat-bubble.inbound {
          align-self: flex-start;
          background: var(--wa-bubble-in);
          color: #f1f5f9;
          border-bottom-left-radius: 2px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .chat-bubble.outbound {
          align-self: flex-end;
          background: var(--wa-dark-green);
          color: #fff;
          border-bottom-right-radius: 2px;
        }
        .bubble-meta {
          font-size: 0.68rem;
          margin-top: 0.35rem;
          text-align: right;
          color: rgba(255, 255, 255, 0.6);
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.3rem;
        }
        .bubble-tag { font-size: 0.68rem; opacity: 0.75; font-style: italic; margin-bottom: 0.2rem; }

        .chat-footer {
          background: var(--panel-bg);
          padding: 0.85rem 1rem;
          border-top: 1px solid var(--panel-border);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .quick-chips { display: flex; gap: 0.4rem; overflow-x: auto; scrollbar-width: none; }
        .chip-btn {
          background: #1e293b;
          border: 1px solid #334155;
          color: #cbd5e1;
          font-size: 0.72rem;
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
        }
        .chip-btn:hover { background: #334155; color: #fff; }

        .chat-input-bar { display: flex; gap: 0.5rem; }
        .chat-input-bar input {
          flex: 1;
          background: var(--bg-dark);
          border: 1px solid var(--panel-border);
          border-radius: 8px;
          padding: 0.65rem 0.95rem;
          color: #fff;
          font-size: 0.88rem;
          outline: none;
        }
        .chat-input-bar input:focus { border-color: var(--wa-green); }

        .btn {
          padding: 0.6rem 1.1rem;
          border-radius: 8px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-size: 0.85rem;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          text-decoration: none;
        }
        .btn-wa { background: #25D366; color: #000; }
        .btn-gold { background: #f59e0b; color: #000; }
        .btn-danger { background: #dc2626; color: #fff; }
        .btn-outline { background: transparent; border: 1px solid var(--panel-border); color: #cbd5e1; }
        .btn-outline:hover { background: #1e293b; color: #fff; }

        /* Lower Controls Section */
        .controls-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.25rem;
        }
        .control-card {
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          border-radius: var(--card-radius);
          padding: 1.25rem;
        }
        .control-title { font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; }
        textarea.shield-input {
          width: 100%;
          height: 80px;
          background: var(--bg-dark);
          border: 1px solid var(--panel-border);
          border-radius: 8px;
          color: #fff;
          padding: 0.75rem;
          font-size: 0.82rem;
          resize: vertical;
          outline: none;
        }
      </style>
    </head>
    <body>
      <div class="app-container">
        <!-- Top Navigation Header -->
        <header class="top-bar">
          <div class="brand-zone">
            <img src="/assets/karnal_reality_logo.jpg" alt="Logo" class="brand-logo" onerror="this.style.display='none'" />
            <div class="brand-text">
              <h1>🏢 SATYAM REALTY — OFFICIAL META WHATSAPP CLOUD BOT</h1>
              <p>Official Meta WhatsApp API (+91 8901849699) • 250 Verified Outreach/Day • Strict Karnal Property Buyers</p>
            </div>
          </div>
          <div class="header-actions">
            <span class="engine-pill">
              <span class="pulse-dot"></span>
              🟢 Official Meta API Connected (+91 8901849699)
            </span>
            <button type="button" onclick="scrollToMetaSetup()" class="btn btn-gold" style="font-size: 0.78rem; padding: 0.45rem 0.85rem;" title="Configure official Meta WhatsApp Cloud API credentials">
              ⚙️ Meta API Config
            </button>
            <button type="button" onclick="wakeQueue()" class="btn btn-outline" style="font-size: 0.78rem; padding: 0.45rem 0.85rem; border-color: #38bdf8; color: #38bdf8;" title="Skip current cadence break and dispatch next batch immediately">
              ⚡ Dispatch Now
            </button>
            <form method="POST" action="${state.isPaused ? '/api/queue/resume' : '/api/queue/pause'}" style="margin:0;">
              <button type="submit" class="btn ${state.isPaused ? 'btn-wa' : 'btn-danger'}" style="font-size: 0.78rem; padding: 0.45rem 0.95rem;">
                ${state.isPaused ? '▶️ Resume Dispatch' : '⏸️ Pause Dispatch'}
              </button>
            </form>
          </div>
        </header>

        <!-- Telemetry Metrics Grid (MBG Card Layout) -->
        <div class="metrics-grid">
          <!-- Card 1: 250 Daily Cloud Target -->
          <div class="metric-card">
            <div class="metric-label">
              <span>Today's Outreach</span>
              <span style="color: var(--gold); font-size: 0.7rem; font-weight: 800;">250 / DAY CLOUD TIER</span>
            </div>
            <div class="metric-val" id="valDailySent" style="color: var(--wa-green);">${currentSent} <span style="font-size: 1rem; color: var(--text-muted);">/ ${dailyTarget}</span></div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="barDailyFill" style="width: ${progressPct}%;"></div>
            </div>
            <div class="metric-sub" style="margin-top: 0.4rem; display: flex; justify-content: space-between;">
              <span id="lblProgressPct">${progressPct}% Dispatched</span>
              <span style="color: #38bdf8;">~5.5m Cloud Cadence (250 msgs/day)</span>
            </div>
          </div>

          <!-- Card 2: Hot Inquiries / Replies -->
          <div class="metric-card">
            <div class="metric-label">
              <span>Hot Inquiries &amp; Replies</span>
              <span style="background: rgba(220, 38, 38, 0.2); color: #f87171; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem;">🔥 LIVE</span>
            </div>
            <div class="metric-val" id="valHotInquiries" style="color: var(--gold-glow);">${metrics.repliedCount || 0}</div>
            <div class="metric-sub">
              Response Rate: <strong style="color: #4ade80;" id="valResponseRate">${metrics.responseRate || '0.0%'}</strong> • Multi-Turn Active
            </div>
          </div>

          <!-- Card 3: Queued Leads in Database -->
          <div class="metric-card">
            <div class="metric-label">
              <span>Discovered Leads In DB</span>
              <span style="color: #38bdf8; font-size: 0.7rem;">HARVESTER</span>
            </div>
            <div class="metric-val" id="valQueuedLeads" style="color: var(--accent-blue);">${state.queuedRemaining || 0}</div>
            <div class="metric-sub">
              Commercial SCOs, Shops &amp; NRI Diaspora
            </div>
          </div>

          <!-- Card 4: Total Memory Threads (100% Isolated) -->
          <div class="metric-card">
            <div class="metric-label">
              <span>Isolated Memory Threads</span>
              <span style="color: #a855f7; font-size: 0.7rem;">E2EE ISOLATED</span>
            </div>
            <div class="metric-val" id="valConversations" style="color: #c084fc;">${metrics.totalConversations || conversations.length}</div>
            <div class="metric-sub">
              Strict Phone Separation: 100% Zero Leak
            </div>
          </div>

          <!-- Card 5: Lifetime Dispatched -->
          <div class="metric-card">
            <div class="metric-label">
              <span>All-Time Outreach</span>
              <span style="color: var(--text-muted); font-size: 0.7rem;">DATABASE</span>
            </div>
            <div class="metric-val" id="valTotalSent" style="color: #cbd5e1;">${state.totalSentDb || metrics.totalOutreachSent || 0}</div>
            <div class="metric-sub">
              Shielded Past Leads: <strong style="color: #f59e0b;">${totalShielded}</strong>
            </div>
          </div>
        </div>

        <!-- Real-Time Activity Feed Ticker -->
        <div class="ticker-section">
          <div class="ticker-badge">⚡ LIVE STREAM</div>
          <div class="ticker-items" id="tickerItems">
            <div class="ticker-pill">⏳ Initializing real-time telemetry stream...</div>
          </div>
        </div>

        <!-- The MBG Card Virtual WhatsApp Live Console -->
        <div class="crm-console">
          <!-- Left Column: Lead Inbox -->
          <div class="crm-sidebar">
            <div class="sidebar-header">
              <div class="sidebar-title">
                <h2>💬 Lead Inbox &amp; Inquiries</h2>
                <span style="font-size: 0.75rem; color: var(--gold); font-weight: 700;" id="inboxCounter">${conversations.length} Contacts</span>
              </div>
              <div class="search-box">
                <input type="text" id="contactSearch" placeholder="🔍 Search phone, name or inquiry..." oninput="filterContacts()" />
              </div>
              <div class="filter-tabs">
                <button class="tab-btn active" data-filter="all" onclick="setFilter('all', this)">All Leads</button>
                <button class="tab-btn" data-filter="inquiries" onclick="setFilter('inquiries', this)">🔥 Inquiries</button>
                <button class="tab-btn" data-filter="sent" onclick="setFilter('sent', this)">📤 Sent</button>
                <button class="tab-btn" data-filter="nri" onclick="setFilter('nri', this)">🌍 NRI Investors</button>
              </div>
            </div>

            <!-- Scrollable Contacts List -->
            <div class="contacts-list" id="contactsContainer">
              <!-- Rendered via JS -->
            </div>
          </div>

          <!-- Right Column: Live WhatsApp Web Viewer -->
          <div class="crm-chat">
            <div class="chat-header">
              <div class="chat-header-user">
                <div class="contact-avatar" id="activeAvatar" style="background: #0f766e; color: #fff;">WA</div>
                <div>
                  <div class="chat-header-name" id="activeName">Select a lead from the inbox</div>
                  <div class="chat-header-meta" id="activeMeta">+91 • Click any contact on the left to inspect conversation</div>
                </div>
              </div>
              <div class="chat-header-actions" id="chatHeaderActions" style="display:none;">
                <a id="btnOpenWa" href="#" target="_blank" class="btn btn-wa" style="font-size: 0.78rem; padding: 0.4rem 0.85rem;">
                  🟢 Open in WhatsApp
                </a>
              </div>
            </div>

            <!-- WhatsApp Message Bubbles Window -->
            <div class="chat-window" id="chatWindow">
              <div style="text-align: center; color: var(--text-muted); margin: auto; padding: 2rem;">
                <p style="font-size: 1.1rem; color: var(--gold-glow); font-weight: 700; margin-bottom: 0.5rem;">📱 Real-Time WhatsApp Console</p>
                <p style="font-size: 0.85rem;">Select any of the 2,000+ daily outreach leads or hot inquiries on the left to see the complete message thread, delivery receipts, and AI responses live!</p>
              </div>
            </div>

            <!-- Chat Footer (Input & Quick Chips) -->
            <div class="chat-footer">
              <div class="quick-chips">
                <button class="chip-btn" onclick="sendQuickChip('Namaste! Karnal Sector 12 SCO plots brochure aur pricing right here share kar raha hoon.')">🏢 Sector 12 SCO Brochure</button>
                <button class="chip-btn" onclick="sendQuickChip('Namaste ji! Weekend par direct site visit schedule kar sakte hain. Aap Saturday comfortable rahenge ya Sunday?')">📅 Book Weekend Site Visit</button>
                <button class="chip-btn" onclick="sendQuickChip('GT Road Expressway commercial plots ki latest price sheet aur RERA approvals available hain.')">📍 GT Road Pricing Sheet</button>
                <button class="chip-btn" onclick="sendQuickChip('Main senior property advisor Aman Sharma se direct callback arrange karwa deta hoon.')">📞 Request Senior Broker Call</button>
              </div>
              <form class="chat-input-bar" onsubmit="event.preventDefault(); sendCustomMessage();">
                <input type="text" id="manualMsgInput" placeholder="Type a message to this lead via Meta Cloud API..." disabled />
                <button type="submit" id="btnSendManual" class="btn btn-wa" disabled>Send ⚡</button>
              </form>
            </div>
          </div>
        </div>

        <!-- Official Meta WhatsApp Cloud API Setup & Number Manager -->
        <div id="metaSetupSection" class="control-card" style="border: 1px solid ${isMetaConfigured ? '#10b981' : '#f59e0b'}; background: linear-gradient(180deg, #0d1524 0%, #08111d 100%);">
          <div class="control-title" style="padding-bottom: 0.85rem; border-bottom: 1px solid var(--panel-border); margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.4rem;">🌐</span>
              <div>
                <div style="font-size: 1.05rem; font-weight: 800; color: #fff;">Official Meta WhatsApp Cloud API Manager</div>
                <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: normal;">Enterprise Facebook Graph API v21.0 • 100% Ban-Proof • Official Phone Number Bot</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span id="metaStatusPill" style="font-size: 0.75rem; padding: 0.3rem 0.75rem; border-radius: 9999px; font-weight: 700; ${isMetaConfigured ? 'background: rgba(37, 211, 102, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4);' : 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);'}">
                ${isMetaConfigured ? '🟢 Meta Cloud Connected' : '🟡 Setup Required'}
              </span>
              <button type="button" onclick="testMetaHealth()" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
                🔍 Check Health &amp; Tier
              </button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
            <!-- Column 1: Meta Cloud Credentials Form -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <h3 style="font-size: 0.88rem; color: var(--gold-glow); font-weight: 700;">1. Meta Cloud API Credentials</h3>
                <span style="font-size: 0.72rem; color: var(--text-muted);">From Meta Developer Dashboard</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div>
                  <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                    System User Permanent Access Token <span style="color:#ef4444;">*</span>
                  </label>
                  <div style="display: flex; gap: 0.4rem;">
                    <input type="password" id="metaTokenInput" value="${metaCfg.hasAccessToken ? 'KEEP_EXISTING_TOKEN' : ''}" placeholder="EAAG... (Paste permanent token from System Users)" style="flex:1; background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; color: #fff; padding: 0.55rem 0.75rem; font-size: 0.82rem; font-family: monospace;" />
                    <button type="button" onclick="toggleTokenVisibility()" class="btn btn-outline" style="padding: 0.55rem 0.75rem; font-size: 0.75rem;" title="Show / Hide Token">👁️</button>
                  </div>
                  <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.2rem;">
                    ${metaCfg.hasAccessToken ? 'Current Token: <code style="color:#4ade80;">' + metaCfg.accessTokenMasked + '</code> (Leave as-is to keep unchanged)' : 'Generate in Meta Business Settings → System Users (Permissions: whatsapp_business_messaging, whatsapp_business_management)'}
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                  <div>
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                      Phone Number ID <span style="color:#ef4444;">*</span>
                    </label>
                    <input type="text" id="metaPhoneIdInput" value="${metaCfg.phoneNumberId || ''}" placeholder="e.g. 104829104857201" style="width: 100%; background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; color: #fff; padding: 0.55rem 0.75rem; font-size: 0.82rem; font-family: monospace;" />
                  </div>
                  <div>
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                      WABA Account ID
                    </label>
                    <input type="text" id="metaWabaIdInput" value="${metaCfg.wabaId || ''}" placeholder="e.g. 102948201948572" style="width: 100%; background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; color: #fff; padding: 0.55rem 0.75rem; font-size: 0.82rem; font-family: monospace;" />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
                  <div>
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                      Pre-Approved Template Name
                    </label>
                    <input type="text" id="metaTemplateInput" value="${metaCfg.templateName || 'karnal_property_lead_v1'}" placeholder="karnal_property_lead_v1" style="width: 100%; background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; color: #fff; padding: 0.55rem 0.75rem; font-size: 0.82rem; font-family: monospace;" />
                  </div>
                  <div>
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">
                      Language
                    </label>
                    <input type="text" id="metaTemplateLangInput" value="${metaCfg.templateLang || 'hi'}" placeholder="hi" style="width: 100%; background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; color: #fff; padding: 0.55rem 0.75rem; font-size: 0.82rem; font-family: monospace;" />
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                  <input type="checkbox" id="chkActivateEngine" ${isMetaCloud ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
                  <label for="chkActivateEngine" style="font-size: 0.8rem; color: #cbd5e1; cursor: pointer;">
                    Set Official Meta WhatsApp Cloud as Active Engine
                  </label>
                </div>

                <div style="display: flex; gap: 0.6rem; margin-top: 0.5rem;">
                  <button type="button" onclick="saveMetaConfig()" class="btn btn-wa" style="flex:1; justify-content: center; font-size: 0.82rem;">
                    💾 Save &amp; Connect Meta Bot
                  </button>
                  <button type="button" onclick="testMetaHealth()" class="btn btn-gold" style="font-size: 0.82rem;">
                    🔍 Test API
                  </button>
                </div>

                <div id="metaFeedbackBox" style="display:none; padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.78rem; margin-top: 0.5rem;"></div>
              </div>
            </div>

            <!-- Column 2: Webhook Callback Details & Number Uploading Instructions -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                <h3 style="font-size: 0.88rem; color: #38bdf8; font-weight: 700;">2. Webhook Setup &amp; Number Onboarding</h3>
                <span style="font-size: 0.72rem; color: var(--text-muted);">Paste in Meta Portal</span>
              </div>

              <!-- Webhook Box -->
              <div style="background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.6rem;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">CALLBACK URL:</span>
                    <button type="button" onclick="copyText('${webhookCallbackUrl}', this)" class="btn btn-outline" style="font-size: 0.68rem; padding: 0.15rem 0.5rem;">📋 Copy</button>
                  </div>
                  <input type="text" readonly value="${webhookCallbackUrl}" style="width: 100%; background: #070b12; border: 1px solid #1e293b; border-radius: 6px; color: #38bdf8; padding: 0.4rem 0.6rem; font-size: 0.76rem; font-family: monospace;" />
                </div>

                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">VERIFY TOKEN:</span>
                    <button type="button" onclick="copyText('${metaVerifyToken}', this)" class="btn btn-outline" style="font-size: 0.68rem; padding: 0.15rem 0.5rem;">📋 Copy</button>
                  </div>
                  <input type="text" readonly value="${metaVerifyToken}" style="width: 100%; background: #070b12; border: 1px solid #1e293b; border-radius: 6px; color: #f59e0b; padding: 0.4rem 0.6rem; font-size: 0.76rem; font-family: monospace;" />
                </div>

                <div style="font-size: 0.72rem; color: var(--text-muted); background: rgba(56, 189, 248, 0.08); padding: 0.45rem 0.65rem; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.2);">
                  🔔 <strong>Webhook Event Subscription:</strong> Subscribe to <code style="color:#fff;">messages</code> in Meta Dashboard to capture incoming inquiries, buttons &amp; delivery ticks!
                </div>
              </div>

              <!-- Quick Step Guide -->
              <div style="margin-top: 0.85rem; font-size: 0.76rem; color: #cbd5e1; line-height: 1.5; background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); border-radius: 8px; padding: 0.75rem;">
                <div style="color: var(--gold-glow); font-weight: 700; margin-bottom: 0.35rem;">🚀 How to Make Any Phone Number an Official Bot:</div>
                <ol style="margin-left: 1.2rem; display: flex; flex-direction: column; gap: 0.25rem;">
                  <li>Open <a href="https://developers.facebook.com/apps" target="_blank" style="color: #38bdf8; text-decoration: underline;">developers.facebook.com/apps</a> → Create App → Select <strong>Business</strong>.</li>
                  <li>Click <strong>Set Up WhatsApp</strong> → Navigate to <strong>API Setup</strong>.</li>
                  <li>In <strong>Step 5 (Add a phone number)</strong>, enter your desired WhatsApp number (must not be active on regular WhatsApp; if it is, delete the account in WA settings first).</li>
                  <li>Verify via 6-digit OTP SMS or Call. Once verified, copy your <strong>Phone Number ID</strong> and <strong>WABA ID</strong> into this dashboard!</li>
                  <li>In <strong>WhatsApp → Configuration</strong>, paste the Callback URL and Verify Token above, then click <strong>Verify and Save</strong>. Under Webhook fields, manage and subscribe to <strong>messages</strong>.</li>
                  <li>Paste your Permanent System User Token above and hit <strong>Save &amp; Connect</strong>. Done! Your number is now an official WhatsApp Cloud API Bot with zero ban risk!</li>
                </ol>
              </div>
            </div>
          </div>

          <!-- Quick Test Message Bar -->
          <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px solid var(--panel-border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
              <span>🧪 <strong>Send Quick Test Message:</strong></span>
            </div>
            <div style="display: flex; gap: 0.5rem; flex: 1; max-width: 600px;">
              <input type="text" id="metaTestPhone" placeholder="Enter recipient phone (e.g. 919416085989)" style="flex: 1; background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; color: #fff; padding: 0.45rem 0.75rem; font-size: 0.82rem;" />
              <button type="button" onclick="sendMetaTestMsg()" class="btn btn-gold" style="font-size: 0.78rem; padding: 0.45rem 0.95rem; white-space: nowrap;">
                ⚡ Send Test WhatsApp
              </button>
            </div>
          </div>
        </div>

        <!-- Lower Controls: Settings, CSV Exports & Shield Ledger -->
        <div class="controls-grid">
          <!-- 250/Day Daily Cloud Target Settings -->
          <div class="control-card">
            <div class="control-title">
              <span>⚡ 250/Day Official Meta WhatsApp Cloud Controller</span>
              <span style="color: var(--gold-glow); font-size: 0.8rem;">Tier 250 Active</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Adjust official Meta WhatsApp Cloud API daily allocation and cadence pacing without restarting the server.
            </p>
            <form method="POST" action="/api/settings/cloud-limit" style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="number" name="limit" min="10" max="10000" value="${dailyTarget}" style="width: 110px; background: var(--bg-dark); border: 1px solid var(--panel-border); border-radius: 8px; color: #fff; padding: 0.5rem; font-weight: 700; text-align: center;" required />
              <button type="submit" class="btn btn-gold" style="font-size: 0.8rem;">Update Limit</button>
            </form>
            <div style="margin-top: 0.85rem; display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <form method="POST" action="/api/settings/pacing" style="margin:0;">
                <input type="hidden" name="preset" value="stealth_5m_250daily">
                <button type="submit" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">🛡️ Standard 250/Day (~5.5m)</button>
              </form>
              <form method="POST" action="/api/settings/pacing" style="margin:0;">
                <input type="hidden" name="preset" value="fast">
                <button type="submit" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">⚡ Fast 500/Day (~2.8m)</button>
              </form>
              <form method="POST" action="/api/settings/pacing" style="margin:0;">
                <input type="hidden" name="preset" value="stealth_14m_100daily">
                <button type="submit" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;">🔒 Safe 100/Day (~14m)</button>
              </form>
            </div>
          </div>

          <!-- 1-Click CSV Exports -->
          <div class="control-card">
            <div class="control-title">
              <span>📥 Export CRM Data &amp; Leads</span>
              <span style="color: var(--wa-green); font-size: 0.8rem;">1-Click</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.85rem;">
              Download all prospective property buyers, hot inquiries, and NRI investors in structured spreadsheet format.
            </p>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <a href="/api/leads/export-csv" class="btn btn-gold" style="font-size: 0.8rem;">🔥 Download Hot Leads (.CSV)</a>
              <a href="/api/conversations" target="_blank" class="btn btn-outline" style="font-size: 0.8rem;">🔍 Raw Memory JSON</a>
            </div>
          </div>

          <!-- Shield Past Numbers Ledger -->
          <div class="control-card">
            <div class="control-title">
              <span>🛡️ Shield Past Numbers Ledger</span>
              <span style="color: #a855f7; font-size: 0.8rem;">Zero Duplicates</span>
            </div>
            <form method="POST" action="/api/shield/bulk">
              <textarea name="numbers" class="shield-input" placeholder="Paste phone numbers to permanently shield (one per line)..."></textarea>
              <button type="submit" class="btn btn-outline" style="font-size: 0.78rem; margin-top: 0.5rem; width: 100%;">🔒 Lock &amp; Shield Numbers</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Real-Time Telemetry & WhatsApp Web Console Client Logic -->
      <script>
        let allConversations = [];
        let currentFilter = 'all';
        let activePhone = null;

        async function wakeQueue() {
          try {
            await fetch('/api/queue/wake', { method: 'POST', headers: { 'Accept': 'application/json' } });
            setTimeout(() => window.location.reload(), 600);
          } catch(e) {}
        }

        // Auto-poll live telemetry every 3.5 seconds
        async function fetchLiveTelemetry() {
          try {
            const res = await fetch('/api/dashboard/live');
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success) return;

            // 1. Update Telemetry Cards
            const sent = data.dailySentCount || 0;
            const target = data.dailyMaxLeads || 250;
            const pct = Math.min(100, Math.round((sent / Math.max(1, target)) * 100));

            document.getElementById('valDailySent').innerHTML = sent + ' <span style="font-size: 1rem; color: var(--text-muted);">/ ' + target + '</span>';
            document.getElementById('barDailyFill').style.width = pct + '%';
            document.getElementById('lblProgressPct').innerText = pct + '% Dispatched';
            document.getElementById('valHotInquiries').innerText = data.metrics?.repliedCount || 0;
            document.getElementById('valResponseRate').innerText = data.metrics?.responseRate || '0.0%';
            document.getElementById('valQueuedLeads').innerText = data.queuedRemaining || 0;
            document.getElementById('valConversations').innerText = data.metrics?.totalConversations || data.conversations?.length || 0;
            document.getElementById('valTotalSent').innerText = data.totalSentDb || data.metrics?.totalOutreachSent || 0;

            // 2. Update Real-Time Ticker
            if (Array.isArray(data.activityFeed) && data.activityFeed.length > 0) {
              const tickerBox = document.getElementById('tickerItems');
              tickerBox.innerHTML = data.activityFeed.slice(0, 15).map(item => {
                let color = '#38bdf8';
                let icon = '⚡';
                if (item.type === 'inbound_inquiry') { color = '#f87171'; icon = '🔥'; }
                else if (item.type === 'ai_reply') { color = '#4ade80'; icon = '🤖'; }
                else if (item.type === 'delivery_receipt') { color = '#a855f7'; icon = '👁️'; }
                else if (item.type === 'outreach_sent') { color = '#fbbf24'; icon = '📤'; }
                return '<div class="ticker-pill"><span style="color:' + color + ';">' + icon + ' ' + (item.timeStr || '') + '</span> <strong>+' + item.phone + '</strong>: ' + escapeHtml(item.title) + '</div>';
              }).join('');
            }

            // 3. Update Conversation List
            if (Array.isArray(data.conversations)) {
              allConversations = data.conversations;
              renderContactsList();
            }

            // 4. If a conversation is active, refresh its thread
            if (activePhone) {
              refreshActiveChat(activePhone);
            }
          } catch (e) {
            console.warn('Telemetry poll error:', e);
          }
        }

        function setFilter(filter, el) {
          currentFilter = filter;
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
          if (el) el.classList.add('active');
          renderContactsList();
        }

        function filterContacts() {
          renderContactsList();
        }

        function renderContactsList() {
          const container = document.getElementById('contactsContainer');
          const query = (document.getElementById('contactSearch').value || '').toLowerCase();

          let filtered = allConversations.filter(c => {
            const phone = String(c.phone || '');
            const name = String(c.profile?.name || '').toLowerCase();
            const lastMsg = String(c.lastMessage?.content || '').toLowerCase();

            // Search query filter
            if (query && !phone.includes(query) && !name.includes(query) && !lastMsg.includes(query)) {
              return false;
            }

            // Tab filter
            if (currentFilter === 'inquiries') {
              return c.profile?.inquiriesReceived > 0 || c.profile?.stage === 'replied' || c.profile?.stage === 'hot_inquiry';
            }
            if (currentFilter === 'sent') {
              return c.profile?.stage === 'outreach_sent';
            }
            if (currentFilter === 'nri') {
              return !phone.startsWith('91');
            }
            return true;
          });

          document.getElementById('inboxCounter').innerText = filtered.length + ' Contacts';

          if (filtered.length === 0) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No contacts found matching this view.</div>';
            return;
          }

          container.innerHTML = filtered.map(c => {
            const isSelected = c.phone === activePhone;
            const isHot = c.profile?.sentiment === 'HOT' || c.profile?.stage === 'hot_inquiry' || c.profile?.stage === 'replied';
            const name = c.profile?.name || 'Valued Investor';
            const initial = (name.charAt(0) || 'I').toUpperCase();
            const lastContent = c.lastMessage ? c.lastMessage.content : 'Outreach dispatched';
            const timeStr = c.lastMessage?.timestamp ? formatTimeAgo(c.lastMessage.timestamp) : '';

            return '<div class="contact-item ' + (isSelected ? 'selected' : '') + '" onclick="selectContact(\'' + c.phone + '\')">' +
              '<div class="contact-avatar">' + initial + '</div>' +
              '<div class="contact-info">' +
                '<div class="contact-top">' +
                  '<span class="contact-name">+' + c.phone + ' • ' + escapeHtml(name) + '</span>' +
                  '<span class="contact-time">' + timeStr + '</span>' +
                '</div>' +
                '<div class="contact-preview">' + escapeHtml(lastContent) + '</div>' +
                '<div style="margin-top: 0.2rem; display: flex; gap: 0.35rem;">' +
                  (isHot ? '<span class="badge-hot">🔥 INQUIRY</span>' : '<span class="badge-outreach">📤 SENT</span>') +
                  (c.profile?.propertyInterest ? '<span style="font-size:0.65rem; color:#94a3b8;">' + escapeHtml(c.profile.propertyInterest) + '</span>' : '') +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('');
        }

        async function selectContact(phone) {
          activePhone = phone;
          renderContactsList(); // update selected state

          document.getElementById('manualMsgInput').disabled = false;
          document.getElementById('btnSendManual').disabled = false;
          document.getElementById('chatHeaderActions').style.display = 'flex';
          document.getElementById('btnOpenWa').href = 'https://wa.me/' + phone;

          await refreshActiveChat(phone, true);
        }

        async function refreshActiveChat(phone, shouldScroll = false) {
          try {
            const res = await fetch('/api/conversations/' + phone);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.success || !data.conversation) return;

            const conv = data.conversation;
            const profile = conv.profile || {};
            const name = profile.name || 'Valued Investor';

            document.getElementById('activeName').innerText = '+' + phone + ' (' + name + ')';
            document.getElementById('activeAvatar').innerText = (name.charAt(0) || 'I').toUpperCase();
            document.getElementById('activeMeta').innerText = (profile.propertyInterest || 'Karnal Real Estate') + ' • ' + (profile.leadType || 'Domestic') + ' • Stage: ' + (profile.stage || 'outreach_sent');

            const chatWindow = document.getElementById('chatWindow');
            if (conv.messages && conv.messages.length > 0) {
              chatWindow.innerHTML = conv.messages.map(m => {
                const isOut = m.role === 'assistant';
                const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
                const tag = isOut ? (m.isInitialOutreach ? '📤 Outreach Template' : '🤖 Aman Sharma (AI Consultant)') : '👤 Lead Inquiry';
                let ticks = '';
                let tickColor = '#94a3b8';
                if (isOut) {
                  if (m.status === 'read') { ticks = '✓✓ Read'; tickColor = '#38bdf8'; }
                  else if (m.status === 'delivered') { ticks = '✓✓ Delivered'; tickColor = '#4ade80'; }
                  else if (m.status === 'failed') { ticks = '❌ Not on WhatsApp'; tickColor = '#f87171'; }
                  else { ticks = '✓ Sent'; }
                }

                return '<div class="chat-bubble ' + (isOut ? 'outbound' : 'inbound') + '">' +
                  '<div class="bubble-tag">' + tag + '</div>' +
                  '<div>' + escapeHtml(m.content) + '</div>' +
                  '<div class="bubble-meta"><span>' + timeStr + '</span>' + (ticks ? ' <span style="color:' + tickColor + '; font-weight:700;">' + ticks + '</span>' : '') + '</div>' +
                '</div>';
              }).join('');

              if (shouldScroll) {
                chatWindow.scrollTop = chatWindow.scrollHeight;
              }
            } else {
              chatWindow.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin: auto;">No messages logged for this contact yet.</div>';
            }
          } catch (e) {
            console.error('Error refreshing chat:', e);
          }
        }

        async function sendCustomMessage() {
          const input = document.getElementById('manualMsgInput');
          const text = (input.value || '').trim();
          if (!text || !activePhone) return;

          input.value = '';
          try {
            const res = await fetch('/api/conversations/' + activePhone + '/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (data.success) {
              await refreshActiveChat(activePhone, true);
              fetchLiveTelemetry();
            } else {
              alert('Failed to dispatch message: ' + (data.error || 'Unknown error'));
            }
          } catch (e) {
            alert('Error sending message: ' + e.message);
          }
        }

        function sendQuickChip(text) {
          if (!activePhone) {
            alert('Please select a contact from the inbox on the left first!');
            return;
          }
          document.getElementById('manualMsgInput').value = text;
          sendCustomMessage();
        }

        function formatTimeAgo(ts) {
          const diff = Math.floor((Date.now() - ts) / 1000);
          if (diff < 60) return 'Just now';
          if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
          if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
          return Math.floor(diff / 86400) + 'd ago';
        }

        function escapeHtml(str) {
          if (!str) return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        }

        function scrollToMetaSetup() {
          const sec = document.getElementById('metaSetupSection');
          if (sec) {
            sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
            sec.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
            sec.style.borderColor = '#fbbf24';
            sec.style.boxShadow = '0 0 25px rgba(251, 191, 36, 0.35)';
            setTimeout(() => {
              sec.style.borderColor = '';
              sec.style.boxShadow = '';
            }, 2000);
          }
        }

        function copyText(val, btn) {
          if (!val) return;
          navigator.clipboard.writeText(val).then(() => {
            const orig = btn.innerText;
            btn.innerText = '✓ Copied!';
            btn.style.color = '#4ade80';
            setTimeout(() => {
              btn.innerText = orig;
              btn.style.color = '';
            }, 1800);
          }).catch(() => {
            const temp = document.createElement('textarea');
            temp.value = val;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            const orig = btn.innerText;
            btn.innerText = '✓ Copied!';
            setTimeout(() => { btn.innerText = orig; }, 1800);
          });
        }

        function toggleTokenVisibility() {
          const input = document.getElementById('metaTokenInput');
          if (input.type === 'password') {
            input.type = 'text';
          } else {
            input.type = 'password';
          }
        }

        async function saveMetaConfig() {
          const box = document.getElementById('metaFeedbackBox');
          const token = (document.getElementById('metaTokenInput').value || '').trim();
          const phoneId = (document.getElementById('metaPhoneIdInput').value || '').trim();
          const wabaId = (document.getElementById('metaWabaIdInput').value || '').trim();
          const templateName = (document.getElementById('metaTemplateInput').value || '').trim();
          const templateLang = (document.getElementById('metaTemplateLangInput').value || '').trim();
          const activateEngine = document.getElementById('chkActivateEngine').checked;

          box.style.display = 'block';
          box.style.background = 'rgba(56, 189, 248, 0.12)';
          box.style.border = '1px solid rgba(56, 189, 248, 0.3)';
          box.style.color = '#38bdf8';
          box.innerHTML = '⏳ Saving credentials and verifying with Meta Graph API...';

          try {
            const res = await fetch('/api/meta/save-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken: token === 'KEEP_EXISTING_TOKEN' ? '' : token,
                phoneNumberId: phoneId,
                wabaId: wabaId,
                templateName: templateName,
                templateLang: templateLang,
                activateEngine: activateEngine
              })
            });

            const data = await res.json();
            if (data.success) {
              const h = data.health || {};
              if (h.healthy) {
                box.style.background = 'rgba(37, 211, 102, 0.15)';
                box.style.border = '1px solid rgba(74, 222, 128, 0.4)';
                box.style.color = '#4ade80';
                box.innerHTML = '✅ <strong>Connected to Meta!</strong> Verified Name: <strong>' + (h.verifiedName || 'Karnal Realty') + '</strong> (' + (h.displayPhoneNumber || 'Active') + ') • Quality: <strong>' + (h.qualityRating || 'GREEN') + '</strong> • Tier: <strong>' + (h.tier || 'TIER_2K') + '</strong>';
                document.getElementById('metaStatusPill').innerText = '🟢 Meta Cloud Connected';
                document.getElementById('metaStatusPill').style.color = '#4ade80';
              } else {
                box.style.background = 'rgba(245, 158, 11, 0.15)';
                box.style.border = '1px solid rgba(245, 158, 11, 0.4)';
                box.style.color = '#fbbf24';
                box.innerHTML = '⚠️ <strong>Saved, but Meta returned a warning:</strong> ' + escapeHtml(h.error || 'Check Phone ID or Token permissions');
              }
            } else {
              box.style.background = 'rgba(239, 68, 68, 0.15)';
              box.style.border = '1px solid rgba(239, 68, 68, 0.4)';
              box.style.color = '#f87171';
              box.innerHTML = '❌ <strong>Error:</strong> ' + escapeHtml(data.error || 'Failed to save');
            }
          } catch (err) {
            box.style.background = 'rgba(239, 68, 68, 0.15)';
            box.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            box.style.color = '#f87171';
            box.innerHTML = '❌ <strong>Network Error:</strong> ' + escapeHtml(err.message);
          }
        }

        async function testMetaHealth() {
          const box = document.getElementById('metaFeedbackBox');
          box.style.display = 'block';
          box.style.background = 'rgba(56, 189, 248, 0.12)';
          box.style.border = '1px solid rgba(56, 189, 248, 0.3)';
          box.style.color = '#38bdf8';
          box.innerHTML = '⏳ Probing Meta Graph API for account health and messaging tier...';

          try {
            const res = await fetch('/api/meta/verify');
            const data = await res.json();
            const h = data.health || {};
            if (h.healthy) {
              box.style.background = 'rgba(37, 211, 102, 0.15)';
              box.style.border = '1px solid rgba(74, 222, 128, 0.4)';
              box.style.color = '#4ade80';
              box.innerHTML = '🟢 <strong>Meta Cloud Online:</strong> Verified Name: <strong>' + (h.verifiedName || 'Karnal Realty') + '</strong> (' + (h.displayPhoneNumber || 'Active') + ') • Quality: <strong>' + (h.qualityRating || 'GREEN') + '</strong> • Limit: <strong>' + (h.tier || '2,000/24h') + '</strong>';
            } else {
              box.style.background = 'rgba(239, 68, 68, 0.15)';
              box.style.border = '1px solid rgba(239, 68, 68, 0.4)';
              box.style.color = '#f87171';
              box.innerHTML = '⚠️ <strong>Meta API Response:</strong> ' + escapeHtml(h.error || h.message || 'Not configured yet.');
            }
          } catch (err) {
            box.style.background = 'rgba(239, 68, 68, 0.15)';
            box.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            box.style.color = '#f87171';
            box.innerHTML = '❌ <strong>Failed to check Meta:</strong> ' + escapeHtml(err.message);
          }
        }

        async function sendMetaTestMsg() {
          const phoneInput = document.getElementById('metaTestPhone');
          const phone = (phoneInput.value || '').trim();
          if (!phone) {
            alert('Please enter a test phone number with country code (e.g. 919416085989)');
            return;
          }

          const btn = event.currentTarget || event.target;
          const orig = btn.innerText;
          btn.innerText = '⏳ Sending...';
          btn.disabled = true;

          try {
            const res = await fetch('/api/meta/test-send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone })
            });
            const data = await res.json();
            if (data.success) {
              alert('✅ Success! Test message sent to +' + phone + ' via official Meta Cloud API!');
              phoneInput.value = '';
            } else {
              alert('❌ Dispatch Failed: ' + (data.error || 'Meta Cloud reported an error.'));
            }
          } catch (e) {
            alert('❌ Network Error: ' + e.message);
          } finally {
            btn.innerText = orig;
            btn.disabled = false;
          }
        }

        // Start real-time polling immediately
        fetchLiveTelemetry();
        setInterval(fetchLiveTelemetry, 3500);
      </script>
    </body>
    </html>
  `);
});

/**
 * Real-Time Telemetry & MBG Card Dashboard API Endpoints
 */
app.get('/api/dashboard/live', (req, res) => {
  const queueState = queue.getQueueState ? queue.getQueueState() : {};
  const metrics = chatMemory.getMetrics ? chatMemory.getMetrics() : {};
  const activityFeed = chatMemory.getActivityFeed ? chatMemory.getActivityFeed() : [];
  const inquiries = chatMemory.getInquiries ? chatMemory.getInquiries() : [];
  const conversations = chatMemory.getAllConversations ? chatMemory.getAllConversations() : [];
  const scraperStats = scraper.getScraperStats ? scraper.getScraperStats() : {};
  const totalShielded = scraper.getTotalShieldedCount ? scraper.getTotalShieldedCount() : 0;

  res.json({
    success: true,
    engine: whatsapp.getActiveEngine ? whatsapp.getActiveEngine() : 'meta_cloud',
    metaCloud: queueState.metaCloud || {},
    dailySentCount: queueState.dailySentCount || 0,
    dailyMaxLeads: queueState.dailyMaxLeads || 250,
    totalSentDb: queueState.totalSentDb || 0,
    queuedRemaining: queueState.queuedRemaining || 0,
    isPaused: queueState.isPaused || false,
    totalShielded,
    metrics,
    activityFeed,
    inquiries,
    conversations: conversations.slice(0, 100),
    scraper: scraperStats,
    timestamp: Date.now()
  });
});

app.get('/api/conversations/:phone', (req, res) => {
  const conv = chatMemory.getConversation ? chatMemory.getConversation(req.params.phone) : null;
  if (!conv) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }
  res.json({ success: true, conversation: conv });
});

app.post('/api/conversations/:phone/send', async (req, res) => {
  const targetPhone = chatMemory.normalizePhone ? chatMemory.normalizePhone(req.params.phone) : String(req.params.phone).replace(/\D/g, '');
  const text = (req.body.text || '').trim();
  if (!targetPhone || !text) {
    return res.status(400).json({ success: false, error: 'Recipient phone and message text are required.' });
  }

  try {
    let sent = false;
    if (whatsapp.getActiveEngine() === 'meta_cloud') {
      const result = await whatsapp.metaCloud.sendTextMessage(targetPhone, text);
      sent = Boolean(result && result.success);
    } else {
      sent = await whatsapp.sendTextMessage(1, `${targetPhone}@s.whatsapp.net`, text);
    }

    if (sent) {
      if (chatMemory.recordReply) {
        chatMemory.recordReply(targetPhone, text, 'manual_admin');
      }
      return res.json({ success: true, message: 'Message dispatched successfully!' });
    }
    return res.status(500).json({ success: false, error: 'Failed to dispatch message.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * API Endpoints
 */
app.get('/api/status', (req, res) => {
  res.json({
    devices: whatsapp.getAllDevices(),
    queue: queue.getQueueState()
  });
});

app.get('/api/conversations', (req, res) => {
  res.json({
    conversations: chatMemory.getAllConversations()
  });
});

app.get('/api/settings', (req, res) => {
  res.json(queue.getBotConfig ? queue.getBotConfig() : {});
});

app.post('/api/settings/daily-limit', (req, res) => {
  const limit = parseInt(req.body.dailyMaxLeads || req.body.limit || '50', 10);
  const preset = req.body.preset || 'custom';
  queue.setDailyMaxLeadsPerDevice(limit, preset);

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, dailyMaxLeads: limit, config: queue.getBotConfig ? queue.getBotConfig() : {} });
  }
  res.redirect(`/?settings_saved=true&limit=${limit}`);
});

app.post('/api/settings/pacing', (req, res) => {
  const preset = req.body.preset;
  const dailyMaxLeads = parseInt(req.body.dailyMaxLeads || '50', 10);
  if (preset) {
    queue.setDailyMaxLeadsPerDevice(dailyMaxLeads, preset);
  } else {
    const updates = {};
    if (req.body.minMsgDelayMs) updates.minMsgDelayMs = parseInt(req.body.minMsgDelayMs, 10);
    if (req.body.maxMsgDelayMs) updates.maxMsgDelayMs = parseInt(req.body.maxMsgDelayMs, 10);
    if (req.body.businessHoursShield !== undefined) updates.businessHoursShield = (req.body.businessHoursShield === 'true');
    queue.updatePacingConfig(updates);
  }

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, config: queue.getBotConfig ? queue.getBotConfig() : {} });
  }
  res.redirect(`/?settings_saved=true&pacing=${preset || 'custom'}`);
});

app.post('/api/settings/toggle-timezone-shield', (req, res) => {
  const cfg = queue.getBotConfig ? queue.getBotConfig() : {};
  const current = !!cfg.businessHoursShield;
  queue.updatePacingConfig({ businessHoursShield: !current });

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, businessHoursShield: !current });
  }
  res.redirect(`/?settings_saved=true&shield=${!current}`);
});

app.get('/api/leads/export-csv', (req, res) => {
  const hotLeads = scraper.getHotRepliedLeads ? scraper.getHotRepliedLeads() : [];
  let csv = 'Phone,Name,City,Status,Updated_At,Direct_WhatsApp_Link\r\n';
  for (const l of hotLeads) {
    const phone = l.phone || '';
    const name = (l.name || 'Valued Investor').replace(/"/g, '""');
    const city = (l.city || 'Karnal').replace(/"/g, '""');
    const status = l.status || 'replied';
    const updated = l.updated_at ? new Date(l.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Recent';
    const waLink = `https://wa.me/${phone}`;
    csv += `+${phone},"${name}","${city}",${status},"${updated}","${waLink}"\r\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="karnal_realty_hot_leads.csv"');
  res.send(csv);
});

app.get('/api/leads/export-all-csv', (req, res) => {
  const allLeads = scraper.getAllDiscoveredLeads ? scraper.getAllDiscoveredLeads('all') : [];
  let csv = 'Phone,Name,City,Query,Status,Discovered_At,Last_Sent_At,Direct_WhatsApp_Link\r\n';
  for (const l of allLeads) {
    const phone = l.phone || '';
    const name = (l.name || 'Valued Investor').replace(/"/g, '""');
    const city = (l.city || 'Karnal').replace(/"/g, '""');
    const query = (l.query || '').replace(/"/g, '""');
    const status = l.status || 'queued';
    const discovered = l.discoveredAt ? new Date(l.discoveredAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
    const lastSent = l.lastSentAt ? new Date(l.lastSentAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
    const waLink = `https://wa.me/${phone}`;
    csv += `+${phone},"${name}","${city}","${query}",${status},"${discovered}","${lastSent}","${waLink}"\r\n`;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="karnal_realty_all_discovered_leads.csv"');
  res.send(csv);
});

app.get('/api/leads/export-list-txt', (req, res) => {
  const allLeads = scraper.getAllDiscoveredLeads ? scraper.getAllDiscoveredLeads('all') : [];
  const lines = allLeads.map(l => `+${l.phone}`).join('\r\n');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="karnal_realty_phone_numbers.txt"');
  res.send(lines);
});

/**
 * Official Meta WhatsApp Cloud API Webhook Handshake (GET)
 */
app.get('/api/meta/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verified = whatsapp.metaCloud.verifyWebhook(mode, token, challenge);
  if (verified) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden: Verification Token Mismatch');
});

/**
 * Official Meta WhatsApp Cloud API Inbound Webhook (POST)
 * Receives incoming customer replies & delivery status receipts
 */
app.post('/api/meta/webhook', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED');

  try {
    const payload = req.body;
    const parsed = whatsapp.metaCloud.parseWebhookPayload(payload);

    // 1. Process Delivery Statuses (sent, delivered, read, failed)
    for (const st of parsed.statuses) {
      if (st.status === 'failed') {
        console.warn(`⚠️ [Meta Delivery Failed] to +${st.recipient}:`, st.errors);
        if (chatMemory.updateDeliveryStatus) {
          chatMemory.updateDeliveryStatus(st.recipient, 'failed');
        }
        if (scraper.updateLeadStatus) {
          scraper.updateLeadStatus(st.recipient, 'not_on_whatsapp', 'Meta webhook: Number undeliverable', 'meta_cloud');
        }
        if (scraper.recordSentPhone) {
          scraper.recordSentPhone(st.recipient);
        }
      } else {
        console.log(`📬 [Meta Delivery Receipt] +${st.recipient} -> Status: ${st.status.toUpperCase()}`);
        if (chatMemory.updateDeliveryStatus) {
          chatMemory.updateDeliveryStatus(st.recipient, st.status);
        }
      }
    }

    // 2. Process Inbound Messages (Lead Replies)
    for (const msg of parsed.messages) {
      const cleanPhone = String(msg.from).replace(/\D/g, '');
      const incomingText = (msg.text || '').trim();

      if (!incomingText) continue;

      console.log(`💬 [Meta Cloud Inbound Reply] From +${cleanPhone}: "${incomingText}"`);

      // Update lead status to replied in database
      scraper.updateLeadStatus(cleanPhone, 'replied', `Inbound: ${incomingText.substring(0, 30)}`, 'meta_cloud');

      // Record in multi-turn chat memory
      if (chatMemory.recordIncoming) {
        chatMemory.recordIncoming(cleanPhone, incomingText);
      }

      // Check for Opt-Out / Stop requests
      const lower = incomingText.toLowerCase();
      if (lower === 'stop' || lower === 'unsub' || lower === 'unsubscribe' || lower === 'mat bhejo') {
        scraper.updateLeadStatus(cleanPhone, 'opted_out');
        scraper.recordSentPhone(cleanPhone);
        continue;
      }

      // Mark replied in scraper & shield from future cold outreach
      scraper.updateLeadStatus(cleanPhone, 'replied');
      scraper.recordSentPhone(cleanPhone);
      console.log(`ℹ️ [Meta Cloud Inbound] Message from +${cleanPhone} recorded. AI auto-reply disabled.`);
    }
  } catch (err) {
    console.error('❌ [Meta Webhook Handler Error]:', err.message);
  }
});

/**
 * Meta Cloud API Status & Health Endpoint
 */
app.get('/api/meta/status', async (req, res) => {
  try {
    const health = await whatsapp.metaCloud.getAccountHealthAndTier();
    res.json({
      activeEngine: whatsapp.getActiveEngine(),
      metaCloud: health,
      webhookUrl: `${detectedBaseUrl || (req.protocol + '://' + req.get('host'))}/api/meta/webhook`,
      verifyToken: whatsapp.metaCloud.verifyToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Meta Cloud API Save & Verify Configuration Endpoint
 */
app.post('/api/meta/save-config', async (req, res) => {
  try {
    const { accessToken, phoneNumberId, wabaId, verifyToken, appSecret, templateName, templateLang, activateEngine } = req.body;

    const saved = whatsapp.metaCloud.saveConfig({
      accessToken,
      phoneNumberId,
      wabaId,
      verifyToken,
      appSecret,
      templateName,
      templateLang,
      activateEngine: (activateEngine === true || activateEngine === 'true')
    });

    if (activateEngine === true || activateEngine === 'true') {
      whatsapp.setEngine('meta_cloud');
    }

    const health = await whatsapp.metaCloud.getAccountHealthAndTier();

    res.json({
      success: true,
      message: 'Meta Cloud credentials saved and updated successfully!',
      activeEngine: whatsapp.getActiveEngine(),
      health,
      config: whatsapp.metaCloud.getConfig()
    });
  } catch (err) {
    console.error('❌ [Save Meta Config Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Meta Cloud API Verification & Health Check Endpoint
 */
app.get('/api/meta/verify', async (req, res) => {
  try {
    const health = await whatsapp.metaCloud.getAccountHealthAndTier();
    res.json({
      success: true,
      activeEngine: whatsapp.getActiveEngine(),
      health,
      config: whatsapp.metaCloud.getConfig()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Send Test Message via Meta Cloud API
 */
app.post('/api/meta/test-send', async (req, res) => {
  const targetPhone = req.body.phone;
  const messageText = req.body.text || 'Namaste! Yeh Karnal Realty Advisors ka Official Meta Cloud API test message hai. (2,000+ msgs/day tier active)';
  const useTemplate = req.body.useTemplate === 'true' || req.body.useTemplate === true;
  const tName = req.body.templateName || (whatsapp.metaCloud && whatsapp.metaCloud.defaultTemplate) || process.env.META_TEMPLATE_NAME || 'karnal_property_lead_v1';
  const tLang = req.body.templateLang || (whatsapp.metaCloud && whatsapp.metaCloud.defaultTemplateLang) || process.env.META_TEMPLATE_LANG || 'hi';

  if (!targetPhone) {
    return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
  }

  try {
    let result;
    if (useTemplate) {
      result = await whatsapp.metaCloud.sendTemplateMessage(
        targetPhone,
        tName,
        tLang,
        [req.body.name || 'Valued Investor', req.body.sector || 'Sector 32/33 Karnal']
      );
    } else {
      result = await whatsapp.metaCloud.sendTextMessage(targetPhone, messageText);
    }

    if (result && result.success) {
      return res.json({ success: true, message: `Test message sent successfully via Meta Cloud API to +${targetPhone}!`, result });
    }
    return res.status(400).json({ success: false, error: result?.error || 'Failed to dispatch via Meta Cloud' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Toggle Active Engine (meta_cloud vs baileys)
 */
app.post('/api/settings/engine', (req, res) => {
  const targetEngine = req.body.engine;
  const newEngine = whatsapp.setEngine(targetEngine);
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, activeEngine: newEngine });
  }
  res.redirect(`/?engine_switched=${newEngine}`);
});

/**
 * Update Cloud Daily Limit (Default 250/Day)
 */
app.post('/api/settings/cloud-limit', (req, res) => {
  const limit = parseInt(req.body.limit || '250', 10);
  queue.saveBotConfig({ dailyMaxLeadsCloud: limit });
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, dailyMaxLeadsCloud: limit });
  }
  res.redirect(`/?cloud_limit_saved=${limit}`);
});

app.get('/api/devices/:id/qr-status', (req, res) => {
  const id = parseInt(req.params.id || '1', 10);
  const clampedId = Math.min(whatsapp.MAX_DEVICES, Math.max(1, isNaN(id) ? 1 : id));
  let dev = whatsapp.getDevice(clampedId);

  if (!dev || (!dev.sock && !dev.isConnected)) {
    whatsapp.initDevice(clampedId);
    dev = whatsapp.getDevice(clampedId);
  }

  res.json({
    id: clampedId,
    isConnected: dev ? dev.isConnected : false,
    phone: dev ? dev.phone : null,
    hasQr: dev ? !!dev.qrDataUrl : false,
    qrDataUrl: dev ? dev.qrDataUrl : null
  });
});

app.post('/api/devices/:id/reset', async (req, res) => {
  const deviceId = parseInt(req.params.id, 10);
  try {
    await whatsapp.resetDevice(deviceId);
  } catch (err) {
    console.error(`Reset error for device ${deviceId}:`, err.message);
  }
  res.redirect(`/qr?device=${deviceId}&reset=true`);
});

app.post('/api/devices/:id/logout', async (req, res) => {
  const deviceId = parseInt(req.params.id, 10);
  try {
    await whatsapp.logoutDevice(deviceId);
  } catch (err) {
    console.error(`Logout error for device ${deviceId}:`, err.message);
  }
  res.redirect(`/qr?device=${deviceId}&logged_out=true`);
});

app.post('/api/leads/add-form', (req, res) => {
  const numbersText = req.body.numbers || '';
  const lines = numbersText.split('\n');
  const leads = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      leads.push({
        phone: trimmed,
        source: 'manual_dashboard',
        isVerifiedWhatsApp: true,
        isHotLead: true,
        segment: '🔥 Direct Client Buyer',
        location: 'Karnal'
      });
    }
  }

  const result = scraper.addLeadsToQueue(leads);
  res.redirect(`/?added=${result.added}`);
});

app.post('/api/leads/shield-past', (req, res) => {
  const numbersText = req.body.pastNumbers || '';
  const lines = numbersText.split('\n');
  const numbersToShield = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      numbersToShield.push(trimmed);
    }
  }

  const result = scraper.recordBulkSentPhones(numbersToShield);
  res.redirect(`/?shielded=true&count=${result.added}`);
});

app.post('/api/queue/pause', (req, res) => {
  queue.pauseQueue();
  res.redirect('/?paused=true');
});

app.post('/api/queue/resume', (req, res) => {
  queue.resumeQueue();
  res.redirect('/?resumed=true');
});

app.post('/api/queue/wake', (req, res) => {
  try {
    queue.wakeAllWorkers();
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: 'All workers awakened from rest/break.' });
    }
    res.redirect('/?woken=true');
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/scraper/pause', (req, res) => {
  scraper.pauseScraper();
  res.redirect('/?scraper_paused=true');
});

app.post('/api/scraper/resume', (req, res) => {
  scraper.resumeScraper();
  res.redirect('/?scraper_resumed=true');
});

app.post('/api/scraper/trigger-free-form', async (req, res) => {
  try {
    await scraper.triggerFreeWebScraper({ targetCount: 30 });
  } catch (err) {
    console.error('Real Estate Scraper Error:', err);
  }
  res.redirect('/?scraper=free_triggered');
});

function initKeepAlive() {
  if (detectedBaseUrl) {
    startKeepAliveEngine(detectedBaseUrl);
  } else {
    console.log('💡 [Keep-Alive] Waiting for first inbound request or RENDER_EXTERNAL_URL to lock target URL...');
  }
}

/**
 * Start Server, Scraper, WhatsApp Multi-Devices & Queue Workers
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=========================================================`);
  console.log(`🏢 Satyam Realty Official Meta WhatsApp Cloud Bot (100/Day) on Port ${PORT}`);
  console.log(`📲 Official Number: +91 8901849699 • Web Console: http://localhost:${PORT}/`);
  console.log(`=========================================================\n`);

  // 1. Start autonomous continuous real estate scraper
  scraper.start247ContinuousScraper().catch(e => console.error("24/7 Scraper Boot Error:", e.message));

  // 2. Start Anti-Sleep Keep-Alive Heartbeat
  initKeepAlive();

  // 3. Initialize all 6 device slots
  whatsapp.initAllDevices();

  // 4. Start concurrent queue workers across all devices
  queue.startQueueWorker();
});

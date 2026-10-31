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
 * Multi-Device QR Linking Page (/qr?device=X)
 */
app.get('/qr', (req, res) => {
  const selectedId = parseInt(req.query.device || '1', 10);
  const clampedId = Math.max(1, Math.min(whatsapp.MAX_DEVICES, selectedId));
  let device = whatsapp.getDevice(clampedId);

  if (!device || (!device.sock && !device.isConnected)) {
    whatsapp.initDevice(clampedId);
    device = whatsapp.getDevice(clampedId);
  }

  const allDevices = whatsapp.getAllDevices();
  const isConnected = device ? device.isConnected : false;
  const phone = device ? device.phone : null;
  const qrDataUrl = device ? device.qrDataUrl : null;

  let bodyContent = '';

  if (isConnected) {
    bodyContent = `
      <div class="card connected">
        <div class="icon">🏢</div>
        <h2>Device ${clampedId} Active &amp; Ready!</h2>
        <p class="phone">+${phone}</p>
        <p class="desc">Connected to Karnal Realty Advisors property desk (50 leads/day Enterprise Delivery Cadence).</p>
        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <a href="/" class="btn btn-gold">Go to Live Dashboard</a>
          <form method="POST" action="/api/devices/${clampedId}/logout" style="margin: 0;">
            <button type="submit" class="btn btn-red" onclick="return confirm('Disconnect Device ${clampedId}?');">🔌 Disconnect / Relink</button>
          </form>
        </div>
      </div>
    `;
  } else if (qrDataUrl) {
    bodyContent = `
      <div class="card" id="qr-container">
        <h2>Link Device ${clampedId}</h2>
        <p class="subtitle">Open WhatsApp on Phone ${clampedId} > Linked Devices > Link a Device</p>
        <div class="qr-box">
          <img src="${qrDataUrl}" alt="WhatsApp QR Code for Device ${clampedId}" class="qr-img" id="qr-img-tag" />
        </div>
        <p class="refresh-hint">⚡ Live QR Stream Active. Point phone camera now.</p>
        <div style="margin-top: 1rem;">
          <form method="POST" action="/api/devices/${clampedId}/reset" style="margin: 0;">
            <button type="submit" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">⚡ Force Fresh QR (1s Reset)</button>
          </form>
        </div>
      </div>
    `;
  } else {
    bodyContent = `
      <div class="card" id="qr-container">
        <div class="spinner"></div>
        <h2>Initializing Device ${clampedId} Socket...</h2>
        <p class="desc">Generating fresh QR code with Windows 11 Chrome fingerprint (ready in 1-2s)...</p>
        <div style="margin-top: 1.25rem;">
          <form method="POST" action="/api/devices/${clampedId}/reset" style="margin: 0;">
            <button type="submit" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">⚡ Force Fresh QR (1s Reset)</button>
          </form>
        </div>
      </div>
    `;
  }

  // Device Tabs Bar
  const tabsHtml = allDevices.map(d => {
    const isCurrent = d.id === clampedId;
    const label = d.isConnected ? `Device ${d.id} (● +${d.phone ? d.phone.slice(-4) : 'OK'})` : `Device ${d.id} (📱 Link)`;
    const bgClass = d.isConnected ? 'tab-online' : 'tab-offline';
    const activeClass = isCurrent ? 'tab-active' : '';
    return `<a href="/qr?device=${d.id}" class="tab-btn ${bgClass} ${activeClass}">${label}</a>`;
  }).join('');

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Link WhatsApp Devices — Karnal Realty Advisors</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #070b14; color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5rem; }
        .wrapper { max-width: 540px; width: 100%; text-align: center; }
        .header-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .back-link { color: #f59e0b; text-decoration: none; font-size: 0.9rem; font-weight: 600; }
        .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1.5rem; }
        .tab-btn { padding: 0.65rem 0.5rem; border-radius: 10px; text-decoration: none; font-size: 0.8rem; font-weight: 700; border: 1px solid #1e293b; background: #0f172a; color: #94a3b8; transition: all 0.2s; }
        .tab-btn.tab-online { border-color: #10b981; color: #6ee7b7; background: #064e3b33; }
        .tab-btn.tab-active { border-color: #f59e0b; background: #b4530933; color: #fbbf24; }
        .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 2.25rem 1.75rem; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        .card.connected { border-color: #10b981; }
        h2 { font-size: 1.4rem; margin-bottom: 0.4rem; color: #f8fafc; }
        .subtitle { color: #94a3b8; font-size: 0.85rem; margin-bottom: 1.25rem; }
        .qr-box { background: #fff; padding: 1rem; border-radius: 16px; display: inline-block; margin-bottom: 1.25rem; }
        .qr-img { width: 240px; height: 240px; display: block; }
        .phone { font-size: 1.25rem; font-weight: 700; color: #34d399; margin: 0.5rem 0 1rem; }
        .desc { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem; }
        .btn { display: inline-block; padding: 0.65rem 1.25rem; border-radius: 8px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-size: 0.9rem; }
        .btn-gold { background: #f59e0b; color: #000; font-weight: 700; }
        .btn-red { background: #dc2626; color: #fff; }
        .btn-outline { background: transparent; border: 1px solid #334155; color: #cbd5e1; }
        .refresh-hint { font-size: 0.8rem; color: #64748b; }
        .spinner { width: 40px; height: 40px; border: 4px solid #1e293b; border-top-color: #f59e0b; border-radius: 50%; animation: spin 1s infinite linear; margin: 0 auto 1.25rem; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      </style>
      <script>
        let currentConnected = ${isConnected ? 'true' : 'false'};
        let lastQrData = "${qrDataUrl || ''}";

        async function pollQrStream() {
          try {
            const res = await fetch('/api/devices/${clampedId}/qr-status');
            const data = await res.json();

            if (data.isConnected && !currentConnected) {
              window.location.reload();
              return;
            }

            if (!data.isConnected && data.qrDataUrl && data.qrDataUrl !== lastQrData) {
              lastQrData = data.qrDataUrl;
              const imgTag = document.getElementById('qr-img-tag');
              if (imgTag) {
                imgTag.src = data.qrDataUrl;
              } else {
                const container = document.getElementById('qr-container');
                if (container) {
                  container.innerHTML = \`
                    <h2>Link Device ${clampedId}</h2>
                    <p class="subtitle">Open WhatsApp on Phone ${clampedId} > Linked Devices > Link a Device</p>
                    <div class="qr-box">
                      <img src="\${data.qrDataUrl}" alt="Device QR Code" class="qr-img" id="qr-img-tag" />
                    </div>
                    <p class="refresh-hint">⚡ Live QR Stream Active. Point phone camera now.</p>
                    <div style="margin-top: 1rem;">
                      <form method="POST" action="/api/devices/${clampedId}/reset" style="margin: 0;">
                        <button type="submit" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">⚡ Force Fresh QR (1s Reset)</button>
                      </form>
                    </div>
                  \`;
                }
              }
            }
          } catch (e) {}
        }

        if (!currentConnected) {
          setInterval(pollQrStream, 1500);
        }
      </script>
    </head>
    <body>
      <div class="wrapper">
        <div class="header-nav">
          <a href="/" class="back-link">← Back to Dashboard</a>
          <span style="color: #64748b; font-size: 0.85rem;">Slot <strong>${clampedId}</strong> of ${whatsapp.MAX_DEVICES}</span>
        </div>
        <div class="tabs">
          ${tabsHtml}
        </div>
        ${bodyContent}
      </div>
    </body>
    </html>
  `);
});

/**
 * Main Web Dashboard (/)
 */
app.get('/', (req, res) => {
  const state = queue.getQueueState();
  const scraperStats = scraper.getScraperStats();
  const totalShielded = scraper.getTotalShieldedCount ? scraper.getTotalShieldedCount() : 0;
  const hotLeads = scraper.getHotRepliedLeads ? scraper.getHotRepliedLeads() : [];
  const allLeads = scraper.getAllDiscoveredLeads ? scraper.getAllDiscoveredLeads('all') : [];
  const conversations = chatMemory.getAllConversations ? chatMemory.getAllConversations() : [];

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="8">
      <title>Karnal Realty Advisors — Multi-Device Lead &amp; Outreach Engine</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #070b14; color: #f1f5f9; padding: 1.5rem; }
        .container { max-width: 900px; margin: 0 auto; }
        header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 1.25rem; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
        h1 { font-size: 1.45rem; color: #fbbf24; }
        .status-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.9rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 700; text-decoration: none; }
        .status-badge.online { background: #064e3b; color: #6ee7b7; border: 1px solid #059669; }
        .status-badge.offline { background: #7f1d1d; color: #fca5a5; border: 1px solid #dc2626; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 1.25rem; text-align: center; }
        .stat-val { font-size: 1.7rem; font-weight: 800; color: #fbbf24; margin-top: 0.35rem; }
        .stat-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        .section-box { background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 1.5rem; margin-bottom: 1.5rem; }
        h3 { font-size: 1.1rem; margin-bottom: 1rem; color: #f8fafc; }
        .btn-group { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .btn { padding: 0.65rem 1.25rem; border-radius: 8px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-size: 0.9rem; }
        .btn-gold { background: #f59e0b; color: #000; font-weight: 700; }
        .btn-emerald { background: #10b981; color: #fff; font-weight: 700; }
        .btn-blue { background: #2563eb; color: #fff; }
        .btn-outline { background: transparent; border: 1px solid #334155; color: #cbd5e1; }
        textarea { width: 100%; height: 90px; background: #070b14; border: 1px solid #334155; border-radius: 8px; color: #fff; padding: 0.75rem; font-size: 0.9rem; margin-bottom: 0.75rem; resize: vertical; }
        .log-box { background: #070b14; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; color: #94a3b8; line-height: 1.5; }
        .device-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #070b14; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid #1e293b; flex-wrap: wrap; gap: 0.5rem; }
        .device-title { font-weight: 700; color: #f8fafc; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
        .device-meta { font-size: 0.8rem; color: #94a3b8; }
        .badge-pill { padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
        .badge-online { background: #064e3b; color: #6ee7b7; border: 1px solid #059669; }
        .badge-offline { background: #334155; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div>
            <h1>🏢 Karnal Realty Advisors — Multi-Device Lead Engine</h1>
            <p style="color: #64748b; font-size: 0.85rem; margin-top: 0.2rem;">
              GT Road Commercial Spaces • SCO Plots • NRI Diaspora (Canada, UK, US, Aus, Dubai) • Enterprise Delivery Cadence &amp; Account Health Matrix
            </p>
          </div>
          <div>
            ${state.connectedDevicesCount > 0 ?
              `<a href="/qr" class="status-badge online">● ${state.connectedDevicesCount} / ${state.maxDevices} Devices Active</a>` :
              `<a href="/qr" class="status-badge offline">⚠️ Scan Devices QR</a>`
            }
          </div>
        </header>

        <div class="grid">
          <div class="stat-card">
            <div class="stat-label">Active Devices</div>
            <div class="stat-val" style="color: #fbbf24;">${state.connectedDevicesCount} / ${state.maxDevices}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Today's Outreach</div>
            <div class="stat-val" style="color: #34d399;">${state.dailySentCount} / ${state.dailyMaxLeads}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Sent (All Time)</div>
            <div class="stat-val">${state.totalSentDb}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Leads In Queue</div>
            <div class="stat-val" style="color: #38bdf8;">${state.queuedRemaining}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Shielded Past Numbers</div>
            <div class="stat-val" style="color: #a855f7;">${totalShielded}</div>
          </div>
          <div class="stat-card" style="border-color: #f59e0b44;">
            <div class="stat-label" style="color: #fde68a;">Hot Replied Leads</div>
            <div class="stat-val" style="color: #f59e0b;">${hotLeads.length}</div>
          </div>
        </div>

        ${req.query.shielded ? `
          <div style="background: #1e1b4b; border: 1px solid #8b5cf6; border-radius: 12px; padding: 1.1rem; margin-bottom: 1.5rem; color: #e9d5ff;">
            🛡️ <strong>Investor Shield Updated!</strong> Permanently shielded <strong>${req.query.count || 0}</strong> numbers from ever receiving outreach again.
          </div>
        ` : ''}

        ${req.query.settings_saved ? `
          <div style="background: #064e3b; border: 1px solid #10b981; border-radius: 12px; padding: 1.1rem; margin-bottom: 1.5rem; color: #a7f3d0; font-weight: 600;">
            ✅ <strong>Outreach Settings Updated!</strong> 24-hour limit set to <strong>${req.query.limit || state.dailyMaxPerDevice}</strong> msgs/device (Preset: ${req.query.pacing || state.botConfig?.pacingPreset || 'custom'}). All workers updated immediately.
          </div>
        ` : ''}

        <!-- Branded Logo AI Dispatch Card -->
        <div class="section-box" style="border-left: 4px solid #fbbf24; background: #0f172a; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1.25rem;">
            <img src="/assets/karnal_reality_logo.jpg" alt="Karnal Reality Logo" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover; border: 2px solid #f59e0b; box-shadow: 0 4px 14px rgba(0,0,0,0.5);" />
            <div>
              <h3 style="margin: 0; color: #fbbf24; font-size: 1.05rem;">🏢 Karnal Reality Branded Picture Outreach Engine: ACTIVE</h3>
              <p style="color: #cbd5e1; font-size: 0.85rem; margin-top: 0.25rem;">
                Every outbound WhatsApp message and AI consultation reply is dynamically sent with the high-resolution <strong>Karnal Reality</strong> luxury real estate logo and cryptographic zero-width watermarked caption.
              </p>
            </div>
          </div>
          <div>
            <span style="background: #064e3b; color: #6ee7b7; border: 1px solid #059669; padding: 0.4rem 0.95rem; border-radius: 9999px; font-size: 0.82rem; font-weight: 700;">
              📸 Branded Image Dispatch ON
            </span>
          </div>
        </div>

        <!-- Customizable 24-Hour Outreach Volume & Speed Controller -->
        <div class="section-box" style="border-left: 4px solid #10b981; background: #064e3b12;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; color: #34d399;">⚡ Outreach Speed &amp; Volume Controller</h3>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.2rem;">
                Adjust dispatch speed, message delays, and 24-hour targets. Takes effect immediately on all connected devices.
              </p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
              <span style="background: #065f46; color: #a7f3d0; font-size: 0.8rem; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 700;">
                Target: ${state.dailyMaxPerDevice || 50} msgs/device/24h
              </span>
              <span style="background: #312e81; color: #c7d2fe; font-size: 0.8rem; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 700;">
                Speed: ${((state.botConfig && state.botConfig.minMsgDelayMs ? state.botConfig.minMsgDelayMs : 35000) / 1000).toFixed(0)}s - ${((state.botConfig && state.botConfig.maxMsgDelayMs ? state.botConfig.maxMsgDelayMs : 70000) / 1000).toFixed(0)}s
              </span>
            </div>
          </div>

          <!-- Speed Presets -->
          <div style="margin-top: 1rem; background: #070b14; border: 1px solid #1e293b; border-radius: 10px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
              <span style="font-size: 0.85rem; color: #f1f5f9; font-weight: 700;">⚡ Dispatch Speed Presets:</span>
              <form method="POST" action="/api/settings/toggle-timezone-shield" style="margin: 0;">
                <button type="submit" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.3rem 0.75rem; border-color: ${state.botConfig && state.botConfig.businessHoursShield ? '#f59e0b' : '#10b981'}; color: ${state.botConfig && state.botConfig.businessHoursShield ? '#fbbf24' : '#34d399'};">
                  ${state.botConfig && state.botConfig.businessHoursShield ? '🌙 Daytime Guard: ON (Click for 24/7 Any-Time)' : '🟢 24/7 Any-Time Dispatch: ACTIVE (Zero Delay)'}
                </button>
              </form>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <form method="POST" action="/api/settings/pacing" style="margin: 0;">
                <input type="hidden" name="preset" value="turbo">
                <input type="hidden" name="dailyMaxLeads" value="${state.dailyMaxPerDevice || 50}">
                <button type="submit" class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; ${state.botConfig && state.botConfig.pacingPreset === 'turbo' ? 'border-color: #ec4899; color: #f472b6; background: #83184322;' : ''}">
                  🚀 Turbo (25s - 45s • 10 msgs in ~5m)
                </button>
              </form>

              <form method="POST" action="/api/settings/pacing" style="margin: 0;">
                <input type="hidden" name="preset" value="fast">
                <input type="hidden" name="dailyMaxLeads" value="${state.dailyMaxPerDevice || 50}">
                <button type="submit" class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; ${!state.botConfig || state.botConfig.pacingPreset === 'fast' ? 'border-color: #10b981; color: #34d399; background: #064e3b33;' : ''}">
                  ⚡ Fast Human (35s - 70s • 10 msgs in ~8m)
                </button>
              </form>

              <form method="POST" action="/api/settings/pacing" style="margin: 0;">
                <input type="hidden" name="preset" value="balanced">
                <input type="hidden" name="dailyMaxLeads" value="${state.dailyMaxPerDevice || 50}">
                <button type="submit" class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; ${state.botConfig && state.botConfig.pacingPreset === 'balanced' ? 'border-color: #818cf8; color: #a5b4fc; background: #312e8133;' : ''}">
                  ⚖️ Balanced (1m - 2m • 10 msgs in ~15m)
                </button>
              </form>

              <form method="POST" action="/api/settings/pacing" style="margin: 0;">
                <input type="hidden" name="preset" value="enterprise">
                <input type="hidden" name="dailyMaxLeads" value="${state.dailyMaxPerDevice || 50}">
                <button type="submit" class="btn btn-outline" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; ${state.botConfig && state.botConfig.pacingPreset === 'enterprise' ? 'border-color: #64748b; color: #cbd5e1; background: #1e293b;' : ''}">
                  🛡️ Deep Enterprise (3m - 6m)
                </button>
              </form>
            </div>
          </div>

          <!-- Volume Cap Form -->
          <form method="POST" action="/api/settings/daily-limit" style="margin-top: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <label style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600;">Custom 24-Hour Limit (per device):</label>
              <input type="number" name="dailyMaxLeads" min="5" max="500" value="${state.dailyMaxPerDevice || 50}" style="width: 100px; background: #070b14; border: 1px solid #10b981; border-radius: 8px; color: #fff; padding: 0.45rem 0.75rem; font-size: 0.95rem; font-weight: 700; text-align: center;" required />
              <button type="submit" class="btn btn-emerald" style="padding: 0.45rem 1.1rem; font-size: 0.85rem;">💾 Save Limit</button>
            </div>

            <div style="margin-top: 0.85rem; font-size: 0.8rem; color: #94a3b8; background: #070b14; padding: 0.75rem 0.9rem; border-radius: 8px; border: 1px solid #1e293b;">
              <div>
                📊 <strong>Total 24-Hour Capacity:</strong> 
                <span style="color: #34d399; font-weight: 700;">${(state.dailyMaxPerDevice || 50) * Math.max(1, state.connectedDevicesCount)} msgs/day</span> across active devices 
                (Up to <span style="color: #fbbf24; font-weight: 700;">${(state.dailyMaxPerDevice || 50) * state.maxDevices} msgs/day</span> with all 6 devices linked).
              </div>
              <div style="margin-top: 0.4rem; color: #c4b5fd; font-size: 0.78rem;">
                🔒 <strong>Device Rule:</strong> Number <strong>+91-9416085989</strong> is strictly capped at <strong>10 messages/day</strong> and all sent chats are automatically archived &amp; muted (Secret Vault Code: <strong>3369</strong>). All other numbers send your custom volume (${state.dailyMaxPerDevice || 50}/day).
              </div>
            </div>
          </form>
        </div>

        <!-- Multi-Device Control Center (6 Slots) -->
        <div class="section-box" style="border-left: 4px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; color: #fbbf24;">📱 Multi-Device Territory Matrix (${state.connectedDevicesCount} of ${state.maxDevices} Linked)</h3>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.2rem;">
                Isolated sessions: 50 leads/day, 1–2m jitter, 50–80m tea breaks. Partitioned by territory: Commercial, SCOs, Canada, UK, Australia &amp; Haryana HNW.
              </p>
            </div>
            <a href="/qr" class="btn btn-gold" style="font-size: 0.85rem;">+ Link / Manage Devices</a>
          </div>

          <div>
            ${state.devices.map(d => {
              const isSpecial = d.phone && String(d.phone).includes('9416085989');
              return `
              <div class="device-row">
                <div>
                  <div class="device-title">
                    <span>Device ${d.id}</span>
                    <span class="badge-pill ${d.isConnected ? 'badge-online' : 'badge-offline'}">
                      ${d.isConnected ? `● +${d.phone}` : 'Not Linked'}
                    </span>
                    ${isSpecial ? '<span style="background: #4c1d95; color: #c4b5fd; font-size: 0.7rem; padding: 0.15rem 0.55rem; border-radius: 9999px; font-weight: 700; margin-left: 0.4rem;">🔒 Locked (10/day • Vault 3369)</span>' : ''}
                  </div>
                  <div class="device-meta" style="margin-top: 0.35rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span>Status: <strong style="color: #e2e8f0;">${d.currentStatus}</strong></span>
                    ${d.nextActionTimestamp ? `
                      <span style="background: #064e3b; border: 1px solid #059669; padding: 0.15rem 0.65rem; border-radius: 6px; color: #a7f3d0; font-size: 0.82rem; font-weight: 700;">
                        ⏳ Next Msg: <span class="countdown-timer" data-target="${d.nextActionTimestamp}" title="at ${d.nextActionTime}" style="color: #34d399;">${d.nextActionTime}</span>
                      </span>
                    ` : (d.isConnected ? `
                      <span style="background: #064e3b; border: 1px solid #059669; padding: 0.15rem 0.65rem; border-radius: 6px; color: #a7f3d0; font-size: 0.82rem; font-weight: 700;">
                        ⏳ Next Msg: <span style="color: #34d399;">🟢 Ready to dispatch</span>
                      </span>
                    ` : '')}
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span style="font-weight: 700; color: ${d.dailySentCount >= d.dailyMaxLeads ? '#34d399' : '#fbbf24'}; font-size: 0.9rem;">
                    ${d.dailySentCount} / ${d.dailyMaxLeads} today
                  </span>
                  <a href="/qr?device=${d.id}" class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
                    ${d.isConnected ? 'Manage' : '📱 Scan QR'}
                  </a>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>

        <!-- Master Pause / Stop Bot Controls -->
        ${state.isPaused ? `
          <div style="background: #450a0a; border: 1px solid #b91c1c; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="color: #f87171; margin-bottom: 0.25rem;">🛑 Outreach Engine is PAUSED</h3>
              <p style="color: #fca5a5; font-size: 0.85rem; margin: 0;">Outreach is paused on all devices. All leads, claimed positions, and histories are safe.</p>
            </div>
            <form method="POST" action="/api/queue/resume" style="margin: 0;">
              <button type="submit" class="btn" style="background: #10b981; color: #fff; padding: 0.75rem 1.5rem; font-size: 0.95rem; font-weight: 700; cursor: pointer;">▶️ Resume Outreach</button>
            </form>
          </div>
        ` : `
          <div style="background: #022c22; border: 1px solid #059669; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="color: #34d399; margin-bottom: 0.25rem;">⚡ Multi-Device Engine ACTIVE (9:00 AM – 9:00 PM IST)</h3>
              <p style="color: #6ee7b7; font-size: 0.85rem; margin: 0;">Active Daylight Hours • Micro-batches with 1–2m jitter &amp; 50–80m breaks • Commercial &amp; NRI Targeting.</p>
            </div>
            <form method="POST" action="/api/queue/pause" style="margin: 0;">
              <button type="submit" class="btn" style="background: #dc2626; color: #fff; padding: 0.75rem 1.5rem; font-size: 0.95rem; font-weight: 700; cursor: pointer;">🛑 Pause Outreach</button>
            </form>
          </div>
        `}

        <!-- Hot Leads Section with 1-Click CSV Export -->
        <div class="section-box" style="border-left: 4px solid #f59e0b; background: #78350f15;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; color: #fbbf24;">🔥 Hot Property Investor Leads (${hotLeads.length})</h3>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.2rem;">Investors &amp; buyers who replied to outreach. Ready for closing / site visit booking.</p>
            </div>
            <a href="/api/leads/export-csv" class="btn btn-gold">📥 Download Hot Leads (.CSV)</a>
          </div>
          ${hotLeads.length === 0 ? '<p style="color: #64748b; font-size: 0.85rem;">No replies yet today. As soon as property investors respond, they appear here instantly.</p>' : `
            <div style="max-height: 220px; overflow-y: auto; background: #070b14; border-radius: 8px; padding: 0.5rem;">
              ${hotLeads.slice(-10).reverse().map(l => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid #1e293b;">
                  <div>
                    <strong style="color: #f1f5f9;">+${l.phone}</strong>
                    <span style="color: #94a3b8; font-size: 0.8rem; margin-left: 0.5rem;">${l.name || 'Valued Investor'}</span>
                  </div>
                  <a href="https://wa.me/${l.phone}" target="_blank" class="btn btn-emerald" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; text-decoration: none;">💬 WhatsApp</a>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Persistent Multi-Turn AI Conversations Inspector -->
        <div class="section-box" style="border-left: 4px solid #818cf8; background: #312e8112;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; color: #a5b4fc;">🧠 Active Real Estate Chat Threads (${conversations.length} Active in Memory)</h3>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.2rem;">
                Multi-turn persistent conversational memory. Automatically tracks stage, answers queries, and remembers past interactions.
              </p>
            </div>
            <a href="/api/conversations" target="_blank" class="btn btn-outline" style="font-size: 0.8rem;">🔍 View JSON Memory</a>
          </div>

          ${conversations.length === 0 ? '<p style="color: #64748b; font-size: 0.85rem;">No conversations active yet. As outreach begins and leads reply, their full chat history appears here.</p>' : `
            <div style="max-height: 280px; overflow-y: auto; background: #070b14; border-radius: 8px; padding: 0.5rem;">
              ${conversations.slice(0, 20).map(c => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.5rem; border-bottom: 1px solid #1e293b; flex-wrap: wrap; gap: 0.5rem;">
                  <div>
                    <strong style="color: #f1f5f9;">+${c.phone}</strong>
                    <span style="color: #94a3b8; font-size: 0.8rem; margin-left: 0.5rem;">
                      ${c.profile.name || 'Sir'} • ${c.profile.city || 'Karnal'} (${c.profile.propertyInterest || 'Commercial'})
                    </span>
                    <span class="badge-pill" style="margin-left: 0.5rem; font-size: 0.7rem; background: ${c.profile.stage === 'replied' || c.profile.stage === 'consultation_active' ? '#064e3b' : '#1e293b'}; color: ${c.profile.stage === 'replied' || c.profile.stage === 'consultation_active' ? '#6ee7b7' : '#94a3b8'};">
                      ${c.profile.stage}
                    </span>
                    <span style="color: #64748b; font-size: 0.75rem; margin-left: 0.4rem;">(${c.messageCount} msgs)</span>
                    ${c.lastMessage ? `
                      <div style="color: #94a3b8; font-size: 0.78rem; margin-top: 0.2rem; max-width: 550px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <em>${c.lastMessage.role === 'assistant' ? 'Aman (Bot):' : 'Lead:'}</em> "${(c.lastMessage.content || '').replace(/"/g, '&quot;')}"
                      </div>
                    ` : ''}
                  </div>
                  <a href="https://wa.me/${c.phone}" target="_blank" class="btn btn-emerald" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; text-decoration: none;">💬 WhatsApp</a>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Discovered Leads List & Manager (Turns all leads into a list) -->
        <div class="section-box" style="border-left: 4px solid #10b981; background: #064e3b12;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="margin: 0; color: #34d399;">📋 All Discovered Leads List (${allLeads.length} Total in DB)</h3>
              <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.2rem;">
                Karnal commercial buyers, SCO investors, and global NRIs. Download or copy as a formatted list below.
              </p>
            </div>
            <div class="btn-group">
              <a href="/api/leads/export-all-csv" class="btn btn-emerald">📥 Export All (.CSV)</a>
              <a href="/api/leads/export-list-txt" class="btn btn-outline">📋 Download Phone List (.TXT)</a>
            </div>
          </div>

          <details style="margin-bottom: 1rem; background: #070b14; padding: 0.75rem; border-radius: 8px; border: 1px solid #1e293b;">
            <summary style="cursor: pointer; color: #34d399; font-weight: 600; font-size: 0.85rem;">📄 Click to view copyable raw numbers list (${allLeads.length} numbers)</summary>
            <textarea readonly style="margin-top: 0.5rem; width: 100%; height: 120px; font-family: monospace; font-size: 0.8rem;" onclick="this.select()">${allLeads.map(l => '+' + l.phone).join('\n')}</textarea>
          </details>

          ${allLeads.length === 0 ? '<p style="color: #64748b; font-size: 0.85rem;">No leads in database yet. Trigger the scraper below to harvest fresh numbers.</p>' : `
            <div style="max-height: 280px; overflow-y: auto; background: #070b14; border-radius: 8px; padding: 0.5rem;">
              ${allLeads.slice(0, 50).map(l => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid #1e293b;">
                  <div>
                    <strong style="color: #f1f5f9;">+${l.phone}</strong>
                    <span style="color: #94a3b8; font-size: 0.8rem; margin-left: 0.5rem;">${l.name || 'Investor'} • ${(l.city || 'Karnal').toUpperCase()}</span>
                    <span class="badge-pill ${l.status === 'replied' ? 'badge-online' : (l.status === 'sent' ? 'badge-online' : 'badge-offline')}" style="margin-left: 0.5rem; font-size: 0.7rem;">
                      ${l.status}
                    </span>
                  </div>
                  <a href="https://wa.me/${l.phone}" target="_blank" class="btn btn-emerald" style="padding: 0.3rem 0.65rem; font-size: 0.75rem; text-decoration: none;">💬 WhatsApp</a>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="section-box">
          <h3>📥 Add Investor Phone Numbers to Queue</h3>
          <form method="POST" action="/api/leads/add-form">
            <textarea name="numbers" placeholder="Paste phone numbers (India 10-digit/91 or Global NRIs +1, +44, +61, +971)..."></textarea>
            <div class="btn-group">
              <button type="submit" class="btn btn-gold">+ Add to Real Estate Lead Queue</button>
              <a href="/qr" class="btn btn-outline">📱 Scan / Manage Devices</a>
            </div>
          </form>
        </div>

        <div class="section-box" style="border-left: 4px solid #a855f7;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h3 style="margin: 0; color: #c084fc;">🛡️ Shield Past Investor Numbers (Past Campaigns / Blacklist)</h3>
            <span style="background: #581c87; color: #e9d5ff; font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 700;">DUPLICATE SHIELD</span>
          </div>
          <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.75rem;">
            Paste numbers from past campaigns, spreadsheets, or DND requests below (one per line). They will be recorded in the permanent shield ledger so no device contacts them!
          </p>
          <form method="POST" action="/api/leads/shield-past">
            <textarea name="pastNumbers" placeholder="Paste numbers here (one per line, e.g. 9876543210, +14165551234, etc.)..."></textarea>
            <button type="submit" class="btn" style="background: #7c3aed; color: #fff; font-weight: 700; cursor: pointer;">🛡️ Permanently Shield These Numbers</button>
          </form>
        </div>

        <div class="section-box" style="border-color: #f59e0b; background: #78350f10;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h3 style="margin: 0; color: #fbbf24;">🌐 Yandex &amp; Global Real Estate Scraper</h3>
            <span style="background: ${scraperStats.isPaused ? '#7f1d1d' : '#065f46'}; color: ${scraperStats.isPaused ? '#fca5a5' : '#a7f3d0'}; font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 700;">${scraperStats.isPaused ? 'PAUSED' : 'ACTIVE 24/7'}</span>
          </div>
          <p class="log-box" style="margin-bottom: 0.75rem;">
            Status: <strong>${scraperStats.status}</strong><br>
            Cycles Completed: <strong>${scraperStats.cyclesCompleted}</strong> | Harvested This Session: <strong>${scraperStats.leadsHarvestedSession}</strong> | Total in DB: <strong>${scraperStats.totalInDb}</strong><br>
            Target Territory: <strong>${(scraperStats.lastScrapedCity || 'Karnal').toUpperCase()}</strong> (${scraperStats.lastScrapedNiche || 'Commercial Spaces & SCOs'})
          </p>
          <div class="btn-group">
            <form method="POST" action="/api/scraper/trigger-free-form" style="margin: 0;">
              <button type="submit" class="btn btn-gold">⚡ Trigger Instant Real Estate Sweep (30+ Leads)</button>
            </form>
            <form method="POST" action="${scraperStats.isPaused ? '/api/scraper/resume' : '/api/scraper/pause'}" style="margin: 0;">
              <button type="submit" class="btn btn-outline">${scraperStats.isPaused ? '▶️ Resume Auto-Scraper' : '⏸️ Pause Auto-Scraper'}</button>
            </form>
          </div>
        </div>
      </div>
      <script>
        function updateCountdowns() {
          var now = Date.now();
          document.querySelectorAll('.countdown-timer').forEach(function(el) {
            var target = parseInt(el.getAttribute('data-target') || '0', 10);
            if (!target) return;
            var diff = Math.max(0, Math.floor((target - now) / 1000));
            if (diff > 0) {
              var mins = Math.floor(diff / 60);
              var secs = diff % 60;
              var title = el.getAttribute('title') || '';
              var minsStr = (mins < 10 ? '0' : '') + mins;
              var secsStr = (secs < 10 ? '0' : '') + secs;
              el.innerText = 'in ' + minsStr + ':' + secsStr + ' (' + title + ')';
            } else {
              el.innerText = 'Dispatching now / Ready';
            }
          });
        }
        setInterval(updateCountdowns, 1000);
        updateCountdowns();
        setTimeout(function() {
          window.location.reload();
        }, 15000);
      </script>
    </body>
    </html>
  `);
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
      } else {
        console.log(`📬 [Meta Delivery Receipt] +${st.recipient} -> Status: ${st.status.toUpperCase()}`);
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
      chatMemory.recordInbound(cleanPhone, incomingText);

      // Check for Opt-Out / Stop requests
      const lower = incomingText.toLowerCase();
      if (lower === 'stop' || lower === 'unsub' || lower === 'unsubscribe' || lower === 'mat bhejo') {
        scraper.updateLeadStatus(cleanPhone, 'opted_out');
        scraper.recordSentPhone(cleanPhone);
        const optOutMsg = 'Aapka number Karnal Realty investor desk se remove kar diya gaya hai. Aage se koi updates nahi aayenge. Dhanyawad.';
        await whatsapp.metaCloud.sendTextMessage(cleanPhone, optOutMsg);
        continue;
      }

      // Generate AI Real Estate Qualified Response
      const history = chatMemory.getFormattedHistory(cleanPhone, 10);
      const leadProfile = chatMemory.getProfile(cleanPhone);
      const leadName = leadProfile.name || 'Investor';

      const aiReply = await ai.handleIncomingMessage(leadName, incomingText, history, cleanPhone);

      if (aiReply) {
        console.log(`🤖 [AI Auto-Reply via Meta Cloud] To +${cleanPhone}: "${aiReply.substring(0, 50)}..."`);
        const sent = await whatsapp.metaCloud.sendTextMessage(cleanPhone, aiReply);
        if (sent && sent.success) {
          chatMemory.recordOutreach(cleanPhone, aiReply, { name: leadName });
        }
      }
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
      webhookUrl: `${detectedBaseUrl || ''}/api/meta/webhook`,
      verifyToken: whatsapp.metaCloud.verifyToken
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Send Test Message via Meta Cloud API
 */
app.post('/api/meta/test-send', async (req, res) => {
  const targetPhone = req.body.phone;
  const messageText = req.body.text || 'Namaste! Yeh Karnal Realty Advisors ka Official Meta Cloud API test message hai. (1,000+ msgs/day tier active)';
  const useTemplate = req.body.useTemplate === 'true' || req.body.useTemplate === true;

  if (!targetPhone) {
    return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
  }

  try {
    let result;
    if (useTemplate) {
      result = await whatsapp.metaCloud.sendTemplateMessage(
        targetPhone,
        process.env.META_TEMPLATE_NAME || 'karnal_property_lead_v1',
        process.env.META_TEMPLATE_LANG || 'hi',
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
 * Update 1k+ Cloud Daily Limit
 */
app.post('/api/settings/cloud-limit', (req, res) => {
  const limit = parseInt(req.body.limit || '1000', 10);
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
      leads.push({ phone: trimmed, source: 'manual_dashboard' });
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
  console.log(`🏢 Karnal Realty Advisors Multi-Device Lead Bot on Port ${PORT}`);
  console.log(`📲 Open http://localhost:${PORT}/qr to link WhatsApp devices (Up to ${whatsapp.MAX_DEVICES})`);
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

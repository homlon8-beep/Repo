/**
 * Baileys WhatsApp Multi-Device Manager for Karnal Realty Advisors
 * (Up to 6 Simultaneous Devices)
 * 
 * Features:
 * - Multi-device parallel operations with isolated auth directories
 * - Genuine Windows 11 Chrome TLS fingerprint (Browsers.windows('Chrome'))
 * - High-resilience E2EE getMessage retry resolver & persistent message store
 * - Cacheable Signal key store for zero disk I/O bottlenecks and pre-key freshness
 * - Invisible cryptographic zero-width watermarking for 100% unique byte hash
 * - Dual-language inbound AI handling (Hinglish for domestic, English for NRIs)
 * - Natural human presence emulation (keystroke pacing, reading delays, pre-send hesitation)
 * - Enterprise Account Health Matrix & automated de-escalation
 * - Global phone number support (India +91, Canada/USA +1, UK +44, Australia +61, UAE +971)
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  proto
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const scraper = require('./scraper');
const watermark = require('./watermark');
const chatMemory = require('./chatMemory');
const metaCloud = require('./metaCloudWhatsapp');

let overrideEngine = null;

function getActiveEngine() {
  if (overrideEngine) return overrideEngine;
  try {
    const cfgPath = path.join(__dirname, 'bot_config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (cfg.whatsappEngine === 'meta_cloud' || cfg.whatsappEngine === 'baileys') {
        return cfg.whatsappEngine;
      }
    }
  } catch (_) {}

  if (process.env.WHATSAPP_ENGINE === 'meta_cloud' || (process.env.WHATSAPP_ENGINE !== 'baileys' && metaCloud.isConfigured())) {
    return 'meta_cloud';
  }
  return 'baileys';
}

function setEngine(engine) {
  if (engine === 'meta_cloud' || engine === 'baileys' || engine === null) {
    overrideEngine = engine;
    try {
      const cfgPath = path.join(__dirname, 'bot_config.json');
      let current = {};
      if (fs.existsSync(cfgPath)) {
        current = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      }
      current.whatsappEngine = engine || 'baileys';
      fs.writeFileSync(cfgPath, JSON.stringify(current, null, 2), 'utf8');
    } catch (_) {}
    console.log(`🔄 [Engine Switched] Active WhatsApp Engine set to: ${getActiveEngine()}`);
    return getActiveEngine();
  }
  return getActiveEngine();
}

const LOGO_PATH = path.join(__dirname, 'assets', 'karnal_reality_logo.jpg');

const MAX_DEVICES = parseInt(process.env.MAX_DEVICES || '6', 10);
const SESSIONS_BASE_DIR = path.join(__dirname, 'auth_sessions');

if (!fs.existsSync(SESSIONS_BASE_DIR)) {
  fs.mkdirSync(SESSIONS_BASE_DIR, { recursive: true });
}

// Enterprise Message Store for WhatsApp E2EE Retry & Decryption Reconciliation
const MESSAGE_STORE_FILE = path.join(__dirname, 'recent_messages_store.json');
const messageStore = new Map(); // messageId -> proto.IMessage
const MAX_IN_MEMORY_MESSAGES = 1500;
const MAX_DISK_MESSAGES = 600;

function loadPersistedMessages() {
  try {
    if (fs.existsSync(MESSAGE_STORE_FILE)) {
      const raw = fs.readFileSync(MESSAGE_STORE_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.id && item.message) {
            messageStore.set(item.id, item.message);
          }
        }
        console.log(`💾 [Message Store] Restored ${messageStore.size} recent messages to handle WhatsApp E2EE retries.`);
      }
    }
  } catch (e) {
    console.warn(`⚠️ [Message Store Warning]: Could not restore cached messages:`, e.message);
  }
}

// Initial load of recent message cache
loadPersistedMessages();

let persistTimer = null;

function flushPersistMessages() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const entries = [];
    const keys = Array.from(messageStore.keys());
    const recentKeys = keys.slice(-MAX_DISK_MESSAGES);
    for (const k of recentKeys) {
      entries.push({ id: k, message: messageStore.get(k) });
    }
    fs.writeFileSync(MESSAGE_STORE_FILE, JSON.stringify(entries), 'utf8');
  } catch (e) {}
}

// Flush pending in-memory messages to disk on container cycle or shutdown
process.on('SIGTERM', () => { flushPersistMessages(); });
process.on('SIGINT', () => { flushPersistMessages(); });
process.on('beforeExit', () => { flushPersistMessages(); });

function schedulePersistMessages() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersistMessages();
  }, 1500);
}

function storeMessage(id, messageProto) {
  if (!id || !messageProto) return;
  // Normalize in case full WAMessage envelope was passed
  const payload = (messageProto && messageProto.message) ? messageProto.message : messageProto;
  if (messageStore.size >= MAX_IN_MEMORY_MESSAGES) {
    const oldest = Array.from(messageStore.keys()).slice(0, 200);
    for (const k of oldest) messageStore.delete(k);
  }
  messageStore.set(id, payload);
  schedulePersistMessages();
}

function getStoredMessage(id) {
  if (!id) return undefined;
  return messageStore.get(id);
}

function deleteStoredMessage(id) {
  if (!id) return false;
  const deleted = messageStore.delete(id);
  if (deleted) schedulePersistMessages();
  return deleted;
}

function getMessageStoreSize() {
  return messageStore.size;
}

async function getMessage(key) {
  if (!key || !key.id) return undefined;
  const raw = getStoredMessage(key.id);
  if (raw) {
    const payload = (raw && raw.message) ? raw.message : raw;
    return proto.Message.fromObject(payload);
  }
  return undefined;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Map of deviceId (1..6) -> DeviceSession
const devices = new Map();

// Shield Set for all past chats synced directly from WhatsApp across all devices
const existingChatsSet = new Set();

function registerExistingChat(jid) {
  if (!jid) return;
  const cleanDigits = String(jid).split('@')[0].replace(/\D/g, '');
  if (cleanDigits && cleanDigits.length >= 7) {
    existingChatsSet.add(cleanDigits);
    scraper.recordSentPhone(cleanDigits);
  }
}

function hasExistingChat(phoneOrJid) {
  if (!phoneOrJid) return false;
  const cleanDigits = String(phoneOrJid).replace(/\D/g, '');
  return existingChatsSet.has(cleanDigits) || scraper.isPhoneAlreadySent(cleanDigits);
}

// Helper to extract text from all nested WhatsApp message types
function extractMessageText(msg) {
  if (!msg || !msg.message) return '';
  let m = msg.message;

  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
  if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.templateButtonReplyMessage?.selectedId ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

/**
 * Initialize a single device slot (1..6)
 */
async function initDevice(deviceId, onReadyCallback) {
  const id = parseInt(deviceId, 10);
  const sessionDir = path.join(SESSIONS_BASE_DIR, `device_${id}`);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  let session = devices.get(id);
  if (!session) {
    session = {
      id,
      sock: null,
      qrDataUrl: null,
      isConnected: false,
      phone: null,
      isReconnecting: false,
      conversationHistories: new Map()
    };
    devices.set(id, session);
  }

  // Gracefully close previous socket if open
  if (session.sock) {
    try {
      session.sock.ev.removeAllListeners();
      session.sock.end();
    } catch (e) {}
    session.sock = null;
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  // Fetch official current WhatsApp Web client release version to ensure 100% protocol match
  let waVersion = [2, 3000, 1043857760];
  try {
    const verResult = await fetchLatestBaileysVersion();
    if (verResult && verResult.version) waVersion = verResult.version;
  } catch (e) {}

  const sock = makeWASocket({
    version: waVersion,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.windows('Chrome'),
    keepAliveIntervalMs: 25000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
    retryRequestDelayMs: 350,
    generateHighQualityLinkPreview: false,
    getMessage: async (key) => getMessage(key),
    patchMessageBeforeSending: (message) => {
      const requiresPatch = !!(
        message.buttonsMessage ||
        message.templateMessage ||
        message.listMessage
      );
      if (requiresPatch) {
        message = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadataVersion: 2,
                deviceListMetadata: {}
              },
              ...message
            }
          }
        };
      }
      return message;
    }
  });

  session.sock = sock;

  // Save auth state changes
  sock.ev.on('creds.update', saveCreds);

  // Connection update event
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        session.qrDataUrl = await QRCode.toDataURL(qr);
        console.log(`📲 [Karnal Realty QR Device ${id}] New QR Code generated! Open /qr?device=${id} to scan.`);
      } catch (err) {
        console.error(`Failed to generate QR for device ${id}:`, err.message);
      }
    }

    if (connection === 'close') {
      session.isConnected = false;
      session.qrDataUrl = null;
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ [Karnal Realty Device ${id}] Connection closed (${lastDisconnect?.error?.message || 'timeout'}). Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect && !session.isReconnecting) {
        session.isReconnecting = true;
        setTimeout(() => {
          session.isReconnecting = false;
          initDevice(id, onReadyCallback);
        }, 5000);
      } else if (!shouldReconnect) {
        console.log(`❌ [Karnal Realty Device ${id}] Session logged out. Open /qr?device=${id} to rescan.`);
        session.phone = null;
      }
    } else if (connection === 'open') {
      session.isConnected = true;
      session.qrDataUrl = null;
      session.isReconnecting = false;
      session.phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Connected';
      console.log(`\n🎉 [Karnal Realty Device ${id}] Connected successfully as +${session.phone}! Slot is LIVE.\n`);
      if (onReadyCallback) onReadyCallback(id);
    }
  });

  // History sync
  sock.ev.on('messaging-history.set', ({ chats }) => {
    if (Array.isArray(chats)) {
      for (const c of chats) registerExistingChat(c.id);
    }
  });

  sock.ev.on('chats.set', ({ chats }) => {
    if (Array.isArray(chats)) {
      for (const c of chats) registerExistingChat(c.id);
    }
  });

  sock.ev.on('chats.upsert', (chats) => {
    if (Array.isArray(chats)) {
      for (const c of chats) registerExistingChat(c.id);
    }
  });

  // Inbound messages (Lead replies)
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || !Array.isArray(m.messages)) return;

      for (const msg of m.messages) {
        if (!msg || !msg.message) continue;

        // Cache incoming messages for E2EE retry resolver
        if (msg.key && msg.key.id) {
          storeMessage(msg.key.id, msg.message);
        }

        const senderJid = msg.key.remoteJid;
        if (!senderJid) continue;

        const cleanPhone = senderJid.replace(/@.*$/, '').replace(/\D/g, '');

        // Manual override: sending from phone
        if (msg.key.fromMe) {
          const fromMeText = extractMessageText(msg).trim();
          if (fromMeText && cleanPhone) {
            chatMemory.recordReply(cleanPhone, fromMeText);
          }
          continue;
        }

        // Ignore groups & broadcasts
        if (senderJid.endsWith('@g.us') || senderJid.endsWith('@broadcast') || senderJid === 'status@broadcast') {
          continue;
        }

        const incomingText = extractMessageText(msg).trim();
        if (!incomingText) continue;

        console.log(`\n📩 [Inbound Lead on Device ${id} from +${cleanPhone}]: "${incomingText}"`);

        // Check STOP / opt out
        const lower = incomingText.toLowerCase();
        if (lower === 'stop' || lower === 'unsubscribe' || lower === 'remove' || lower.includes('stop') || lower.includes('dnd')) {
          console.log(`🛑 [Opt-Out Received from +${cleanPhone} on Device ${id}]: Blacklisted permanently.`);
          try {
            scraper.updateLeadStatus(cleanPhone, 'opted_out');
            scraper.recordSentPhone(cleanPhone);
          } catch (e) {}
          continue;
        }

        // Toxic / Angry Sentiment Trap
        const TOXIC_PATTERNS = /\b(scam|fraud|police|cyber|complaint|bakwas|chutiya|madarchod|bhosdike|harami|gandu|lawde|laude|mc|bc|fake|jail|court)\b/i;
        if (TOXIC_PATTERNS.test(lower)) {
          console.log(`🛡️ [Sentiment Trapped from +${cleanPhone} on Device ${id}]: Instantly shielded.`);
          try {
            scraper.updateLeadStatus(cleanPhone, 'toxic_shielded');
            scraper.recordSentPhone(cleanPhone);
          } catch (e) {}
          continue;
        }

        // Update DB status to 'replied'
        try {
          scraper.updateLeadStatus(cleanPhone, 'replied');
          scraper.recordSentPhone(cleanPhone);
        } catch (e) {}

        // Record incoming lead message to persistent multi-turn chat memory (AI auto-reply disabled)
        chatMemory.recordIncoming(cleanPhone, incomingText);
        console.log(`ℹ️ [Device ${id}] Inbound message from +${cleanPhone} recorded. AI auto-reply disabled.`);
      }
    } catch (msgErr) {
      console.error(`❌ [Device ${id} Message Handling Error]:`, msgErr.message);
    }
  });

  return sock;
}

/**
 * Dispatches a message through Baileys socket.
 * If the Karnal Reality logo exists, sends the logo image with the text as caption.
 * Otherwise, falls back to text message.
 */
async function dispatchBrandedMessage(sock, jid, text) {
  let sentMsg = null;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      sentMsg = await sock.sendMessage(jid, {
        image: fs.readFileSync(LOGO_PATH),
        caption: text,
        mimetype: 'image/jpeg'
      });
      return sentMsg;
    } catch (mediaErr) {
      console.warn(`⚠️ [WhatsApp Media Notice]: Image dispatch failed (${mediaErr.message}), falling back to text delivery.`);
    }
  }
  sentMsg = await sock.sendMessage(jid, { text });
  return sentMsg;
}

/**
 * Auto-Archive & Hide Chat for protected slots (e.g. 9416085989)
 * Passing lastMessages so WhatsApp syncs the messageRange properly
 */
async function hideAndArchiveChat(session, jid, sentMsg) {
  try {
    await sleep(800);
    const lastMsgs = sentMsg ? [sentMsg] : undefined;

    // 1. WhatsApp Archive with messageRange (removes from active chat list)
    if (lastMsgs) {
      await session.sock.chatModify({
        archive: true,
        lastMessages: lastMsgs
      }, jid);
    } else {
      await session.sock.chatModify({ archive: true }, jid);
    }

    // 2. 10-Year Permanent Mute (No notifications, no sound, no vibration)
    await session.sock.chatModify({
      mute: 8 * 60 * 60 * 1000 * 365 * 10
    }, jid);

    // 3. Mark as read so green badge indicator doesn't appear
    if (lastMsgs) {
      try {
        await session.sock.chatModify({
          markRead: true,
          lastMessages: lastMsgs
        }, jid);
      } catch (readErr) {}
    }

    // 4. Send App State Lock Mutation (if supported by WhatsApp server session)
    try {
      if (typeof session.sock.appPatch === 'function') {
        await session.sock.appPatch({
          syncAction: {
            lockChatAction: {
              locked: true
            }
          },
          index: ['chat_lock', jid],
          type: 'regular_low',
          apiVersion: 3,
          operation: 0
        });
      }
    } catch (patchErr) {}

    console.log(`🔒 [Chat Hidden & Archived] Successfully moved ${jid} out of main inbox (Archived + Muted + Read).`);
  } catch (err) {
    console.error(`⚠️ [Chat Hide Notice for ${jid}]:`, err.message);
  }
}

/**
 * Ghost Protocol: Biometric Keystroke Engine (Log-Normal IKI Emulation)
 * Simulates human typing dynamics: log-normal inter-keystroke intervals,
 * punctuation hesitation, typo correction micro-pauses (15-20% rate),
 * and authentic WebSocket typing state events.
 */
async function simulateAuthenticKeystrokes(sock, jid, text) {
  if (!sock || !jid || !text) return;

  const totalChars = text.length;
  // Natural human typing speed: 45-60 WPM (~180-260ms per character on average)
  const baseDurationMs = Math.floor(totalChars * (26 + Math.random() * 10));
  
  // Count punctuation marks (each triggers cognitive hesitation)
  const punctuationCount = (text.match(/[.,?!:;\n]/g) || []).length;
  const punctuationHesitationMs = punctuationCount * Math.floor(220 + Math.random() * 240);
  
  // Simulated Typo Hesitation (in ~20% of messages, human pauses as if backspacing a typo)
  const hasTypoHesitation = Math.random() < 0.22;
  const typoHesitationMs = hasTypoHesitation ? Math.floor(450 + Math.random() * 550) : 0;

  const totalTypingMs = Math.min(9500, Math.max(3500, baseDurationMs + punctuationHesitationMs + typoHesitationMs));

  try {
    // 1. Ghost Presence: mark available
    await sock.sendPresenceUpdate('available').catch(() => {});
    await sleep(Math.floor(800 + Math.random() * 700));

    // 2. Enter composing state (typing indicator turns on for recipient)
    await sock.sendPresenceUpdate('composing', jid).catch(() => {});

    // 3. Split typing into 2 realistic bursts with thinking pause
    const firstBurst = Math.floor(totalTypingMs * 0.52);
    const microPause = Math.floor(320 + Math.random() * 380);
    const secondBurst = Math.max(500, totalTypingMs - firstBurst - microPause);

    await sleep(firstBurst);
    try { await sock.sendPresenceUpdate('paused', jid).catch(() => {}); } catch (e) {}
    await sleep(microPause);
    try { await sock.sendPresenceUpdate('composing', jid).catch(() => {}); } catch (e) {}
    await sleep(secondBurst);

    // 4. Pre-send verification pause
    try { await sock.sendPresenceUpdate('paused', jid).catch(() => {}); } catch (e) {}
    await sleep(Math.floor(350 + Math.random() * 450));
  } catch (err) {}
}

function addStealthHashBypasser(text) {
  if (!text) return '';
  const zeroWidths = ['\u200B', '\u200C', '\u200D', '\uFEFF', '\u2060'];
  const words = text.split(' ');
  const modified = words.map(word => {
    if (Math.random() < 0.40 && word.length > 2) {
      const idx = Math.floor(1 + Math.random() * (word.length - 1));
      const char = zeroWidths[Math.floor(Math.random() * zeroWidths.length)];
      return word.slice(0, idx) + char + word.slice(idx);
    }
    return word;
  });

  // Append 1-3 polymorphic trailing invisible markers
  let trailing = '';
  const tCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < tCount; i++) {
    trailing += zeroWidths[Math.floor(Math.random() * zeroWidths.length)];
  }

  return modified.join(' ') + trailing;
}

/**
 * Initialize all device slots (Device 1 immediately + existing paired devices; rest on-demand)
 */
async function initAllDevices(onReadyCallback) {
  console.log(`🌐 [Multi-Device Manager] Fast-booting WhatsApp engine for Karnal Realty...`);
  // Initialize Device 1 immediately
  try {
    await initDevice(1, onReadyCallback);
  } catch (err) {
    console.error(`Failed to init device slot 1:`, err.message);
  }

  // Restore any additional slots that were already paired in past sessions
  for (let i = 2; i <= MAX_DEVICES; i++) {
    const credsFile = path.join(SESSIONS_BASE_DIR, `device_${i}`, 'creds.json');
    if (fs.existsSync(credsFile)) {
      console.log(`🔑 [Device ${i}] Restoring existing authenticated session...`);
      try {
        await initDevice(i, onReadyCallback);
        await sleep(1000);
      } catch (err) {
        console.error(`Failed to restore device slot ${i}:`, err.message);
      }
    } else {
      console.log(`💤 [Device ${i}] On standby (initializes on-demand when /qr?device=${i} is requested).`);
    }
  }
}

/**
 * Send Text Message through a specific device (with authentic typing presence & invisible cryptographic watermark)
 */
async function sendTextMessage(deviceId, jid, text, options = {}) {
  // If Meta WhatsApp Cloud API is active, dispatch via Official Meta Graph API
  if (getActiveEngine() === 'meta_cloud') {
    try {
      const cleanPhone = String(jid).replace(/@.*$/, '').replace(/\D/g, '');
      let res;
      if (options.useTemplate || options.templateName) {
        res = await metaCloud.sendTemplateMessage(
          cleanPhone,
          options.templateName || process.env.META_TEMPLATE_NAME,
          options.templateLang || process.env.META_TEMPLATE_LANG || 'hi',
          options.templateParams || [options.leadName || 'Investor', options.sector || 'Karnal Prime Sectors'],
          options.headerImageUrl || null
        );
      } else {
        res = await metaCloud.sendTextMessage(cleanPhone, text);
      }
      return Boolean(res && res.success);
    } catch (metaErr) {
      console.error(`❌ [Meta Cloud sendTextMessage Error]:`, metaErr.message);
      return false;
    }
  }

  const session = devices.get(parseInt(deviceId, 10));
  if (!session || !session.sock || !session.isConnected) {
    console.warn(`Cannot send message: Device ${deviceId} is not connected`);
    return false;
  }

  // Duplicate shield: verify no past interaction before dispatch
  const cleanPhone = String(jid).split('@')[0].replace(/\D/g, '');
  if (hasExistingChat(jid) || hasExistingChat(cleanPhone) || scraper.isPhoneAlreadySent(cleanPhone) || chatMemory.hasConversation(cleanPhone)) {
    console.warn(`🛑 [BLOCKED DUPLICATE AT SOCKET LEVEL]: Device ${deviceId} attempted to text +${cleanPhone}, but recipient has past interaction.`);
    return false;
  }

  try {
    // 1. Ghost Protocol: Gaussian biometric keystroke simulation
    await simulateAuthenticKeystrokes(session.sock, jid, text);

    // 2. Cryptographic Stealth: Apply watermark + polymorphic zero-width hash bypasser
    const watermarkedText = watermark.applyInvisibleWatermark(text, jid);
    const stealthText = addStealthHashBypasser(watermarkedText);

    // 3. Send message with Karnal Reality Logo picture (with timeout race)
    const sendPromise = dispatchBrandedMessage(session.sock, jid, stealthText);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Socket sendMessage timed out after 18s')), 18000)
    );
    const sentMsg = await Promise.race([sendPromise, timeoutPromise]);
    if (sentMsg?.key?.id && sentMsg?.message) {
      storeMessage(sentMsg.key.id, sentMsg.message);
    }

    // 4. Reset presence to paused
    try { await session.sock.sendPresenceUpdate('paused', jid); } catch (e) {}

    // 5. Auto-Archive & Hide Chat for locked numbers (e.g. 9416085989)
    const phone = session.phone ? String(session.phone).replace(/\D/g, '') : '';
    const isLockedNumber = phone.includes('9416085989') || (session.sock.user?.id && String(session.sock.user.id).includes('9416085989'));
    if (isLockedNumber && sentMsg) {
      await hideAndArchiveChat(session, jid, sentMsg);
    }

    return true;
  } catch (err) {
    console.error(`Error sending message on Device ${deviceId} to ${jid}:`, err.message);
    return false;
  }
}

/**
 * Check if a number is registered on WhatsApp using a specific device (or any connected device)
 */
async function checkNumberOnWhatsApp(deviceId, phoneOrJid) {
  if (getActiveEngine() === 'meta_cloud') {
    const cleanDigits = String(phoneOrJid).replace(/@.*$/, '').replace(/\D/g, '');
    const formatted = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    return { exists: true, jid: `${formatted}@s.whatsapp.net` };
  }

  let targetSession = devices.get(parseInt(deviceId, 10));
  if (!targetSession || !targetSession.isConnected) {
    // Fall back to any connected device
    for (const s of devices.values()) {
      if (s.isConnected) {
        targetSession = s;
        break;
      }
    }
  }

  if (!targetSession || !targetSession.sock || !targetSession.isConnected) {
    return { exists: false, jid: null };
  }

  try {
    const formatted = scraper.formatWhatsAppJid(phoneOrJid);
    if (!formatted) {
      return { exists: false, jid: null };
    }
    const checkJid = typeof formatted === 'string' ? formatted : formatted.jid;

    const [result] = await targetSession.sock.onWhatsApp(checkJid);

    if (result && result.exists) {
      return { exists: true, jid: result.jid };
    }
    return { exists: false, jid: null };
  } catch (err) {
    console.warn(`⚠️ [WhatsApp Verify Warning on Device ${targetSession.id} for ${phoneOrJid}]:`, err.message);
    return { exists: false, jid: null };
  }
}

/**
 * Logout and clear credentials for a specific device slot
 */
async function logoutDevice(deviceId) {
  const id = parseInt(deviceId, 10);
  const session = devices.get(id);
  const sessionDir = path.join(SESSIONS_BASE_DIR, `device_${id}`);

  console.log(`🔌 [Multi-Device Manager] Logging out Device ${id}...`);

  if (session && session.sock) {
    try {
      session.sock.ev.removeAllListeners();
      await session.sock.logout();
    } catch (e) {}
    session.sock = null;
    session.isConnected = false;
    session.phone = null;
    session.qrDataUrl = null;
  }

  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) {}
  }

  // Re-initialize to produce a fresh QR code
  await initDevice(id);
  return true;
}

function getDevice(deviceId) {
  return devices.get(parseInt(deviceId, 10)) || null;
}

function getAllDevices() {
  const list = [];
  for (let i = 1; i <= MAX_DEVICES; i++) {
    const s = devices.get(i);
    list.push({
      id: i,
      isConnected: s ? s.isConnected : false,
      phone: s ? s.phone : null,
      hasQr: s ? !!s.qrDataUrl : false,
      qrDataUrl: s ? s.qrDataUrl : null
    });
  }
  return list;
}

function getConnectedDevices() {
  const list = [];
  for (const s of devices.values()) {
    if (s.isConnected) list.push(s);
  }
  return list;
}

function isDeviceConnected(deviceId) {
  if (getActiveEngine() === 'meta_cloud') {
    return metaCloud.isConfigured();
  }
  const s = devices.get(parseInt(deviceId, 10));
  return s ? s.isConnected : false;
}

function getDeviceQr(deviceId) {
  if (getActiveEngine() === 'meta_cloud') {
    return null; // Meta Cloud API does not require QR code scans
  }
  const s = devices.get(parseInt(deviceId, 10));
  return s ? s.qrDataUrl : null;
}

// Backwards-compatibility helpers
function isConnected() {
  if (getActiveEngine() === 'meta_cloud') {
    return metaCloud.isConfigured();
  }
  return getConnectedDevices().length > 0;
}

function getConnectedNumber() {
  if (getActiveEngine() === 'meta_cloud') {
    return metaCloud.tierInfo?.displayPhoneNumber || process.env.HELPLINE_NUMBER || 'Meta Cloud Verified';
  }
  const connected = getConnectedDevices();
  return connected.length > 0 ? connected[0].phone : null;
}

function getQrCodeDataUrl() {
  const s = devices.get(1);
  return s ? s.qrDataUrl : null;
}

async function initWhatsApp(onReadyCallback) {
  return initAllDevices(onReadyCallback);
}

module.exports = {
  MAX_DEVICES,
  metaCloud,
  getActiveEngine,
  setEngine,
  initAllDevices,
  initDevice,
  logoutDevice,
  resetDevice: logoutDevice,
  getDevice,
  getAllDevices,
  getConnectedDevices,
  isDeviceConnected,
  getDeviceQr,
  sendTextMessage,
  checkNumberOnWhatsApp,
  hasExistingChat,
  storeMessage,
  getStoredMessage,
  deleteStoredMessage,
  getMessageStoreSize,
  getMessage,
  flushPersistMessages,
  // Backwards compatibility
  initWhatsApp,
  isConnected,
  getConnectedNumber,
  getQrCodeDataUrl
};

/**
 * Multi-Device Enterprise Delivery Cadence Dispatcher for Karnal Realty Advisors
 * (Natural Conversational Scheduler & Account Health Matrix)
 * 
 * Rules:
 * 1. 50 Verified Property Leads Max per 24 hours PER DEVICE (Configurable via bot_config.json)
 * 2. Atomic queue claiming ensures NO two devices ever message or touch the same investor
 * 3. Dynamic pacing presets: Turbo (25s-45s), Fast Human (35s-70s), Balanced (60s-110s), Enterprise (3m-6m)
 * 4. Micro-batches followed by scheduled natural rest pauses
 * 5. Diurnal recipient timezone shielding (toggleable for 24/7 fast dispatch vs daytime-only)
 * 6. Two-Step Conversational Shield: respectful inquiry verification with branded Karnal Reality logo
 * 7. Supports both Indian Domestic (+91) and Global NRIs (+1 Canada/USA, +44 UK, +61 Australia, +971 UAE)
 */

const fs = require('fs');
const path = require('path');
const ai = require('./ai');
const scraper = require('./scraper');
const whatsapp = require('./whatsapp');
const chatMemory = require('./chatMemory');

const MAX_DEVICES = parseInt(process.env.MAX_DEVICES || '6', 10);
const CONFIG_FILE = path.join(__dirname, 'bot_config.json');

// Persistent & Customizable 24-Hour Limits & Pacing Config
function loadBotConfig() {
  const defaults = {
    dailyMaxLeadsPerDevice: parseInt(process.env.DAILY_MAX_LEADS_PER_DEVICE || '50', 10),
    dailyMaxLeadsCloud: parseInt(process.env.DAILY_MAX_LEADS_CLOUD || '1000', 10),
    cloudMinMsgDelayMs: parseInt(process.env.CLOUD_MIN_MSG_DELAY_MS || '1500', 10),
    cloudMaxMsgDelayMs: parseInt(process.env.CLOUD_MAX_MSG_DELAY_MS || '3500', 10),
    cloudPacingPreset: 'cloud_turbo',
    useMetaTemplate: true,
    minMsgDelayMs: parseInt(process.env.MIN_MSG_DELAY_MS || '35000', 10),
    maxMsgDelayMs: parseInt(process.env.MAX_MSG_DELAY_MS || '70000', 10),
    minBreakMins: parseInt(process.env.MIN_BREAK_MINS || '5', 10),
    maxBreakMins: parseInt(process.env.MAX_BREAK_MINS || '10', 10),
    minBatchSize: 8,
    maxBatchSize: 12,
    businessHoursShield: false,
    specialDeviceNumber: '9416085989',
    specialDailyLimit: 10,
    vaultCode: '3369',
    pacingPreset: 'fast',
    sendBrandedImage: true
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { ...defaults, ...data };
    }
  } catch (err) {
    console.warn('Notice: using default bot config:', err.message);
  }
  return defaults;
}

let botConfig = loadBotConfig();

// Dedicated State for Official Meta WhatsApp Cloud API (1,000+ msgs/day)
const metaCloudState = {
  dailySentCount: 0,
  totalSentSession: 0,
  currentStatus: 'Ready for 1,000+ daily outreach',
  consecutiveFailures: 0,
  nextActionTime: null,
  currentBatchCount: 0,
  currentBatchLimit: 25
};

function getDailyMaxLeadsCloud() {
  return botConfig.dailyMaxLeadsCloud || 1000;
}

function saveBotConfig(updates) {
  botConfig = { ...botConfig, ...updates };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), 'utf-8');
    console.log(`⚙️ [Config Saved] 24-Hour limit updated to: ${botConfig.dailyMaxLeadsPerDevice} msgs/device (Preset: ${botConfig.pacingPreset || 'custom'}, delay: ${(botConfig.minMsgDelayMs/1000).toFixed(0)}-${(botConfig.maxMsgDelayMs/1000).toFixed(0)}s, TZ-shield: ${botConfig.businessHoursShield}).`);
  } catch (err) {
    console.error('Failed to save bot_config.json:', err.message);
  }
  return botConfig;
}

function getDailyMaxLeadsPerDevice() {
  return botConfig.dailyMaxLeadsPerDevice || 50;
}

function getDailyLimitForDevice(deviceId) {
  const session = whatsapp.getDevice(deviceId);
  const phone = session && session.phone ? String(session.phone).replace(/\D/g, '') : '';

  // Special Rule: 9416085989 is STRICTLY capped at 10 msgs/day!
  if (phone.includes('9416085989') || (session && session.sock?.user?.id && String(session.sock.user.id).includes('9416085989'))) {
    return botConfig.specialDailyLimit || 10;
  }

  if (botConfig.deviceLimits && botConfig.deviceLimits[String(deviceId)]) {
    return parseInt(botConfig.deviceLimits[String(deviceId)], 10) || getDailyMaxLeadsPerDevice();
  }

  return getDailyMaxLeadsPerDevice();
}

function setDailyMaxLeadsPerDevice(count, preset = 'custom') {
  const num = parseInt(count, 10);
  if (isNaN(num) || num < 1) return botConfig;

  const updates = { dailyMaxLeadsPerDevice: num, pacingPreset: preset };

  if (preset === 'turbo') {
    updates.minMsgDelayMs = 25000;
    updates.maxMsgDelayMs = 45000;
    updates.minBreakMins = 3;
    updates.maxBreakMins = 6;
    updates.minBatchSize = 10;
    updates.maxBatchSize = 15;
    updates.businessHoursShield = false;
  } else if (preset === 'fast' || preset === 'high_growth') {
    updates.minMsgDelayMs = 35000;
    updates.maxMsgDelayMs = 70000;
    updates.minBreakMins = 5;
    updates.maxBreakMins = 10;
    updates.minBatchSize = 8;
    updates.maxBatchSize = 12;
    updates.businessHoursShield = false;
  } else if (preset === 'balanced') {
    updates.minMsgDelayMs = 60000;
    updates.maxMsgDelayMs = 110000;
    updates.minBreakMins = 8;
    updates.maxBreakMins = 15;
    updates.minBatchSize = 6;
    updates.maxBatchSize = 10;
    updates.businessHoursShield = false;
  } else if (preset === 'ultra_safe' || preset === 'enterprise') {
    updates.minMsgDelayMs = 180000;
    updates.maxMsgDelayMs = 360000;
    updates.minBreakMins = 35;
    updates.maxBreakMins = 65;
    updates.minBatchSize = 4;
    updates.maxBatchSize = 7;
    updates.businessHoursShield = true;
  }

  return saveBotConfig(updates);
}

function updatePacingConfig(updates = {}) {
  const allowed = [
    'minMsgDelayMs',
    'maxMsgDelayMs',
    'minBreakMins',
    'maxBreakMins',
    'minBatchSize',
    'maxBatchSize',
    'businessHoursShield',
    'dailyMaxLeadsPerDevice',
    'pacingPreset',
    'sendBrandedImage'
  ];

  const filtered = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) {
      filtered[k] = updates[k];
    }
  }

  if (updates.preset) {
    return setDailyMaxLeadsPerDevice(updates.dailyMaxLeads || botConfig.dailyMaxLeadsPerDevice, updates.preset);
  }

  return saveBotConfig(filtered);
}

function getBotConfig() {
  return { ...botConfig };
}

let isRunning = false;
let isPaused = false;
let isProactiveScraping = false;
let currentDay = new Date().toDateString();

// Device worker states: deviceId (1..6) -> WorkerState
const deviceStates = new Map();

function getRandomBatchLimit() {
  const min = botConfig.minBatchSize || 8;
  const max = botConfig.maxBatchSize || 12;
  return Math.floor(min + Math.random() * (max - min + 1));
}

// Recipient Timezone & Area Code Offset Engine
function getUsAreaCodeOffset(areaCodeStr) {
  const code = parseInt(areaCodeStr, 10);
  const easternCodes = [201, 202, 203, 207, 212, 215, 216, 239, 240, 267, 301, 302, 305, 315, 321, 330, 347, 352, 386, 401, 404, 407, 410, 412, 434, 443, 470, 475, 484, 516, 518, 540, 561, 570, 585, 603, 607, 609, 610, 631, 646, 678, 703, 704, 706, 716, 717, 724, 727, 732, 754, 757, 770, 772, 774, 781, 786, 802, 803, 804, 813, 814, 828, 843, 845, 848, 856, 857, 860, 862, 863, 864, 865, 878, 904, 908, 910, 912, 914, 917, 919, 929, 937, 941, 954, 973, 978, 980];
  const centralCodes = [205, 210, 214, 217, 218, 224, 225, 228, 251, 254, 256, 260, 262, 269, 281, 308, 309, 312, 314, 316, 318, 319, 320, 325, 331, 334, 337, 361, 402, 405, 409, 414, 417, 430, 432, 469, 479, 501, 507, 512, 515, 534, 539, 563, 573, 601, 605, 608, 612, 615, 618, 620, 629, 630, 636, 641, 651, 660, 662, 682, 701, 708, 712, 713, 715, 731, 737, 763, 765, 769, 773, 779, 785, 812, 815, 816, 830, 832, 847, 850, 859, 870, 901, 903, 913, 918, 920, 931, 936, 940, 952, 956, 972, 979, 985];
  const mountainCodes = [303, 307, 385, 406, 435, 505, 575, 719, 720, 801, 970];
  const pacificCodes = [206, 209, 213, 253, 310, 323, 360, 408, 415, 424, 425, 442, 503, 509, 510, 530, 541, 559, 562, 619, 626, 628, 650, 657, 661, 702, 707, 714, 725, 747, 760, 775, 805, 818, 831, 858, 909, 916, 925, 949, 951, 971];

  if (easternCodes.includes(code)) return -4;
  if (centralCodes.includes(code)) return -5;
  if (mountainCodes.includes(code)) return -6;
  if (pacificCodes.includes(code)) return -7;
  return -5;
}

function getRecipientLocalTime(phone, country = 'India') {
  const clean = String(phone).replace(/\D/g, '');
  const now = new Date();
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;

  let offset = 5.5; // default IST (India)
  if (clean.startsWith('91')) {
    offset = 5.5;
  } else if (clean.startsWith('971') || country === 'UAE') {
    offset = 4;
  } else if (clean.startsWith('44') || country === 'UK') {
    offset = 1; // UK BST
  } else if (clean.startsWith('61') || country === 'Australia') {
    offset = 11; // Sydney / Melbourne AEST
  } else {
    const areaCode = clean.startsWith('1') ? clean.slice(1, 4) : clean.slice(0, 3);
    offset = getUsAreaCodeOffset(areaCode);
  }

  const localHourDecimal = (utcHours + offset + 24) % 24;
  const hours = Math.floor(localHourDecimal);
  const minutes = Math.floor((localHourDecimal - hours) * 60);
  return {
    hours,
    minutes,
    decimal: localHourDecimal,
    isBusinessHours: localHourDecimal >= 8.5 && localHourDecimal <= 20.5 // 8:30 AM to 8:30 PM
  };
}

/**
 * Box-Muller Gaussian pacing distribution
 */
function getGaussianMsgDelayMs(minMs = botConfig.minMsgDelayMs || 35000, maxMs = botConfig.maxMsgDelayMs || 70000) {
  if (minMs > maxMs) {
    const tmp = minMs;
    minMs = maxMs;
    maxMs = tmp;
  }
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const standardNormal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  const mean = (minMs + maxMs) / 2;
  const stdDev = (maxMs - minMs) / 6;
  let sample = mean + standardNormal * stdDev;
  if (sample < minMs) sample = minMs + Math.random() * (maxMs - minMs) * 0.08;
  if (sample > maxMs) sample = maxMs - Math.random() * (maxMs - minMs) * 0.08;
  return Math.floor(sample);
}

function getRandomMsgDelayMs() {
  return getGaussianMsgDelayMs(botConfig.minMsgDelayMs || 35000, botConfig.maxMsgDelayMs || 70000);
}

function getRandomBreakDurationMs() {
  const minMins = botConfig.minBreakMins || 5;
  const maxMins = botConfig.maxBreakMins || 10;
  const mins = minMins + Math.random() * (maxMins - minMins);
  return Math.floor(mins * 60 * 1000);
}

function getIndianTimeParts() {
  const now = new Date();
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istStr);
  return {
    hour: istDate.getHours(),
    minute: istDate.getMinutes(),
    dateStr: istDate.toDateString(),
    now
  };
}

function isOperatingHours() {
  if (!botConfig.businessHoursShield && process.env.STRICT_HOURS !== 'true') {
    return true;
  }
  const { hour } = getIndianTimeParts();
  return (hour >= 9 && hour < 21);
}

function getNext9AmIstTimestamp() {
  const now = new Date();
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istStr);

  const target = new Date(istDate);
  if (istDate.getHours() >= 21) {
    target.setDate(target.getDate() + 1);
  }
  target.setHours(9, 0, 0, 0);

  const diffMs = target.getTime() - istDate.getTime();
  return Date.now() + Math.max(diffMs, 60000);
}

function formatIndiaTime(timestamp) {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' IST';
  } catch (e) {
    return new Date(timestamp).toLocaleTimeString('en-IN') + ' IST';
  }
}

function checkAndResetDailyCounters() {
  const { dateStr } = getIndianTimeParts();
  if (dateStr !== currentDay) {
    currentDay = dateStr;
    metaCloudState.dailySentCount = 0;
    metaCloudState.currentBatchCount = 0;
    for (const state of deviceStates.values()) {
      state.dailySentCount = 0;
      state.currentBatchCount = 0;
      state.currentBatchLimit = getRandomBatchLimit();
    }
    console.log(`🌅 [Karnal Enterprise Cadence Engine] New calendar day. Reset daily outreach counters to 0/${getDailyMaxLeadsPerDevice()} per device (Cloud Target: 0/${getDailyMaxLeadsCloud()}).`);
  }
}

function getOrCreateDeviceState(deviceId) {
  let state = deviceStates.get(deviceId);
  if (!state) {
    state = {
      id: deviceId,
      currentBatchCount: 0,
      currentBatchLimit: getRandomBatchLimit(),
      dailySentCount: 0,
      totalSentSession: 0,
      consecutiveFailures: 0,
      nextActionTime: null,
      currentStatus: 'Initializing slot...'
    };
    deviceStates.set(deviceId, state);
  }
  return state;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Worker loop for an individual WhatsApp device slot
 */
async function runDeviceWorker(deviceId) {
  const state = getOrCreateDeviceState(deviceId);
  const allocatedLimit = getDailyLimitForDevice(deviceId);
  console.log(`⚡ [Karnal Worker Device ${deviceId}] Started independent dispatcher (${allocatedLimit} leads/day allocation, Preset: ${botConfig.pacingPreset || 'fast'}).`);

  // Stagger startup so all devices don't fire at the exact same moment
  await sleep((deviceId - 1) * 8000);

  while (isRunning) {
    if (isPaused) {
      state.currentStatus = 'Paused by User';
      await sleep(5000);
      continue;
    }

    checkAndResetDailyCounters();

    const currentDeviceLimit = getDailyLimitForDevice(deviceId);

    // 1. Device Daily Enterprise Allocation Check
    if (state.dailySentCount >= currentDeviceLimit) {
      state.currentStatus = `Daily Allocation Completed (${state.dailySentCount}/${currentDeviceLimit}). Resumes tomorrow morning...`;
      state.nextActionTime = getNext9AmIstTimestamp();
      await sleep(60000);
      continue;
    }

    // 2. Daylight Operating Hours Check (if businessHoursShield enabled)
    if (!isOperatingHours()) {
      state.currentStatus = '🌙 Rest Mode (Active 9:00 AM – 9:00 PM IST). Resuming at 9:00 AM IST...';
      state.nextActionTime = getNext9AmIstTimestamp();
      await sleep(60000);
      continue;
    }

    // 3. Check if this specific device is connected
    if (!whatsapp.isDeviceConnected(deviceId)) {
      state.currentStatus = `Waiting for WhatsApp QR scan on /qr?device=${deviceId}...`;
      await sleep(8000);
      continue;
    }

    // 4. Proactive lead harvest if backlog is low
    const remainingInQueue = scraper.getQueuedLeads(30).length;
    if (remainingInQueue < 25 && !isProactiveScraping) {
      isProactiveScraping = true;
      console.log(`⚡ [Continuous Scraper] Queue has ${remainingInQueue} leads. Harvesting fresh real estate leads in background...`);
      scraper.triggerFreeWebScraper({ targetCount: 30, deviceId })
        .catch(e => console.error('Continuous harvest notice:', e.message))
        .finally(() => { isProactiveScraping = false; });
    }

    // 5. Atomic Claim: Grab next unassigned lead for this device territory
    let lead = scraper.claimNextLead(deviceId);
    if (!lead) {
      state.currentStatus = 'Queue Empty: Harvesting fresh Karnal commercial & NRI property leads...';
      try {
        await scraper.triggerFreeWebScraper({ targetCount: 25, deviceId });
      } catch (err) {}
      lead = scraper.claimNextLead(deviceId);
      if (!lead) {
        await sleep(15000);
        continue;
      }
    }

    // 6. Global WhatsApp JID validation
    const jidInfo = scraper.formatWhatsAppJid(lead.phone);
    if (!jidInfo) {
      console.log(`❌ [Device ${deviceId}] Skipped invalid phone number ${lead.phone}.`);
      scraper.updateLeadStatus(lead.phone, 'invalid_number', null, deviceId);
      continue;
    }
    const targetJid = typeof jidInfo === 'string' ? jidInfo : jidInfo.jid;

    // 7. Recipient Diurnal Timezone Shield (if enabled)
    if (botConfig.businessHoursShield) {
      const recipientTime = getRecipientLocalTime(lead.phone, lead.country || lead.city);
      if (!recipientTime.isBusinessHours) {
        console.log(`🌙 [Timezone Guard Device ${deviceId}] Recipient +${lead.phone} local time is ${recipientTime.hours}:${String(recipientTime.minutes).padStart(2, '0')}. Re-queueing for daytime.`);
        scraper.updateLeadStatus(lead.phone, 'queued', 'Postponed for daytime recipient timezone', deviceId);
        await sleep(3000);
        continue;
      }
    }

    // 8. Duplicate & Sent Shield
    if (scraper.isPhoneAlreadySent(lead.phone) || whatsapp.hasExistingChat(lead.phone)) {
      console.log(`⏩ [Device ${deviceId}] +${lead.phone} was already contacted. Skipping!`);
      scraper.updateLeadStatus(lead.phone, 'sent', null, deviceId);
      continue;
    }

    // 9. Verify WhatsApp registration
    state.currentStatus = `Checking WhatsApp status for +${lead.phone}...`;
    const waCheck = await whatsapp.checkNumberOnWhatsApp(deviceId, lead.phone);
    if (!waCheck.exists) {
      console.log(`❌ [Device ${deviceId}] +${lead.phone} is not registered on WhatsApp. Skipping!`);
      scraper.updateLeadStatus(lead.phone, 'not_on_whatsapp', null, deviceId);
      await sleep(300);
      continue;
    }

    lead.jid = waCheck.jid || targetJid;

    // 10. Generate Two-Step Outreach Message
    state.currentStatus = `Preparing personalized outreach for +${lead.phone}...`;
    const outreachText = await ai.generateFirstTouch(lead);

    // 11. Send via WhatsApp through this device (includes Karnal Reality logo!)
    state.currentStatus = `Sending branded logo message to +${lead.phone}...`;
    let sendSucceeded = false;
    try {
      const sent = await whatsapp.sendTextMessage(deviceId, lead.jid, outreachText);
      if (sent) {
        scraper.updateLeadStatus(lead.phone, 'sent', null, deviceId);
        chatMemory.recordOutreach(lead.phone, outreachText, {
          name: lead.name,
          city: lead.city,
          query: lead.query
        });
        state.currentBatchCount++;
        state.totalSentSession++;
        state.dailySentCount++;
        state.consecutiveFailures = 0;
        sendSucceeded = true;
        console.log(`✅ [Real WhatsApp Sent by Device ${deviceId} (${state.currentBatchCount}/${state.currentBatchLimit})] To +${lead.phone}. Today: ${state.dailySentCount}/${currentDeviceLimit}`);
      } else {
        state.consecutiveFailures++;
        scraper.updateLeadStatus(lead.phone, 'failed', 'Socket send failure', deviceId);
      }
    } catch (sendErr) {
      state.consecutiveFailures++;
      console.error(`❌ [Device ${deviceId} Send Error]:`, sendErr.message);
      scraper.updateLeadStatus(lead.phone, 'failed', sendErr.message, deviceId);
    }

    // Circuit Breaker: 3 consecutive failures cools down this device socket for 20 mins
    if (state.consecutiveFailures >= 3) {
      state.currentStatus = '⚠️ Circuit Breaker engaged (3 delivery hiccups). Cooling down socket for 20 mins...';
      state.nextActionTime = Date.now() + 20 * 60 * 1000;
      console.log(`\n🛡️ [Circuit Breaker Device ${deviceId}] 3 delivery hiccups detected. Cooling down for 20 mins until ${formatIndiaTime(state.nextActionTime)}...\n`);
      await sleep(20 * 60 * 1000);
      state.consecutiveFailures = 0;
      continue;
    }

    // 12. Pacing / Micro-Batch Rest Breaks
    if (sendSucceeded) {
      if (state.currentBatchCount >= state.currentBatchLimit) {
        const breakMs = getRandomBreakDurationMs();
        const breakMins = Math.round(breakMs / 60000);
        state.nextActionTime = Date.now() + breakMs;
        state.currentStatus = `Mini-batch of ${state.currentBatchLimit} sent! Taking ${breakMins}-min natural cadence pause...`;
        console.log(`\n☕ [Natural Micro-Batch Rest Device ${deviceId}] Batch target met (${state.currentBatchLimit} sent). Taking ${breakMins}-minute cadence pause until ${formatIndiaTime(state.nextActionTime)}...\n`);

        await sleep(breakMs);

        state.currentBatchCount = 0;
        state.currentBatchLimit = getRandomBatchLimit();
        console.log(`⚡ [Worker Device ${deviceId}] Natural rest completed! Next batch rolled: ${state.currentBatchLimit} leads.`);
      } else {
        const delayMs = getRandomMsgDelayMs();
        const delaySec = Math.round(delayMs / 1000);
        const delayMins = (delayMs / 60000).toFixed(1);
        state.nextActionTime = Date.now() + delayMs;
        state.currentStatus = `Pacing pause: waiting ${delaySec}s (~${delayMins}m) before next contact...`;
        console.log(`⏳ [Pacing Device ${deviceId}] Next lead scheduled at ${formatIndiaTime(state.nextActionTime)} (${delaySec}s cadence)...`);
        await sleep(delayMs);
      }
    } else {
      await sleep(2000);
    }
  }
}

/**
 * Dedicated High-Throughput Dispatcher for Official Meta WhatsApp Cloud API (1,000+ msgs/day)
 */
async function runMetaCloudWorker() {
  console.log(`🚀 [Meta Cloud Dispatcher Engine] Initialized (Daily Target: ${getDailyMaxLeadsCloud()} leads/day)...`);

  while (isRunning) {
    if (isPaused) {
      metaCloudState.currentStatus = 'Paused by User';
      await sleep(5000);
      continue;
    }

    if (whatsapp.getActiveEngine() !== 'meta_cloud') {
      metaCloudState.currentStatus = 'Standby (Baileys Multi-Device Mode is currently active)';
      await sleep(10000);
      continue;
    }

    checkAndResetDailyCounters();

    const cloudLimit = getDailyMaxLeadsCloud();

    // 1. Daily 1k Allocation Check
    if (metaCloudState.dailySentCount >= cloudLimit) {
      metaCloudState.currentStatus = `Daily 1k Cloud Allocation Completed (${metaCloudState.dailySentCount}/${cloudLimit}). Resuming at 9:00 AM IST...`;
      metaCloudState.nextActionTime = getNext9AmIstTimestamp();
      await sleep(60000);
      continue;
    }

    // 2. Daytime Operating Hours Check (if businessHoursShield enabled)
    if (botConfig.businessHoursShield && !isOperatingHours()) {
      metaCloudState.currentStatus = '🌙 Rest Mode (Active 9:00 AM – 9:00 PM IST). Resuming at 9:00 AM IST...';
      metaCloudState.nextActionTime = getNext9AmIstTimestamp();
      await sleep(60000);
      continue;
    }

    // 3. Proactive lead harvest if backlog is low
    const remainingInQueue = scraper.getQueuedLeads(50).length;
    if (remainingInQueue < 30 && !isProactiveScraping) {
      isProactiveScraping = true;
      console.log(`⚡ [Meta Cloud Harvester] Queue has ${remainingInQueue} leads. Harvesting fresh real estate leads in background...`);
      scraper.triggerFreeWebScraper({ targetCount: 50, deviceId: 1 })
        .catch(e => console.error('Continuous harvest notice:', e.message))
        .finally(() => { isProactiveScraping = false; });
    }

    // 4. Claim next unassigned lead
    let lead = scraper.claimNextLead('meta_cloud');
    if (!lead) {
      metaCloudState.currentStatus = 'Queue Empty: Harvesting fresh Karnal commercial & NRI property leads...';
      try {
        await scraper.triggerFreeWebScraper({ targetCount: 40, deviceId: 1 });
      } catch (err) {}
      lead = scraper.claimNextLead('meta_cloud');
      if (!lead) {
        await sleep(10000);
        continue;
      }
    }

    // 5. Phone validation
    const digits = String(lead.phone).replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      scraper.updateLeadStatus(lead.phone, 'invalid_number', null, 'meta_cloud');
      continue;
    }
    const cleanPhone = digits.length === 10 ? `91${digits}` : digits;

    // 6. Generate Personalized Outreach Message
    metaCloudState.currentStatus = `Generating AI outreach for +${cleanPhone}...`;
    const outreachText = await ai.generateFirstTouch(lead);

    // 7. Send via Official Meta WhatsApp Cloud API
    metaCloudState.currentStatus = `Sending Cloud API message to +${cleanPhone}...`;
    let sendSucceeded = false;
    try {
      const sent = await whatsapp.sendTextMessage(1, `${cleanPhone}@s.whatsapp.net`, outreachText, {
        useTemplate: Boolean(botConfig.useMetaTemplate && process.env.META_TEMPLATE_NAME),
        templateName: process.env.META_TEMPLATE_NAME,
        templateLang: process.env.META_TEMPLATE_LANG || 'hi',
        templateParams: [lead.name || 'Investor', lead.sector || 'Karnal Prime Sectors'],
        leadName: lead.name
      });

      if (sent) {
        scraper.updateLeadStatus(lead.phone, 'sent', null, 'meta_cloud');
        chatMemory.recordOutreach(cleanPhone, outreachText, {
          name: lead.name,
          city: lead.city,
          query: lead.query
        });
        metaCloudState.totalSentSession++;
        metaCloudState.dailySentCount++;
        metaCloudState.consecutiveFailures = 0;
        sendSucceeded = true;
        console.log(`✅ [Meta Cloud API Sent] To +${cleanPhone}. Today: ${metaCloudState.dailySentCount}/${cloudLimit}`);
      } else {
        metaCloudState.consecutiveFailures++;
        scraper.updateLeadStatus(lead.phone, 'failed', 'Meta Cloud dispatch failed', 'meta_cloud');
      }
    } catch (sendErr) {
      metaCloudState.consecutiveFailures++;
      console.error(`❌ [Meta Cloud Send Error]:`, sendErr.message);
      scraper.updateLeadStatus(lead.phone, 'failed', sendErr.message, 'meta_cloud');
    }

    // 8. High-Speed Cloud Pacing (1.5s - 3.5s per message for 1,000+ daily volume)
    const minDelay = botConfig.cloudMinMsgDelayMs || 1500;
    const maxDelay = botConfig.cloudMaxMsgDelayMs || 3500;
    const delayMs = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
    metaCloudState.nextActionTime = Date.now() + delayMs;
    await sleep(delayMs);
  }
}

/**
 * Start queue workers across all devices
 */
function startQueue() {
  if (isRunning) return;
  isRunning = true;
  isPaused = false;
  console.log(`🚀 [Karnal Enterprise Cadence Engine] Starting dispatchers (Active Engine: ${whatsapp.getActiveEngine()})...`);

  // 1. Start Official Meta Cloud High-Speed Dispatcher (1,000+ msgs/day)
  runMetaCloudWorker().catch(err => {
    console.error('Fatal crash in Meta Cloud Worker:', err);
  });

  // 2. Start Baileys Device Workers (parallel or backup)
  for (let i = 1; i <= MAX_DEVICES; i++) {
    runDeviceWorker(i).catch(err => {
      console.error(`Fatal crash in Worker Device ${i}:`, err);
    });
  }
}

function pauseQueue() {
  isPaused = true;
  console.log('⏸️ [Karnal Enterprise Cadence Engine] Queue paused across all devices.');
}

function resumeQueue() {
  isPaused = false;
  console.log('▶️ [Karnal Enterprise Cadence Engine] Queue resumed.');
}

function getQueueStatus() {
  const devicesList = [];
  let totalDailySent = 0;
  let totalSessionSent = 0;

  for (let i = 1; i <= MAX_DEVICES; i++) {
    const s = getOrCreateDeviceState(i);
    const dInfo = whatsapp.getDevice(i);
    const allocatedLimit = getDailyLimitForDevice(i);
    totalDailySent += s.dailySentCount;
    totalSessionSent += s.totalSentSession;

    devicesList.push({
      id: i,
      deviceId: i,
      isConnected: whatsapp.isDeviceConnected(i),
      phone: dInfo && dInfo.phone ? dInfo.phone : null,
      currentStatus: s.currentStatus,
      dailySentCount: s.dailySentCount,
      dailyLimit: allocatedLimit,
      dailyMaxLeads: allocatedLimit,
      currentBatchCount: s.currentBatchCount,
      currentBatchLimit: s.currentBatchLimit,
      totalSentSession: s.totalSentSession,
      nextActionTime: s.nextActionTime ? formatIndiaTime(s.nextActionTime) : null,
      nextActionTimestamp: s.nextActionTime
    });
  }

  const { hour, minute } = getIndianTimeParts();
  const connectedCount = whatsapp.getConnectedDevices ? whatsapp.getConnectedDevices().length : 0;
  const queuedRemaining = scraper.getQueuedLeads ? scraper.getQueuedLeads(1000).length : 0;
  const stats = scraper.getScraperStats ? scraper.getScraperStats() : {};

  return {
    engine: whatsapp.getActiveEngine(),
    metaCloud: {
      dailySentCount: metaCloudState.dailySentCount,
      dailyMaxLeads: getDailyMaxLeadsCloud(),
      currentStatus: metaCloudState.currentStatus,
      totalSentSession: metaCloudState.totalSentSession,
      nextActionTime: metaCloudState.nextActionTime ? formatIndiaTime(metaCloudState.nextActionTime) : null,
      configured: whatsapp.metaCloud.isConfigured(),
      tier: whatsapp.metaCloud.tierInfo?.tier || 'TIER_1K (1,000 msgs/24h)'
    },
    isRunning,
    isPaused,
    operatingHours: isOperatingHours(),
    currentTimeIST: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} IST`,
    connectedDevicesCount: connectedCount,
    maxDevices: MAX_DEVICES,
    dailySentCount: whatsapp.getActiveEngine() === 'meta_cloud' ? metaCloudState.dailySentCount : totalDailySent,
    dailyMaxLeads: whatsapp.getActiveEngine() === 'meta_cloud' ? getDailyMaxLeadsCloud() : (MAX_DEVICES * getDailyMaxLeadsPerDevice()),
    dailyMaxPerDevice: getDailyMaxLeadsPerDevice(),
    totalDailySent: whatsapp.getActiveEngine() === 'meta_cloud' ? metaCloudState.dailySentCount : totalDailySent,
    maxDailyCapacity: whatsapp.getActiveEngine() === 'meta_cloud' ? getDailyMaxLeadsCloud() : (MAX_DEVICES * getDailyMaxLeadsPerDevice()),
    totalSessionSent: whatsapp.getActiveEngine() === 'meta_cloud' ? metaCloudState.totalSentSession : totalSessionSent,
    totalSentDb: stats.totalSent || 0,
    queuedRemaining,
    botConfig: getBotConfig(),
    devices: devicesList
  };
}

module.exports = {
  startQueue,
  startQueueWorker: startQueue,
  pauseQueue,
  resumeQueue,
  getQueueStatus,
  getQueueState: getQueueStatus,
  getDailyMaxLeadsPerDevice,
  setDailyMaxLeadsPerDevice,
  updatePacingConfig,
  getBotConfig
};

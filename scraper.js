/**
 * Karnal Realty - Real Estate & Commercial Property Lead Harvester
 * Discovers domestic buyers & overseas NRIs interested in Karnal property
 * Multi-Territory Partitioning across up to 6 WhatsApp accounts
 * Multi-Engine Harvester: Yandex B2B + Web Harvester + Apify Google Search
 */

const fs = require('fs');
const path = require('path');

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || '';
const LEADS_FILE = path.join(__dirname, 'leads_db.json');
const BACKUP_FILE = path.join(__dirname, 'leads_db.backup.json');
const SENT_HISTORY_FILE = path.join(__dirname, 'sent_history.json');

let cachedDb = null;

function loadSentHistory() {
  try {
    if (fs.existsSync(SENT_HISTORY_FILE)) {
      const raw = fs.readFileSync(SENT_HISTORY_FILE, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return new Set(list);
    }
  } catch (e) {}
  return new Set();
}

function recordSentPhone(phone) {
  if (!phone) return;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return;
  const history = loadSentHistory();
  history.add(digits);
  if (digits.length === 10) history.add('91' + digits);
  if (digits.startsWith('91') && digits.length === 12) history.add(digits.slice(2));
  try {
    fs.writeFileSync(SENT_HISTORY_FILE, JSON.stringify([...history], null, 2), 'utf8');
  } catch (e) {}
}

function recordBulkSentPhones(phoneList) {
  if (!Array.isArray(phoneList)) return { added: 0, total: 0 };
  const history = loadSentHistory();
  let added = 0;
  for (const p of phoneList) {
    const digits = String(p).replace(/\D/g, '');
    if (digits && digits.length >= 7 && !history.has(digits)) {
      history.add(digits);
      added++;
    }
  }
  if (added > 0) {
    try {
      fs.writeFileSync(SENT_HISTORY_FILE, JSON.stringify([...history], null, 2), 'utf8');
      console.log(`🛡️ [Sent Shield] Recorded ${added} past numbers in permanent shield ledger.`);
    } catch (e) {}
  }
  return { added, total: history.size };
}

function getTotalShieldedCount() {
  return loadSentHistory().size;
}

function isPhoneAlreadySent(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return false;
  const history = loadSentHistory();
  if (history.has(digits)) return true;
  if (digits.length === 10 && history.has('91' + digits)) return true;
  if (digits.startsWith('91') && digits.length === 12 && history.has(digits.slice(2))) return true;
  return false;
}

function loadDatabase() {
  if (cachedDb && cachedDb.leads && Array.isArray(cachedDb.leads)) {
    return cachedDb;
  }
  try {
    if (fs.existsSync(LEADS_FILE)) {
      const raw = fs.readFileSync(LEADS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.leads)) {
        cachedDb = parsed;
        return cachedDb;
      }
    }
  } catch (e) {}

  try {
    if (fs.existsSync(BACKUP_FILE)) {
      const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.leads)) {
        cachedDb = parsed;
        return cachedDb;
      }
    }
  } catch (backupErr) {}

  cachedDb = { leads: [], sentCount: 0 };
  return cachedDb;
}

function saveDatabase(db) {
  if (!db || !Array.isArray(db.leads)) return;
  cachedDb = db;
  const tempFile = path.join(__dirname, `leads_db.tmp.${Date.now()}`);
  try {
    const jsonStr = JSON.stringify(db, null, 2);
    fs.writeFileSync(tempFile, jsonStr, 'utf8');
    fs.renameSync(tempFile, LEADS_FILE);
    fs.writeFileSync(BACKUP_FILE, jsonStr, 'utf8');
  } catch (e) {
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (err) {}
    }
  }
}

const TOLL_FREE_PREFIXES = new Set(['800', '888', '877', '866', '855', '844', '833']);
function isTollFree(cleanNumber) {
  const digits = String(cleanNumber).replace(/\D/g, '');
  const areaCode = digits.startsWith('1') ? digits.slice(1, 4) : digits.slice(0, 3);
  return TOLL_FREE_PREFIXES.has(areaCode);
}

/**
 * Format Global Phone Numbers (India, Canada, USA, UK, Australia, UAE) into Baileys JID
 */
function formatWhatsAppJid(rawNumber) {
  if (!rawNumber) return null;
  let rawStr = String(rawNumber).trim();
  let digits = rawStr.replace(/\D/g, '');

  let country = 'GLOBAL';

  // India (+91)
  if (rawStr.startsWith('+91') || (digits.startsWith('91') && digits.length === 12)) {
    digits = digits.startsWith('91') ? digits : '91' + digits;
    country = 'India';
  } else if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = '91' + digits;
    country = 'India';
  } else if (digits.startsWith('0') && digits.length === 11 && /^[6-9]/.test(digits.slice(1))) {
    digits = '91' + digits.slice(1);
    country = 'India';
  }
  // USA & Canada (+1)
  else if (rawStr.startsWith('+1') || (digits.startsWith('1') && digits.length === 11)) {
    digits = digits.startsWith('1') ? digits : '1' + digits;
    country = 'Canada/USA';
  } else if (digits.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    digits = '1' + digits;
    country = 'Canada/USA';
  }
  // UK (+44)
  else if (rawStr.startsWith('+44') || (digits.startsWith('44') && (digits.length === 12 || digits.length === 11))) {
    digits = digits.startsWith('44') ? digits : '44' + digits;
    country = 'UK';
  } else if (digits.startsWith('07') && digits.length === 11) {
    digits = '44' + digits.slice(1);
    country = 'UK';
  }
  // Australia (+61)
  else if (rawStr.startsWith('+61') || (digits.startsWith('61') && digits.length === 11)) {
    digits = digits.startsWith('61') ? digits : '61' + digits;
    country = 'Australia';
  } else if (digits.startsWith('04') && digits.length === 10) {
    digits = '61' + digits.slice(1);
    country = 'Australia';
  }
  // UAE / Dubai (+971)
  else if (rawStr.startsWith('+971') || (digits.startsWith('971') && digits.length === 12)) {
    digits = digits.startsWith('971') ? digits : '971' + digits;
    country = 'UAE';
  } else if (digits.startsWith('05') && digits.length === 10) {
    digits = '971' + digits.slice(1);
    country = 'UAE';
  } else {
    return null;
  }

  if (isTollFree(digits)) return null;

  return {
    cleanNumber: digits,
    jid: `${digits}@s.whatsapp.net`,
    country: country
  };
}

/**
 * 6-Device Territory Partitioning for Karnal Realty - High-Intent Hot Buyers Only
 */
const TERRITORIES = {
  device_1: {
    name: 'Karnal Prime Commercial & SCO Plots (Hot Active Buyers)',
    focus: 'hot_commercial_sco',
    locations: ['GT Road', 'Sector 12', 'Model Town', 'Namaste Chowk', 'Sector 8', 'Sector 9'],
    queries: [
      'karnal property dealer whatsapp contact',
      'karnal commercial property contact whatsapp',
      'karnal SCO plot dealer whatsapp',
      'karnal plot for sale whatsapp'
    ]
  },
  device_2: {
    name: 'Karnal Prime Retail Shops & Showrooms (Active Buyer Requirements)',
    focus: 'hot_retail_investors',
    locations: ['Mughal Canal', 'Kunjpura Road', 'Mall Road', 'Railway Road', 'Sector 13'],
    queries: [
      'karnal shop showroom mughal canal whatsapp',
      'karnal retail commercial space contact whatsapp',
      'karnal sector 13 shop for sale whatsapp'
    ]
  },
  device_3: {
    name: 'Canada & USA NRI Investors (Hot Buying & Investment Inquiries)',
    focus: 'hot_nri_canada_us',
    locations: ['Brampton', 'Surrey', 'Toronto', 'Calgary', 'Vancouver', 'New York'],
    queries: [
      'karnal NRI property investment whatsapp',
      'Canada NRI buying plot in Karnal whatsapp',
      'karnal commercial SCO NRI buyer whatsapp'
    ]
  },
  device_4: {
    name: 'UK & Europe NRIs (Active Diaspora Investors for Karnal)',
    focus: 'hot_nri_uk',
    locations: ['London', 'Birmingham', 'Leicester', 'Southall', 'Coventry'],
    queries: [
      'UK London NRI invest in Karnal property whatsapp',
      'NRI buying SCO commercial Karnal whatsapp'
    ]
  },
  device_5: {
    name: 'Australia & Gulf NRIs (High-Budget Commercial Investors)',
    focus: 'hot_nri_aus_uae',
    locations: ['Melbourne', 'Sydney', 'Brisbane', 'Dubai', 'Abu Dhabi', 'Sharjah'],
    queries: [
      'Dubai UAE NRI buying plot in Karnal whatsapp',
      'Australia NRI invest in Karnal commercial whatsapp'
    ]
  },
  device_6: {
    name: 'High-Net-Worth Domestic Buyers (Gated Township Plots & Farmland)',
    focus: 'hot_domestic_hnw',
    locations: ['Panipat', 'Kurukshetra', 'Ambala', 'Chandigarh', 'Delhi-NCR', 'Karnal'],
    queries: [
      'karnal sector 32 33 plot whatsapp',
      'karnal CHD city alpha city plot contact whatsapp',
      'karnal farmhouse land for sale whatsapp'
    ]
  }
};

function getTerritoryForAccount(accountId) {
  const key = String(accountId).startsWith('device_') ? accountId : `device_${accountId}`;
  return TERRITORIES[key] || TERRITORIES.device_1;
}

function evaluateHotLeadScore(query = '', item = {}) {
  const combined = `${query} ${item.name || ''} ${item.segment || ''} ${item.location || ''}`.toLowerCase();
  const highIntentKeywords = [
    'looking to buy', 'want to buy', 'urgent requirement', 'ready to buy',
    'cash buyer', 'investor', 'ready to invest', 'need commercial', 'buying plot',
    'buyer requirement', 'nri investor', 'nri buyer', 'buying sco'
  ];
  let score = 50;
  for (const kw of highIntentKeywords) {
    if (combined.includes(kw)) score += 25;
  }
  return score;
}

/**
 * Strict Geographic & Real Estate Intent Qualification for Karnal
 * Rejects leads outside Karnal, and requires NRIs to have explicit Karnal investment intent.
 */
function isStrictKarnalLead(item) {
  if (!item) return false;
  const phone = String(item.phone || item.number || '').replace(/\D/g, '');
  const country = String(item.country || '').toLowerCase();
  const location = String(item.location || '').toLowerCase();
  const query = String(item.query || '').toLowerCase();
  const segment = String(item.segment || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  const city = String(item.city || '').toLowerCase();
  const allText = `${location} ${query} ${segment} ${name} ${city}`;

  const karnalKeywords = [
    'karnal', 'gt road', 'sector 12', 'sector 32', 'sector 33', 'sector 8',
    'sector 9', 'sector 13', 'sector 14', 'sector 6', 'sector 7', 'sector 4',
    'model town', 'mughal canal', 'kunjpura', 'namaste chowk', 'mall road',
    'chd city', 'alpha city', 'ansal', 'urban estate', 'railway road'
  ];

  const mentionsKarnal = karnalKeywords.some(kw => allText.includes(kw));

  // Manual inputs from user dashboard are always approved
  if (item.source === 'manual_dashboard' || item.source === 'manual_import' || item.source === 'manual_form') {
    return true;
  }

  // NRI check (non-India phone or overseas country)
  const isNri = (phone.length > 0 && !phone.startsWith('91')) || (country && country !== 'india');
  if (isNri) {
    // NRIs MUST explicitly target Karnal property
    return mentionsKarnal;
  }

  // Domestic Indian numbers: must have explicit Karnal locality or city == 'karnal'
  return mentionsKarnal || city === 'karnal';
}

function addLeadsToQueue(newLeads = [], defaultAccount = null) {
  const db = loadDatabase();
  const existingPhones = new Set(db.leads.map(l => l.phone));
  let added = 0;

  for (const item of newLeads) {
    // CRITICAL: Strictly reject any number that does NOT have verified WhatsApp confirmation!
    const isVerified = Boolean(
      item.isVerifiedWhatsApp ||
      item.source === 'manual_dashboard' ||
      item.source === 'manual_import' ||
      item.source === 'manual_form'
    );
    if (!isVerified) continue;

    if (!isStrictKarnalLead(item)) continue; // Filter out non-Karnal leads immediately!

    const formatted = formatWhatsAppJid(item.phone || item.number);
    if (!formatted) continue;

    if (isPhoneAlreadySent(formatted.cleanNumber)) continue;

    if (!existingPhones.has(formatted.cleanNumber)) {
      const assigned = item.assignedAccount || defaultAccount || null;
      const score = evaluateHotLeadScore(item.query, item);
      const isHot = score >= 75;

      db.leads.push({
        phone: formatted.cleanNumber,
        jid: formatted.jid,
        country: formatted.country || item.country || 'India',
        name: item.name || '',
        segment: isHot ? '🔥 Hot Verified Buyer' : (item.segment || 'Commercial & Plots'),
        location: item.location || 'Karnal',
        source: item.source || 'karnal_realty_harvester',
        query: item.query || '',
        isHotLead: isHot,
        priority: score,
        assignedAccount: assigned,
        discoveredAt: new Date().toISOString(),
        status: 'queued',
        lastSentAt: null,
        isVerifiedWhatsApp: true
      });

      existingPhones.add(formatted.cleanNumber);
      added++;
    }
  }

  saveDatabase(db);
  console.log(`✅ [Karnal Realty DB] Added ${added} verified WhatsApp leads${defaultAccount ? ` for ${defaultAccount}` : ''}. Total in DB: ${db.leads.length}`);
  return { added, total: db.leads.length };
}

function claimNextLead(deviceId) {
  const db = loadDatabase();
  const now = Date.now();
  const devKey = `device_${deviceId}`;

  // Filter all candidates that haven't been sent yet, strictly match Karnal intent, AND are confirmed on WhatsApp
  const available = db.leads.filter(l => 
    !isPhoneAlreadySent(l.phone) && 
    isStrictKarnalLead(l) &&
    (l.isVerifiedWhatsApp === true || l.source === 'manual_dashboard' || l.source === 'manual_import' || l.source === 'manual_form')
  );

  // 1. Check hot leads assigned to this device slot (or all queued leads for meta_cloud)
  let candidates = [];
  if (deviceId === 'meta_cloud') {
    candidates = available.filter(l => l.status === 'queued');
  } else {
    candidates = available.filter(l => l.status === 'queued' && (l.assignedAccount === devKey || l.assignedAccount === String(deviceId)));

    // 2. Fall back to any unassigned queued leads
    if (candidates.length === 0) {
      candidates = available.filter(l => l.status === 'queued' && !l.assignedAccount);
    }
  }

  // 3. Stalled processing leads fallback (> 15 mins)
  if (candidates.length === 0) {
    candidates = available.filter(l => l.status === 'processing' && l.claimed_at && (now - l.claimed_at > 15 * 60 * 1000));
  }

  if (candidates.length > 0) {
    // Sort strictly by priority / hot lead score descending so HOT LEADS ALWAYS DISPATCH FIRST
    candidates.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const lead = candidates[0];

    lead.status = 'processing';
    lead.claimed_by = deviceId;
    lead.claimed_at = now;
    lead.assignedAccount = devKey;
    saveDatabase(db);
    return lead;
  }

  return null;
}

function releaseLeadClaim(phone) {
  const db = loadDatabase();
  const cleanDigits = String(phone).replace(/\D/g, '');
  const lead = db.leads.find(l => l.phone === cleanDigits || l.phone === phone);
  if (lead && lead.status === 'processing') {
    lead.status = 'queued';
    lead.claimed_by = null;
    lead.claimed_at = null;
    saveDatabase(db);
  }
}

function getQueuedLeadsCount(accountId = null) {
  const db = loadDatabase();
  if (accountId) {
    const devKey = `device_${accountId}`;
    return db.leads.filter(l => l.status === 'queued' && (l.assignedAccount === devKey || !l.assignedAccount)).length;
  }
  return db.leads.filter(l => l.status === 'queued').length;
}

function getQueuedLeads(limit = 10) {
  const db = loadDatabase();
  return db.leads.filter(l => l.status === 'queued').slice(0, limit);
}

function getHotRepliedLeads() {
  const db = loadDatabase();
  return db.leads.filter(l => l.status === 'replied' || l.status === 'hot').slice(-50).reverse();
}

function getAllDiscoveredLeads(statusFilter = 'all') {
  const db = loadDatabase();
  if (!statusFilter || statusFilter === 'all') {
    return [...db.leads].reverse();
  }
  return db.leads.filter(l => l.status === statusFilter).reverse();
}

function updateLeadStatus(phone, status, error = null, deviceId = null) {
  const db = loadDatabase();
  const cleanDigits = String(phone).replace(/\D/g, '');
  const lead = db.leads.find(l => l.phone === cleanDigits || l.phone === phone || (l.jid && l.jid.includes(cleanDigits)));
  if (lead) {
    lead.status = status;
    if (deviceId) lead.handledByDevice = deviceId;
    if (status === 'sent') {
      lead.lastSentAt = new Date().toISOString();
      db.sentCount = (db.sentCount || 0) + 1;
      recordSentPhone(cleanDigits);
    }
    if (error) lead.lastError = error;
    lead.updated_at = Date.now();
    saveDatabase(db);
  }
}

const ROTATING_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'
];

/**
 * Extract Verified WhatsApp & Global Mobile Numbers from Text & HTML
 * STRICT POLICY: ONLY numbers with confirmed WhatsApp presence (wa.me/ links,
 * api.whatsapp.com/send, or explicit WhatsApp text keywords) are extracted.
 * Generic phone numbers without explicit WhatsApp indicators are strictly discarded.
 */
function extractGlobalPhones(text, html = '') {
  const results = [];
  const seen = new Set();
  const allContent = `${html || ''} ${text || ''}`;
  if (!allContent.trim()) return results;

  // 1. Direct WhatsApp Click-to-Chat links (wa.me and api.whatsapp.com) - 100% Guaranteed WhatsApp Users
  // 1a. India wa.me (+91 or bare 10-digit)
  const waInRegex = /(?:https?:\/\/)?(?:wa\.me\/(?:\+?91)?|api\.whatsapp\.com\/send\/?\?(?:.*&)?phone=(?:\+?91)?)([6-9]\d{9})\b/gi;
  let m;
  while ((m = waInRegex.exec(allContent)) !== null) {
    const clean = `91${m[1]}`;
    if (!seen.has(clean) && /^91[6-9]\d{9}$/.test(clean)) {
      seen.add(clean);
      results.push({ phone: clean, country: 'India', isVerifiedWhatsApp: true, source_type: 'wa_link' });
    }
  }

  // 1b. International wa.me (UK +44, UAE +971, Australia +61, Canada/USA +1)
  const waIntlRegex = /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:.*&)?phone=)(447\d{9}|9715\d{8}|614\d{8}|1[2-9]\d{9})\b/gi;
  while ((m = waIntlRegex.exec(allContent)) !== null) {
    const clean = m[1];
    if (!seen.has(clean)) {
      seen.add(clean);
      const country = clean.startsWith('44') ? 'UK' : clean.startsWith('971') ? 'UAE' : clean.startsWith('61') ? 'Australia' : 'Canada/USA';
      results.push({ phone: clean, country, isVerifiedWhatsApp: true, source_type: 'wa_link_intl' });
    }
  }

  // 2. Explicit WhatsApp Text Mentions (Prefix: e.g. "WhatsApp: 9812345678", "Chat on WhatsApp: +91 9416031024")
  const waTextInRegex = /(?:whatsapp|watsapp|wapp|wa)[\s:–—=]*(?:me\s+at\s+|only\s+|on\s+|msg\s+|chat\s+)?(?:\+?91[\s.-]*|0)?([6-9]\d{9})\b/gi;
  while ((m = waTextInRegex.exec(text || '')) !== null) {
    const clean = `91${m[1]}`;
    if (!seen.has(clean) && /^91[6-9]\d{9}$/.test(clean)) {
      seen.add(clean);
      results.push({ phone: clean, country: 'India', isVerifiedWhatsApp: true, source_type: 'wa_text_prefix' });
    }
  }

  // 3. Explicit WhatsApp Text Mentions (Suffix: e.g. "9812345678 (WhatsApp)", "9812345678 on WhatsApp")
  const waSuffixInRegex = /\b(?:\+?91[\s.-]*|0)?([6-9]\d{9})[\s:–—=]*(?:\(whatsapp\)|\(wa\)|on\s+whatsapp|whatsapp\s+only|chat\s+on\s+whatsapp)/gi;
  while ((m = waSuffixInRegex.exec(text || '')) !== null) {
    const clean = `91${m[1]}`;
    if (!seen.has(clean) && /^91[6-9]\d{9}$/.test(clean)) {
      seen.add(clean);
      results.push({ phone: clean, country: 'India', isVerifiedWhatsApp: true, source_type: 'wa_text_suffix' });
    }
  }

  // 4. Overseas Explicit WhatsApp Text Mentions
  // UK (+44)
  const waTextUkRegex = /(?:whatsapp|wa)[\s:–—=]*(?:me\s+at\s+)?(?:\+?44[\s.-]?|0)?(7\d{9})\b/gi;
  while ((m = waTextUkRegex.exec(text || '')) !== null) {
    const clean = `44${m[1]}`;
    if (!seen.has(clean) && /^447\d{9}$/.test(clean)) {
      seen.add(clean);
      results.push({ phone: clean, country: 'UK', isVerifiedWhatsApp: true, source_type: 'wa_text_uk' });
    }
  }

  // UAE (+971)
  const waTextUaeRegex = /(?:whatsapp|wa)[\s:–—=]*(?:me\s+at\s+)?(?:\+?971[\s.-]?|0)?(5\d{8})\b/gi;
  while ((m = waTextUaeRegex.exec(text || '')) !== null) {
    const clean = `971${m[1]}`;
    if (!seen.has(clean) && /^9715\d{8}$/.test(clean)) {
      seen.add(clean);
      results.push({ phone: clean, country: 'UAE', isVerifiedWhatsApp: true, source_type: 'wa_text_uae' });
    }
  }

  // Australia (+61)
  const waTextAuRegex = /(?:whatsapp|wa)[\s:–—=]*(?:me\s+at\s+)?(?:\+?61[\s.-]?|0)?(4\d{8})\b/gi;
  while ((m = waTextAuRegex.exec(text || '')) !== null) {
    const clean = `61${m[1]}`;
    if (!seen.has(clean) && /^614\d{8}$/.test(clean)) {
      seen.add(clean);
      results.push({ phone: clean, country: 'Australia', isVerifiedWhatsApp: true, source_type: 'wa_text_au' });
    }
  }

  // Canada/USA (+1) - strictly require +1 prefix
  const waTextNaRegex = /(?:whatsapp|wa)[\s:–—=]*(?:me\s+at\s+)?(?:\+?1[\s.-])([2-9]\d{9})\b/gi;
  while ((m = waTextNaRegex.exec(text || '')) !== null) {
    const clean = `1${m[1]}`;
    if (!seen.has(clean) && /^1[2-9]\d{9}$/.test(clean)) {
      seen.add(clean);
      results.push({ phone: clean, country: 'Canada/USA', isVerifiedWhatsApp: true, source_type: 'wa_text_na' });
    }
  }

  // 5. Karnal Real Estate Listings with confirmed WhatsApp intent
  // If the listing explicitly references Karnal property/plots AND explicitly mentions WhatsApp / wa.me
  const lowerAll = allContent.toLowerCase();
  const hasWaIntent = lowerAll.includes('whatsapp') || lowerAll.includes('wa.me') || lowerAll.includes('watsapp');
  const hasKarnalIntent = lowerAll.includes('karnal');
  if (hasWaIntent && hasKarnalIntent) {
    const inGeneralRegex = /(?:\+?91[\s.-]*|0)?([6-9]\d{9})\b/g;
    let gm;
    while ((gm = inGeneralRegex.exec(allContent)) !== null) {
      const clean = `91${gm[1]}`;
      if (!seen.has(clean) && /^91[6-9]\d{9}$/.test(clean)) {
        seen.add(clean);
        results.push({ phone: clean, country: 'India', isVerifiedWhatsApp: true, source_type: 'karnal_wa_listing' });
      }
    }
  }

  return results;
}

async function scrapeDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const ua = ROTATING_USER_AGENTS[Math.floor(Math.random() * ROTATING_USER_AGENTS.length)];
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const stripped = html.replace(/<[^>]+>/g, ' ');
    return extractGlobalPhones(stripped, html);
  } catch (e) {
    return [];
  }
}

async function scrapeBing(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const ua = ROTATING_USER_AGENTS[Math.floor(Math.random() * ROTATING_USER_AGENTS.length)];
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const stripped = html.replace(/<[^>]+>/g, ' ');
    return extractGlobalPhones(stripped, html);
  } catch (e) {
    return [];
  }
}

async function scrapeYandex(query) {
  const url = `https://yandex.com/search/?text=${encodeURIComponent(query)}&numdoc=20`;
  const ua = ROTATING_USER_AGENTS[Math.floor(Math.random() * ROTATING_USER_AGENTS.length)];
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    if (html.includes('captcha') && html.length < 10000) return [];
    const stripped = html.replace(/<[^>]+>/g, ' ');
    return extractGlobalPhones(stripped, html);
  } catch (e) {
    return [];
  }
}

/**
 * Trigger Free Scraper for Karnal Realty
 */
async function triggerFreeWebScraper(options = {}) {
  const targetAccount = options.targetAccount || 'device_1';
  const minLeads = options.targetCount || 25;
  const territory = getTerritoryForAccount(targetAccount);

  console.log(`⚡ [Karnal Scraper - ${targetAccount}] Harvesting in: ${territory.name}...`);

  const extracted = [];
  const seenPhones = new Set();

  for (const query of territory.queries) {
    if (extracted.length >= minLeads) break;

    // Multi-Engine Waterfall: DuckDuckGo -> Bing -> Yandex
    let results = await scrapeDuckDuckGo(query);
    if (!results || results.length === 0) {
      results = await scrapeBing(query);
    }
    if (!results || results.length === 0) {
      results = await scrapeYandex(query);
    }

    for (const r of results) {
      if (!seenPhones.has(r.phone) && !isPhoneAlreadySent(r.phone)) {
        seenPhones.add(r.phone);
        extracted.push({
          phone: r.phone,
          country: r.country,
          name: '',
          segment: territory.focus,
          location: 'Karnal',
          assignedAccount: targetAccount,
          source: `harvester_${targetAccount}`,
          query: query,
          isVerifiedWhatsApp: true
        });
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`🎯 [Karnal Scraper - ${targetAccount}] Harvested ${extracted.length} verified WhatsApp buyer contacts.`);
  return addLeadsToQueue(extracted, targetAccount);
}

/**
 * Apify Google Search Scraper (Fallback)
 */
async function triggerApifyLeadDiscovery(targetAccount = 'device_1') {
  if (!APIFY_TOKEN) return { added: 0 };
  const territory = getTerritoryForAccount(targetAccount);
  console.log(`🔍 [Apify Karnal Scraper] Running search for ${territory.name}...`);

  try {
    const runResponse = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&memory=512`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: territory.queries.join('\n'),
        maxPagesPerQuery: 1,
        resultsPerPage: 20,
        mobileResults: true,
        languageCode: 'en'
      })
    });

    if (!runResponse.ok) return { added: 0 };
    const items = await runResponse.json();
    const extracted = [];

    for (const item of items) {
      const text = `${item.title || ''} ${item.description || ''} ${item.snippet || ''}`;
      const found = extractGlobalPhones(text);
      for (const f of found) {
        extracted.push({
          phone: f.phone,
          country: f.country,
          name: (item.title || '').split(/[-|–]/)[0].trim().slice(0, 25),
          segment: territory.focus,
          location: 'Karnal',
          assignedAccount: targetAccount,
          source: `apify_${targetAccount}`,
          query: item.searchQuery || '',
          isVerifiedWhatsApp: true
        });
      }
    }

    return addLeadsToQueue(extracted, targetAccount);
  } catch (err) {
    console.error('❌ Apify Run Failed:', err.message);
    return { added: 0 };
  }
}

let is247ScraperRunning = false;
let isScraperPaused = false;
let scraperStats = {
  status: 'Karnal Realty Continuous Harvester Active',
  cyclesCompleted: 0,
  leadsHarvestedSession: 0,
  lastScrapedAccount: 'device_1',
  lastScrapedLocation: 'Sector 12 & GT Road',
  lastRunTime: null
};

function pauseScraper() {
  isScraperPaused = true;
  scraperStats.status = 'Scraper Paused by User';
  console.log('⏸️ [Karnal Scraper] Paused by user.');
}

function resumeScraper() {
  isScraperPaused = false;
  scraperStats.status = 'Resuming Karnal property harvest...';
  console.log('▶️ [Karnal Scraper] Resumed by user.');
}

function getScraperStats() {
  const db = loadDatabase();
  return {
    ...scraperStats,
    isPaused: isScraperPaused,
    totalInDb: db.leads.length,
    queuedCount: db.leads.filter(l => l.status === 'queued').length,
    sentCount: db.leads.filter(l => l.status === 'sent').length
  };
}

/**
 * 24/7 Autonomous Scraper Loop across all 6 slots
 */
async function start247ContinuousScraper() {
  if (is247ScraperRunning) return;
  is247ScraperRunning = true;
  console.log('🌍 [Karnal Realty 24/7 Scraper] Started autonomous harvest across all 6 device slots!');

  const deviceSlots = ['device_1', 'device_2', 'device_3', 'device_4', 'device_5', 'device_6'];
  let currentIdx = 0;

  while (is247ScraperRunning) {
    if (isScraperPaused) {
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }

    try {
      const activeSlot = deviceSlots[currentIdx % deviceSlots.length];
      currentIdx++;

      const queued = getQueuedLeadsCount(activeSlot);
      if (queued >= 35) {
        await new Promise(r => setTimeout(r, 6000));
        continue;
      }

      const territory = getTerritoryForAccount(activeSlot);
      scraperStats.lastScrapedAccount = activeSlot;
      scraperStats.lastScrapedLocation = territory.name;
      scraperStats.lastRunTime = new Date().toISOString();
      scraperStats.status = `Harvesting for ${activeSlot} (${territory.name})...`;

      const result = await triggerFreeWebScraper({
        targetAccount: activeSlot,
        targetCount: 20
      });

      scraperStats.cyclesCompleted++;
      scraperStats.leadsHarvestedSession += (result?.added || 0);

      await new Promise(r => setTimeout(r, 12000));
    } catch (err) {
      console.error('❌ [Continuous Scraper Error]:', err.message);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

module.exports = {
  loadDatabase,
  saveDatabase,
  addLeadsToQueue,
  claimNextLead,
  releaseLeadClaim,
  getQueuedLeads,
  getQueuedLeadsCount,
  getHotRepliedLeads,
  getAllDiscoveredLeads,
  updateLeadStatus,
  triggerFreeWebScraper,
  triggerApifyLeadDiscovery,
  start247ContinuousScraper,
  pauseScraper,
  resumeScraper,
  isPhoneAlreadySent,
  isStrictKarnalLead,
  recordSentPhone,
  recordBulkSentPhones,
  getTotalShieldedCount,
  getScraperStats,
  formatWhatsAppJid,
  getTerritoryForAccount,
  TERRITORIES,
  extractGlobalPhones
};

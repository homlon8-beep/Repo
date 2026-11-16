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
      '"looking to buy" "commercial plot" "karnal" "call" OR "whatsapp"',
      '"want to buy" "SCO plot" "karnal" "phone" OR "contact"',
      '"urgent requirement" "commercial plot" "karnal" "call"',
      '"ready to invest" "commercial property" "karnal" "whatsapp"',
      '"cash buyer" "SCO" "karnal" "phone"',
      '"need commercial land" "karnal" "gt road" "contact"'
    ]
  },
  device_2: {
    name: 'Karnal Prime Retail Shops & Showrooms (Active Buyer Requirements)',
    focus: 'hot_retail_investors',
    locations: ['Mughal Canal', 'Kunjpura Road', 'Mall Road', 'Railway Road', 'Sector 13'],
    queries: [
      '"looking to buy shop" "karnal" "phone" OR "whatsapp"',
      '"want to buy showroom" "karnal" "contact" OR "call"',
      '"urgent requirement" "shop" "mughal canal" "phone"',
      '"buyer requirement" "commercial shop" "karnal" "mobile"',
      '"ready to buy retail shop" "karnal" "whatsapp"'
    ]
  },
  device_3: {
    name: 'Canada & USA NRI Investors (Hot Buying & Investment Inquiries)',
    focus: 'hot_nri_canada_us',
    locations: ['Brampton', 'Surrey', 'Toronto', 'Calgary', 'Vancouver', 'New York'],
    queries: [
      'site:facebook.com ("Canada" OR "Brampton" OR "Surrey") ("looking to invest in Karnal" OR "buying plot in Karnal") "whatsapp"',
      '("NRI looking to buy" OR "NRI buyer") "Karnal" ("+1" OR "Canada") "whatsapp"',
      '"NRI investor" "want to buy" "Karnal SCO" "contact" OR "call"',
      '"Canada NRI" "buying commercial property" "Karnal" "phone"'
    ]
  },
  device_4: {
    name: 'UK & Europe NRIs (Active Diaspora Investors for Karnal)',
    focus: 'hot_nri_uk',
    locations: ['London', 'Birmingham', 'Leicester', 'Southall', 'Coventry'],
    queries: [
      'site:facebook.com ("UK" OR "London" OR "Birmingham") ("buying property in Karnal" OR "looking to invest in Karnal") "whatsapp"',
      '("UK NRI" OR "London investor") "want to buy plot" "Karnal" "phone"',
      '"NRI investor" "buying SCO plot" "Karnal" ("+44" OR "UK") "call"',
      '"NRI buyer" "commercial plot in Karnal" "whatsapp"'
    ]
  },
  device_5: {
    name: 'Australia & Gulf NRIs (High-Budget Commercial Investors)',
    focus: 'hot_nri_aus_uae',
    locations: ['Melbourne', 'Sydney', 'Brisbane', 'Dubai', 'Abu Dhabi', 'Sharjah'],
    queries: [
      'site:facebook.com ("Australia" OR "Dubai" OR "UAE") ("buying plot in Karnal" OR "invest in Karnal commercial") "whatsapp"',
      '("Dubai NRI" OR "Australia investor") "looking to buy" "Karnal" ("+61" OR "+971") "whatsapp"',
      '"UAE investor" "want to invest in Karnal property" "contact"',
      '"Gulf NRI" "buying commercial space" "Karnal" "phone"'
    ]
  },
  device_6: {
    name: 'High-Net-Worth Domestic Buyers (Gated Township Plots & Farmland)',
    focus: 'hot_domestic_hnw',
    locations: ['Panipat', 'Kurukshetra', 'Ambala', 'Chandigarh', 'Delhi-NCR', 'Karnal'],
    queries: [
      '"looking to buy plot" "karnal" ("sector 32" OR "sector 33" OR "sector 8" OR "sector 9") "phone"',
      '"urgent buyer" "residential plot" "karnal" "whatsapp"',
      '"ready to buy" "plot in karnal" "contact" OR "call"',
      '"want to buy" "CHD city" OR "Alpha city" "karnal" "phone"',
      '"cash buyer" "farmhouse land" "karnal" "contact"'
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
        lastSentAt: null
      });

      existingPhones.add(formatted.cleanNumber);
      added++;
    }
  }

  saveDatabase(db);
  console.log(`✅ [Karnal Realty DB] Added ${added} new property investor leads${defaultAccount ? ` for ${defaultAccount}` : ''}. Total in DB: ${db.leads.length}`);
  return { added, total: db.leads.length };
}

function claimNextLead(deviceId) {
  const db = loadDatabase();
  const now = Date.now();
  const devKey = `device_${deviceId}`;

  // Filter all candidates that haven't been sent yet and strictly match Karnal intent
  const available = db.leads.filter(l => !isPhoneAlreadySent(l.phone) && isStrictKarnalLead(l));

  // 1. Check hot leads assigned to this device slot
  let candidates = available.filter(l => l.status === 'queued' && (l.assignedAccount === devKey || l.assignedAccount === String(deviceId)));

  // 2. Fall back to any unassigned queued leads
  if (candidates.length === 0) {
    candidates = available.filter(l => l.status === 'queued' && !l.assignedAccount);
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
 * Extract Global Phone Numbers from Text (India, US/Canada, UK, Australia, UAE)
 */
function extractGlobalPhones(text) {
  const results = [];
  if (!text) return results;

  // 1. India (+91 or bare 10-digit)
  const inMatches = text.match(/(?:\+?91[\s.-]*|0)?([6-9]\d{9})\b/g) || [];
  for (const p of inMatches) {
    const d = p.replace(/\D/g, '');
    const clean = d.startsWith('91') && d.length === 12 ? d : (d.length === 10 ? '91' + d : (d.startsWith('0') && d.length === 11 ? '91' + d.slice(1) : null));
    if (clean && clean.length === 12) results.push({ phone: clean, country: 'India' });
  }

  // 2. US / Canada (+1)
  const usMatches = text.match(/(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?([2-9]\d{2})[-.\s]?(\d{4})\b/g) || [];
  for (const p of usMatches) {
    const d = p.replace(/\D/g, '');
    const clean = d.length === 10 ? '1' + d : d;
    if (clean.length === 11 && clean.startsWith('1') && !isTollFree(clean)) {
      results.push({ phone: clean, country: 'Canada/USA' });
    }
  }

  // 3. UK (+44)
  const ukMatches = text.match(/(?:\+?44[-.\s]?|0)7\d{3}[-.\s]?\d{6}\b/g) || [];
  for (const p of ukMatches) {
    const d = p.replace(/\D/g, '');
    const clean = d.startsWith('0') ? '44' + d.slice(1) : (d.startsWith('44') ? d : '44' + d);
    results.push({ phone: clean, country: 'UK' });
  }

  // 4. Australia (+61)
  const auMatches = text.match(/(?:\+?61[-.\s]?|0)4\d{2}[-.\s]?\d{3}[-.\s]?\d{3}\b/g) || [];
  for (const p of auMatches) {
    const d = p.replace(/\D/g, '');
    const clean = d.startsWith('0') ? '61' + d.slice(1) : (d.startsWith('61') ? d : '61' + d);
    results.push({ phone: clean, country: 'Australia' });
  }

  // 5. UAE (+971)
  const uaeMatches = text.match(/(?:\+?971[\s.-]?|0)5\d{1}[-.\s]?\d{7}\b/g) || [];
  for (const p of uaeMatches) {
    const d = p.replace(/\D/g, '');
    const clean = d.startsWith('0') ? '971' + d.slice(1) : (d.startsWith('971') ? d : '971' + d);
    results.push({ phone: clean, country: 'UAE' });
  }

  return results;
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
    return extractGlobalPhones(stripped);
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

    const results = await scrapeYandex(query);
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
          source: `yandex_${targetAccount}`,
          query: query
        });
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`🎯 [Karnal Scraper - ${targetAccount}] Harvested ${extracted.length} property buyer contacts.`);
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
          query: item.searchQuery || ''
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
  TERRITORIES
};

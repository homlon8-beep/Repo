/**
 * Karnal Realty Advisors — High-Performance Isolated Chat Memory Engine
 * Provides strictly isolated, persistent multi-turn conversational memory for every lead & investor.
 * Guaranteed 100% phone number separation: Number A and Number B never merge or cross-contaminate.
 * Survives server restarts, redeploys, and device reconnections.
 */

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'conversations_memory.json');
const MAX_MESSAGES_PER_CONTACT = 50;

// Normalized phone -> { phone, profile, messages }
const memoryStore = new Map();

// In-memory real-time activity event stream (like a Twitter ticker / audit feed)
const activityFeed = [];
const MAX_FEED_ITEMS = 100;

/**
 * Strict Phone Normalization (E.164 digits format without leading zeros or symbols)
 */
function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/\D/g, '');
  // 10-digit Indian mobile -> prepend 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = '91' + digits;
  }
  // 11-digit starting with 0 followed by 6-9 -> convert to 91...
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    digits = '91' + digits.slice(1);
  }
  return digits;
}

/**
 * Push an event to the real-time live activity feed
 */
function pushActivity(type, phone, title, detail, metadata = {}) {
  const item = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type, // 'outreach_sent' | 'inbound_inquiry' | 'ai_reply' | 'delivery_receipt'
    phone,
    title,
    detail,
    metadata,
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
  };
  activityFeed.unshift(item);
  if (activityFeed.length > MAX_FEED_ITEMS) {
    activityFeed.pop();
  }
}

/**
 * Load persisted memory from disk on startup
 */
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      if (typeof data === 'object' && data !== null) {
        for (const [phone, conv] of Object.entries(data)) {
          const clean = normalizePhone(phone);
          if (clean && conv) {
            memoryStore.set(clean, {
              phone: clean,
              profile: conv.profile || {},
              messages: Array.isArray(conv.messages) ? conv.messages : []
            });
          }
        }
        console.log(`🧠 [Chat Memory Engine] Restored ${memoryStore.size} strictly isolated chat threads.`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [Chat Memory Warning]: Could not read conversations_memory.json:', err.message);
  }
}

// Initial boot load
loadMemory();

let saveTimeout = null;
function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    try {
      const exportObj = {};
      for (const [phone, conv] of memoryStore.entries()) {
        exportObj[phone] = conv;
      }
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(exportObj, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ [Chat Memory Error]: Failed to save conversations to disk:', err.message);
    }
  }, 1000);
}

/**
 * Get or create an isolated contact conversation container
 */
function getOrCreate(rawPhone) {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) throw new Error('Invalid phone number for chat memory.');

  let conv = memoryStore.get(cleanPhone);
  if (!conv) {
    const isDomestic = cleanPhone.startsWith('91');
    conv = {
      phone: cleanPhone,
      profile: {
        name: 'Prospective Investor',
        city: 'Karnal',
        propertyInterest: 'Commercial SCO / Residential Plot',
        stage: 'new',
        leadType: isDomestic ? 'Domestic' : 'NRI Diaspora',
        sentiment: 'NEUTRAL',
        inquiriesReceived: 0,
        createdAt: Date.now(),
        lastActive: Date.now()
      },
      messages: []
    };
    memoryStore.set(cleanPhone, conv);
  }
  return conv;
}

/**
 * Record Outbound Outreach (Step 1)
 */
function recordOutreach(rawPhone, outreachText, leadMetadata = {}) {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) return;

  const conv = getOrCreate(cleanPhone);
  conv.profile.lastActive = Date.now();
  conv.profile.stage = 'outreach_sent';

  if (leadMetadata.name && leadMetadata.name !== 'Sir' && leadMetadata.name !== 'there') {
    conv.profile.name = leadMetadata.name;
  }
  if (leadMetadata.city) conv.profile.city = leadMetadata.city;
  if (leadMetadata.query) conv.profile.propertyInterest = leadMetadata.query;
  if (leadMetadata.category) conv.profile.propertyInterest = leadMetadata.category;

  conv.messages.push({
    id: `out_${Date.now()}`,
    role: 'assistant',
    content: outreachText,
    timestamp: Date.now(),
    isInitialOutreach: true,
    status: 'sent'
  });

  if (conv.messages.length > MAX_MESSAGES_PER_CONTACT) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES_PER_CONTACT);
  }

  pushActivity(
    'outreach_sent',
    cleanPhone,
    `Outreach Dispatched to +${cleanPhone}`,
    outreachText.substring(0, 60) + '...',
    { name: conv.profile.name, category: conv.profile.propertyInterest }
  );

  scheduleSave();
}

/**
 * Record Inbound Lead Inquiry (Step 2)
 */
function recordIncoming(rawPhone, text) {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) return;

  const conv = getOrCreate(cleanPhone);
  conv.profile.lastActive = Date.now();
  conv.profile.stage = 'replied';
  conv.profile.inquiriesReceived = (conv.profile.inquiriesReceived || 0) + 1;

  // Simple sentiment / lead heat classifier
  const t = (text || '').toLowerCase();
  if (t.includes('price') || t.includes('rate') || t.includes('cost') || t.includes('budget') || t.includes('kya rate') || t.includes('location') || t.includes('visit') || t.includes('call') || t.includes('detail') || t.includes('send') || t.includes('bhejo')) {
    conv.profile.sentiment = 'HOT';
    conv.profile.stage = 'hot_inquiry';
  } else if (t.includes('no') || t.includes('nahi') || t.includes('not interested') || t.includes('stop')) {
    conv.profile.sentiment = 'COLD';
    conv.profile.stage = 'opt_out';
  } else {
    conv.profile.sentiment = 'WARM';
  }

  conv.messages.push({
    id: `in_${Date.now()}`,
    role: 'user',
    content: text,
    timestamp: Date.now(),
    status: 'received'
  });

  if (conv.messages.length > MAX_MESSAGES_PER_CONTACT) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES_PER_CONTACT);
  }

  pushActivity(
    'inbound_inquiry',
    cleanPhone,
    `🔥 New Inquiry from +${cleanPhone} (${conv.profile.sentiment})`,
    text,
    { sentiment: conv.profile.sentiment, name: conv.profile.name }
  );

  scheduleSave();
}

/**
 * Record AI Property Advisor Reply
 */
function recordReply(rawPhone, text, newStage = null) {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) return;

  const conv = getOrCreate(cleanPhone);
  conv.profile.lastActive = Date.now();
  if (newStage) {
    conv.profile.stage = newStage;
  } else if (conv.profile.stage === 'replied' || conv.profile.stage === 'hot_inquiry') {
    conv.profile.stage = 'consultation_active';
  }

  conv.messages.push({
    id: `rep_${Date.now()}`,
    role: 'assistant',
    content: text,
    timestamp: Date.now(),
    status: 'sent'
  });

  if (conv.messages.length > MAX_MESSAGES_PER_CONTACT) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES_PER_CONTACT);
  }

  pushActivity(
    'ai_reply',
    cleanPhone,
    `Aman Sharma (AI) Replied to +${cleanPhone}`,
    text.substring(0, 60) + '...',
    { name: conv.profile.name }
  );

  scheduleSave();
}

/**
 * Update message delivery status (sent, delivered, read) from Meta Webhooks
 */
function updateDeliveryStatus(rawPhone, status) {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone) return;

  const conv = memoryStore.get(cleanPhone);
  if (conv && conv.messages.length > 0) {
    const lastOut = [...conv.messages].reverse().find(m => m.role === 'assistant');
    if (lastOut) {
      lastOut.status = status;
      scheduleSave();
    }
  }

  if (status === 'read') {
    pushActivity('delivery_receipt', cleanPhone, `👁️ Message Read by +${cleanPhone}`, 'Blue tick received via Meta Webhook');
  }
}

/**
 * Get formatted history array for LLM context (up to 16 turns for ultra-sharp memory)
 */
function getFormattedHistory(rawPhone, limit = 16) {
  const cleanPhone = normalizePhone(rawPhone);
  const conv = memoryStore.get(cleanPhone);
  if (!conv || !Array.isArray(conv.messages)) return [];

  return conv.messages.slice(-limit).map(m => ({
    role: m.role,
    content: m.content
  }));
}

/**
 * Check if we have an existing conversation with this number
 */
function hasConversation(rawPhone) {
  const cleanPhone = normalizePhone(rawPhone);
  return memoryStore.has(cleanPhone);
}

/**
 * Get single conversation detail by phone
 */
function getConversation(rawPhone) {
  const cleanPhone = normalizePhone(rawPhone);
  const conv = memoryStore.get(cleanPhone);
  if (!conv) return null;
  return {
    phone: cleanPhone,
    profile: conv.profile,
    messages: conv.messages
  };
}

/**
 * Get all conversations sorted by latest activity
 */
function getAllConversations() {
  const list = [];
  for (const [phone, conv] of memoryStore.entries()) {
    list.push({
      phone,
      profile: conv.profile,
      messageCount: conv.messages.length,
      lastMessage: conv.messages[conv.messages.length - 1] || null
    });
  }
  return list.sort((a, b) => (b.profile?.lastActive || 0) - (a.profile?.lastActive || 0));
}

/**
 * Get hot inquiries list (contacts that have replied with inquiries)
 */
function getInquiries() {
  const list = [];
  for (const [phone, conv] of memoryStore.entries()) {
    const hasUserMsg = conv.messages.some(m => m.role === 'user');
    if (hasUserMsg || conv.profile?.inquiriesReceived > 0) {
      list.push({
        phone,
        profile: conv.profile,
        messageCount: conv.messages.length,
        lastMessage: conv.messages[conv.messages.length - 1] || null
      });
    }
  }
  return list.sort((a, b) => (b.profile?.lastActive || 0) - (a.profile?.lastActive || 0));
}

/**
 * Get memory and outreach intelligence metrics
 */
function getMetrics() {
  let totalConversations = memoryStore.size;
  let repliedCount = 0;
  let hotCount = 0;
  let totalOutreachSent = 0;

  for (const conv of memoryStore.values()) {
    const userMsgs = conv.messages.filter(m => m.role === 'user').length;
    const botMsgs = conv.messages.filter(m => m.role === 'assistant').length;
    totalOutreachSent += botMsgs;
    if (userMsgs > 0) {
      repliedCount++;
      if (conv.profile?.sentiment === 'HOT') hotCount++;
    }
  }

  const responseRate = totalConversations > 0 ? ((repliedCount / totalConversations) * 100).toFixed(1) : '0.0';

  return {
    totalConversations,
    repliedCount,
    hotCount,
    totalOutreachSent,
    responseRate: `${responseRate}%`
  };
}

/**
 * Get recent real-time activity feed
 */
function getActivityFeed() {
  return activityFeed;
}

module.exports = {
  normalizePhone,
  recordOutreach,
  recordIncoming,
  recordReply,
  updateDeliveryStatus,
  getFormattedHistory,
  hasConversation,
  getConversation,
  getAllConversations,
  getInquiries,
  getMetrics,
  getActivityFeed
};

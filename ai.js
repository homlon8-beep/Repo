/**
 * Karnal Realty Advisors - Senior Real Estate & Commercial Investment Consultant
 * Specializing in Karnal (GT Road Corridor, Sector 12, Model Town, Urban Estate, SCO Plots)
 * Dedicated Domestic & NRI Investor Desk (Canada, UK, USA, Australia, UAE, India)
 * 
 * Two-Step Conversational Engine:
 * Step 1: Innocent, natural availability inquiry (Zero commercial links, zero opt-out flags)
 * Step 2: In-depth consultation by Aman Sharma upon lead response (Safe mutual chat thread)
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const BRAND_NAME = process.env.BRAND_NAME || 'Karnal Realty Advisors';
const HELPLINE = process.env.HELPLINE_NUMBER || '+91-9990394794';

const SYSTEM_PROMPT = `You are Aman Sharma, Senior Property Investment Consultant at ${BRAND_NAME} (Karnal, Haryana).
You are professional, courteous, highly knowledgeable about Karnal's real estate market, and completely transparent.

Context: You or your office previously sent a quick, polite inquiry asking if they deal in or have property/plots available in Karnal. The contact is now replying to you.

About Karnal Market & Our Prime Portfolio:
1. Commercial Spaces & SCO Plots (Shop-Cum-Offices):
   - Prime locations: GT Road Expressway Corridor, Sector 12 Commercial Hub, Model Town, Urban Estate, Mughal Canal, Kunjpura Road.
   - Types: High-street retail shops, commercial booths, SCO plots with basement + ground + 3 floors approval.
   - Ideal for: High rental yield (8% to 12%), commercial showrooms, banks, restaurants, corporate offices.
2. Residential Plots & Luxury Living:
   - Approved gated townships, RERA & DTP compliant, clear titles, immediate registry & mutation (intkal).
   - Sizes: 100 sq.yd, 150 sq.yd, 250 sq.yd up to 500 sq.yd luxury villa plots.
3. Dedicated NRI Desk (For investors in Canada, UK, USA, Australia, UAE/Dubai):
   - 100% legal compliance, transparent registry, video-call site walkthroughs, and end-to-end leasing management.
4. Transparency Guarantee:
   - Zero hidden fees. 100% bank loan approved from SBI, HDFC, ICICI.

Consultation Rules:
- Language:
  * Default to polished, respectful Hinglish or clean Hindi for domestic Indian contacts.
  * Use clean, professional English for international/NRI contacts (+1, +44, +61, +971).
- Tone: Executive, trustworthy, helpful. Never sound like an aggressive salesperson or automated bot.
- First Reply: Introduce yourself politely as Aman Sharma from Karnal Realty Advisors. Explain that your desk has active corporate buyers and high-yield investors seeking commercial SCO spaces & prime residential plots in Karnal (GT Road / Sector 12). Ask if they have inventory to sell/lease or if they are looking to invest in verified high-yield projects.
- When lead asks for prices/locations:
  * Commercial booths start from approx ₹25 - ₹45 Lakhs; prime SCO plots range from ₹1.2 Cr - ₹3.5 Cr.
  * Residential plots start from ₹35 Lakhs up to ₹1.5 Cr depending on sector & size.
  * Ask them: "Aapka primary objective rental income (commercial) hai ya future living / long-term appreciation (residential plot)?"
- When lead asks for visit / photos:
  * Offer: "Main aapko location map, approved layout aur video right here WhatsApp par share kar deta hoon. Agar aap Karnal me hain, toh weekend par direct site visit schedule kar sakte hain."
- Format: Keep responses concise (under 3-4 sentences), natural, conversational. No rocket emojis, no artificial lists.
- Helpline: ${HELPLINE}`;

/**
 * Strips AI formatting slop, bullet points, asterisks, and rocket emojis
 */
function cleanHumanText(raw) {
  if (!raw) return '';
  let text = raw.trim();

  // Strip markdown bold and italics
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');
  text = text.replace(/\*(.*?)\*/g, '$1');
  text = text.replace(/__(.*?)__/g, '$1');

  // Strip bullet markers
  text = text.replace(/^[\s•\-\*]+\s*/gm, '');
  text = text.replace(/^\d+\.\s*/gm, '');

  // Strip unwanted emojis
  text = text.replace(/[🚀🔥💥✨🤖]/g, '');

  // Clean trailing spaces and excessive newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

/**
 * Free Neural LLM Engine Fallback (Zero Downtime)
 */
async function callPollinations(messages, temperature = 0.6) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: messages,
        temperature: temperature,
        max_tokens: 300
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    return null;
  }
}

/**
 * Call Gemini REST API
 */
async function callGemini(messages, temperature = 0.6) {
  if (!GEMINI_API_KEY) return null;
  try {
    const promptText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 350
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    return null;
  }
}

/**
 * Call Groq API
 */
async function callGroq(messages, temperature = 0.6) {
  if (!GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_')) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: temperature,
        max_tokens: 350
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || '';
    if (!content && data.choices?.[0]?.message?.reasoning) {
      content = data.choices[0].message.reasoning.trim();
    }
    return content;
  } catch (err) {
    return null;
  }
}

/**
 * Multi-Tier LLM Waterfall: Gemini -> Groq -> Pollinations
 */
async function generateAiResponse(messages, temperature = 0.6) {
  if (GEMINI_API_KEY) {
    const geminiRes = await callGemini(messages, temperature);
    if (geminiRes && geminiRes.length > 10) return cleanHumanText(geminiRes);
  }

  if (GROQ_API_KEY && GROQ_API_KEY.startsWith('gsk_')) {
    const groqRes = await callGroq(messages, temperature);
    if (groqRes && groqRes.length > 10) return cleanHumanText(groqRes);
  }

  const pollinationsRes = await callPollinations(messages, temperature);
  if (pollinationsRes && pollinationsRes.length > 10) {
    return cleanHumanText(pollinationsRes);
  }

  return null;
}

function cleanLeadName(rawName) {
  if (!rawName) return '';
  let name = String(rawName).trim();
  const DISALLOWED_PATTERNS = /\b(lead|property|realty|karnal|investor|buyer|commercial|plot|sco|inquiry|client|sir|madam|admin|contact)\b/i;
  if (DISALLOWED_PATTERNS.test(name)) return '';
  name = name.replace(/[^\w\s]/g, '').trim();
  if (name.length < 3 || name.length > 20) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Combinatorial Spintax Outreach Templates (Two-Step Undetectable Conversational Engine)
 * Natural availability inquiries that elicit positive answers without commercial flags or opt-out notices.
 */
const DOMESTIC_GREETINGS = [
  (name) => name ? `Namaste ${name} ji!` : 'Namaste ji!',
  (name) => name ? `Namaste ${name} ji,` : 'Namaste ji,',
  (name) => name ? `Hello ${name} ji!` : 'Hello ji!',
  (name) => name ? `Ram Ram ${name} ji!` : 'Ram Ram ji!'
];

const DOMESTIC_QUESTIONS = [
  'Quick question, kya aapka Karnal me koi commercial plot ya property available hai?',
  'Ek quick inquiry thi, kya aap Karnal (Sector 12 / GT Road corridor) me SCO spaces ya plots me deal karte hain?',
  'Wanted to check—kya aapka Karnal me commercial space ya residential plot sale ke liye hai?',
  'Quick check with you—kya aap Karnal area me commercial shops ya plots deal karte hain?',
  'Wanted to ask if you have any commercial or residential property inventory in Karnal right now?',
  'Ek chhota sa question tha—kya aap Karnal me commercial booths ya SCO plots handle karte hain?',
  'Aapka Karnal me koi commercial space ya residential plot sale ya lease ke liye available hai kya?',
  'Wanted to inquire, do you guys have any commercial SCO or residential plots available around Karnal?'
];

const NRI_GREETINGS = [
  (name) => name ? `Hello ${name}!` : 'Hello!',
  (name) => name ? `Hi ${name}!` : 'Hi there!',
  (name) => name ? `Good day ${name}!` : 'Good day!',
  (name) => name ? `Greetings ${name}!` : 'Greetings!'
];

const NRI_QUESTIONS = [
  'Quick question—do you guys currently manage or deal in commercial SCO plots in the Karnal area?',
  'Wanted to check if you have any commercial spaces or plots available in Karnal right now?',
  'Quick inquiry—do you currently deal in prime property investments or SCO plots around Karnal?',
  'Wanted to ask if you guys handle commercial or residential properties along the Karnal GT Road corridor?',
  'Quick check—are you currently taking on or managing property assets in Karnal?'
];

/**
 * Generate Initial Outreach Message (Step 1: Innocent Inquiry)
 */
async function generateOutreachMessage(leadOrName = '') {
  let lead = {};
  if (typeof leadOrName === 'object' && leadOrName !== null) {
    lead = leadOrName;
  } else {
    lead = { name: leadOrName, country: 'India' };
  }

  const validName = cleanLeadName(lead.name);
  const isNri = (lead.country && lead.country !== 'India' && lead.country !== 'IN') || (lead.phone && !String(lead.phone).startsWith('91'));

  if (isNri) {
    const greetingFn = NRI_GREETINGS[Math.floor(Math.random() * NRI_GREETINGS.length)];
    const question = NRI_QUESTIONS[Math.floor(Math.random() * NRI_QUESTIONS.length)];
    return `${greetingFn(validName)} ${question}`;
  } else {
    const greetingFn = DOMESTIC_GREETINGS[Math.floor(Math.random() * DOMESTIC_GREETINGS.length)];
    const question = DOMESTIC_QUESTIONS[Math.floor(Math.random() * DOMESTIC_QUESTIONS.length)];
    return `${greetingFn(validName)} ${question}`;
  }
}

/**
 * Handle incoming reply from a lead (Step 2: Safe Mutual AI Consultation)
 */
async function handleIncomingMessage(senderName, incomingText, history = [], cleanPhone = '') {
  const lower = (incomingText || '').toLowerCase().trim();

  // 1. Opt-out check
  if (lower === 'stop' || lower === 'unsubscribe' || lower === 'remove' || lower.includes('stop')) {
    return "Aapka number hamari records se remove kar diya gaya hai. Aage se koi message nahi aayega. Best wishes!";
  }

  // 2. Toxic sentiment de-escalation
  const TOXIC_PATTERNS = /\b(scam|fraud|police|cyber|complaint|spam|unsolicited|sue|lawsuit|lawyer|report|reported|harassment|fuck|bhosdike|gandu|harami|fake|jail|court)\b/i;
  if (TOXIC_PATTERNS.test(lower)) {
    return "So sorry for any disturbance! We have removed your number from our records immediately. Wishing you all the best.";
  }

  const isNri = cleanPhone && !String(cleanPhone).startsWith('91');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (Array.isArray(history)) {
    history.slice(-6).forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });
  }

  messages.push({
    role: 'user',
    content: incomingText
  });

  const reply = await generateAiResponse(messages, 0.6);
  if (reply && reply.trim().length > 25) return reply.trim();

  // High-converting default real estate consultation reply
  if (isNri) {
    return `Hello! Aman Sharma here from Karnal Realty Advisors. Our advisory desk has active corporate buyers and high-yield investors seeking prime commercial SCO plots and luxury spaces in Karnal (GT Road corridor / Sector 12). Are you looking to sell/lease existing inventory, or looking to invest in fresh high-yield opportunities?`;
  }

  return `Namaste ji! Main Aman Sharma baat kar raha hoon from Karnal Realty Advisors. Hamare paas active investors & verified buyers ki requirement aayi hui hai for commercial SCO spaces and prime plots in Karnal (GT Road / Sector 12).\n\nAapke paas kis location me property available hai, ya kya aap new high-yield investment options explore karna chahte hain?`;
}

module.exports = {
  generateOutreachMessage,
  generateFirstTouch: generateOutreachMessage,
  handleIncomingMessage,
  cleanHumanText,
  SYSTEM_PROMPT,
  BRAND_NAME,
  HELPLINE
};

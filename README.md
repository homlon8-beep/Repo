# 🏢 Karnal Realty Advisors — Multi-Device AI WhatsApp Outreach & Lead Bot

An autonomous, multi-device WhatsApp lead scraper and consultative sales assistant tailored for **Karnal Realty Advisors**. Built with **Baileys**, **Groq AI (GPT-OSS-120B)**, and a **24/7 continuous search scraper**.

Designed specifically for **Commercial Spaces**, **SCO Plots (Shop-Cum-Offices)**, and **Global NRI Real Estate Investors** (Canada, UK, USA, Australia, and UAE).

---

## 🌟 Key Features

### 1. 6-Device Territory Partitioning (Up to 300 Leads / Day)
- **Device 1**: Karnal Prime Commercial Spaces & SCO Plots (GT Road Highway Corridor, Sector 12 City Centre, Urban Estate).
- **Device 2**: Retail Shops, Booths & Commercial Showrooms (Mughal Canal Market, Model Town, Kunjpura Road).
- **Device 3**: Canada & North American NRI Investors (Toronto, Brampton, Surrey, Calgary, Vancouver).
- **Device 4**: United Kingdom & European NRI Investors (London, Birmingham, Leicester, Coventry).
- **Device 5**: Australia & Gulf NRIs (Melbourne, Sydney, Dubai, Abu Dhabi).
- **Device 6**: Domestic Haryana & Punjab HNW Investors (Panipat, Kurukshetra, Ambala, Chandigarh, Yamunanagar).

### 2. Enterprise Delivery Cadence & Account Health Matrix
- **50 Leads / Day per Device**: Predictable enterprise delivery allocation across channels.
- **3 to 6 Minute Natural Gaussian Pacing**: Box-Muller Gaussian distribution dynamically spaces outreach.
- **Micro-Batches & Rest Breaks**: Dispatches 4 to 7 messages, followed by scheduled 35 to 65 minute natural rest intervals.
- **E2EE getMessage Retry Resolver**: Persistent `recent_messages_store.json` caches and answers WhatsApp retry receipts.
- **Cacheable Signal Key Store**: Eliminates disk I/O bottlenecks and prevents stale pre-key synchronization errors.
- **Invisible Cryptographic Zero-Width Watermarking**: Injects undetectable cryptographic entropy into each message for a 100% unique byte hash.
- **Chrome Windows 11 TLS Emulation**: Authentic desktop browser fingerprint via `Browsers.windows('Chrome')`.
- **Human Keystroke Presence**: Emulates `composing` states paced to message length (45–70ms per character) plus pre-send hesitation pauses.
- **Inbound Debounce Buffer**: Buffers multi-part user replies for 18–28s, marks blue ticks, pauses 12–24s for reading, and crafts nuanced property answers.
- **Circuit Breaker**: Cooldowns socket for 20 minutes if 3 delivery hiccups occur.

### 3. Dual-Language Persona Shield (Aman Sharma — Senior Property Advisor)
- **Domestic (+91)**: Cultured, respectful Hinglish (*"Namaste ji, Karnal Realty property desk se message tha. Aapki Karnal GT Road / Sector 12 commercial query ke regarding..."*).
- **Overseas NRIs (+1, +44, +61, +971)**: Executive English (*"Hello! Reaching out from Karnal Realty Advisors (NRI Investment Desk). Regarding your inquiry on prime commercial SCO plots in Karnal..."*).
- **Commercial Knowledge**: SCO plot ROI (8–12% rental yield), retail booths (₹25L–₹45L), SCOs (₹1.2Cr–₹3.5Cr), RERA approvals, immediate registry, and virtual video walkthroughs.

### 4. 1-Click Lead List Management & Exports
- **Hot Leads (.CSV)**: 1-click download of all prospects who replied.
- **All Discovered Leads (.CSV)**: Full database export with city, query, phone, status, and timestamps.
- **Phone List (.TXT)**: Plaintext formatted list of all discovered mobile numbers.
- **Copyable Textarea**: On-screen copyable block of all numbers.
- **Shield Ledger**: Paste past campaign numbers to ensure they are permanently shielded from outreach.

---

## 🚀 Quick Start (Termux / Local)

```bash
cd /data/data/com.termux/files/home/whatsapp-lead-bot-karnal

# Install dependencies
npm install

# Start the server (Port 3002)
npm start
```

Open your browser at:
- **Dashboard**: `http://localhost:3002`
- **Link Devices**: `http://localhost:3002/qr?device=1` (Tabs 1 to 6 available)

---

## ☁️ Deployment on Render.com

1. Push this repository to GitHub or connect via Render Blueprint.
2. In Render, select **New Web Service**:
   - **Build Command**: `unzip -o whatsapp-lead-bot-karnal.zip && npm install`
   - **Start Command**: `node --max-old-space-size=384 server.js`
   - **Environment Variables**:
     - `PORT`: `10000`
     - `GROQ_API_KEY`: your-groq-key
     - `BRAND_NAME`: `Karnal Realty Advisors`
     - `HELPLINE_NUMBER`: `+91-9990394794`
3. The built-in keep-alive heartbeat pings `/ping` every 3 minutes to keep the service active.

---

## 📁 Project Structure

```
whatsapp-lead-bot-karnal/
├── ai.js                      # Groq & Gemini real estate consultant engine
├── watermark.js               # Invisible cryptographic zero-width watermarking
├── scraper.js                 # Yandex & multi-territory lead harvester
├── queue.js                   # Enterprise cadence dispatcher & Gaussian scheduler
├── whatsapp.js                # Baileys multi-device socket manager & E2EE retry store
├── server.js                  # Express luxury dashboard & CSV export API
├── recent_messages_store.json # Persistent E2EE retry message store
├── .env                       # Configuration & enterprise pacing cadence
├── package.json               # Dependencies & scripts
└── render.yaml                # Render deployment blueprint
```

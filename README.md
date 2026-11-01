# 🏢 Karnal Realty Advisors — Official Meta Developer WhatsApp Cloud Bot (2,000+ Msgs / Day)

An enterprise-grade, high-volume WhatsApp lead acquisition and consultative real estate AI sales engine tailored for **Karnal Realty Advisors**. 

Built with the **Official Meta WhatsApp Cloud API (Facebook Graph API v21.0)** for **2,000+ verified daily business-initiated conversations**, zero phone ban risk, and zero QR code disconnects. Includes hot-swappable **Baileys Multi-Device** fallback, **Groq AI (GPT-OSS-120B)** with persistent multi-turn conversational memory, and a **24/7 autonomous property lead scraper**.

Designed specifically for **Commercial Spaces**, **SCO Plots (Shop-Cum-Offices)**, and **Global NRI Real Estate Investors** (Canada, UK, USA, Australia, and UAE).

---

## 🌟 Key Highlights & Capabilities

### 1. Official Meta Developer WhatsApp Cloud API (2,000+ Msgs / 24h)
- **High-Throughput 2k/Day Allocation**: Dispatches up to **2,000 business-initiated template conversations per day** directly through Meta's enterprise infrastructure.
- **Zero Ban Risk & Zero Disconnects**: Bypasses browser emulation and WebSockets. Operates directly on registered WhatsApp Business Accounts (WABA).
- **Template Message Dispatching**: Sends pre-approved utility and marketing templates for cold outreach (`karnal_property_lead_v1`).
- **24-Hour Free-Form Conversational Window**: Automatically switches to interactive, unrestricted AI conversation once a prospect replies.
- **Interactive Buttons & Media**: Supports Quick Replies, Plot Dimension selection, and branded property brochures.
- **Real-Time Webhook Engine**:
  - `GET /api/meta/webhook`: Automated Meta webhook verification challenge handshake.
  - `POST /api/meta/webhook`: Real-time ingestion of inbound lead replies, delivery status receipts (`sent`, `delivered`, `read`, `failed`), and button clicks.

### 2. Dual-Engine Architecture
- **Primary Engine (`meta_cloud`)**: High-speed, high-volume official Meta Cloud API delivering 2,000+ messages/day with instant delivery.
- **Fallback Engine (`baileys`)**: Multi-device QR pairing across up to 6 virtual devices with Gaussian humanized pacing and cryptographic zero-width watermarking.
- **1-Click Engine Toggle**: Hot-swap between `meta_cloud` and `baileys` directly from the web dashboard or via `POST /api/settings/engine`.

### 3. Persistent AI Chat Memory & Dual-Language Real Estate Persona
- **Persona (Aman Sharma — Senior Property Advisor)**:
  - **Domestic (+91)**: Cultured, respectful Hinglish (*"Namaste ji, Karnal Realty property desk se message tha. Aapki Karnal GT Road / Sector 12 commercial query ke regarding..."*).
  - **Global NRIs (+1, +44, +61, +971)**: Executive English (*"Hello! Reaching out from Karnal Realty Advisors (NRI Investment Desk). Regarding your inquiry on prime commercial SCO plots in Karnal..."*).
  - **Deep Commercial Knowledge**: SCO Plot ROI (8–12% rental yield), retail booths (₹25L–₹45L), full SCO commercial buildings (₹1.2Cr–₹3.5Cr), RERA compliance, immediate registry, and virtual video walkthroughs.
- **Persistent Context Memory (`chatMemory.js`)**: Tracks full conversation history across multiple turns so the AI never forgets user budget, preferred sector, or previous questions.

### 4. 24/7 Autonomous Property Lead Harvester (`scraper.js`)
- Continuously discovers and qualifies commercial real estate buyers, SCO plot seekers, and HNW investors across Karnal, Haryana, Punjab, and major NRI corridors.
- Automatically shields all previously contacted numbers so duplicate messages are never sent.

### 5. Dynamic Pacing & Operating Hours Shield (`queue.js`)
- **Daytime Operating Hours**: Active between **9:00 AM – 9:00 PM IST** to comply with business outreach standards.
- **Cloud Turbo Pacing**: Smart 1.5s – 3.5s jittered dispatch delay to smoothly distribute 2,000 messages across active operating hours.

---

## 🛠️ Meta Developer Setup Guide (Step-by-Step)

### Step 1: Create Your Meta Developer App
1. Navigate to the [Meta for Developers Portal](https://developers.facebook.com/) and log in.
2. Click **My Apps** ➔ **Create App**.
3. Select **Other** as the app use case ➔ Click **Next** ➔ Select **Business** as the app type.
4. Enter your App Name (e.g., `Karnal Realty Outreach Bot`) and connect your Business Account.

### Step 2: Configure WhatsApp Product
1. In the App Dashboard, locate **WhatsApp** and click **Set up**.
2. Navigate to **WhatsApp** ➔ **API Setup** in the left sidebar.
3. Note the following credentials:
   - **Temporary / System User Access Token** ➔ `META_ACCESS_TOKEN`
   - **Phone Number ID** ➔ `META_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID (WABA)** ➔ `META_WABA_ID`

> [!TIP]
> For production 24/7 uptime, create a **System User** in Meta Business Manager (`business.facebook.com`) under **Users** ➔ **System Users**, grant `whatsapp_business_messaging` and `whatsapp_business_management` permissions, and generate a **Permanent Access Token**.

### Step 3: Configure Webhook
1. In your Meta Developer App, go to **WhatsApp** ➔ **Configuration**.
2. In the **Webhook** section, click **Edit**:
   - **Callback URL**: `https://<your-render-url>.onrender.com/api/meta/webhook`
   - **Verify Token**: `satyam_karnal_webhook_2026` (or the value set in `META_VERIFY_TOKEN`)
3. Click **Verify and Save**.
4. Under **Webhook fields**, click **Manage** and **Subscribe** to `messages`.

### Step 4: Create Outreach Template
1. Go to **WhatsApp** ➔ **API Setup** ➔ Click the link to **WhatsApp Manager** (or go to [business.facebook.com/wa/manage/message-templates/](https://business.facebook.com/wa/manage/message-templates/)).
2. Click **Create Template**:
   - **Category**: Marketing or Utility
   - **Name**: `karnal_property_lead_v1`
   - **Language**: `hi` (Hindi) or `en` (English)
   - **Body**: Custom message with variables `{{1}}` (Name) and `{{2}}` (Sector / Commercial Query).
3. Submit for Meta's automated approval (typically approved in 2 to 15 minutes).

---

## ☁️ Deployment on Render.com

This repository includes a pre-configured `render.yaml` blueprint for 1-click deployment.

### Method 1: Render Blueprint (Recommended)
1. Fork or push this repository to GitHub: `https://github.com/homlon8-beep/Repo.git`.
2. In the Render Dashboard, click **New +** ➔ **Blueprint**.
3. Select your repository. Render will automatically read `render.yaml` and configure the service.
4. Fill in the secret environment variables (`META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WABA_ID`, `GROQ_API_KEY`).

### Method 2: Manual Web Service
- **Build Command**: `unzip -o whatsapp-lead-bot-karnal.zip && npm install`
- **Start Command**: `node --max-old-space-size=384 server.js`

### Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `WHATSAPP_ENGINE` | `meta_cloud` | Active engine: `meta_cloud` or `baileys` |
| `DAILY_MAX_LEADS_CLOUD` | `2000` | Daily message limit for Meta Cloud API |
| `META_ACCESS_TOKEN` | *Required* | Meta Graph API Permanent System User Token |
| `META_PHONE_NUMBER_ID` | *Required* | WhatsApp Business Phone Number ID from Meta |
| `META_WABA_ID` | *Required* | WhatsApp Business Account ID |
| `META_VERIFY_TOKEN` | `satyam_karnal_webhook_2026` | Verification token for Meta Webhook setup |
| `META_TEMPLATE_NAME` | `karnal_property_lead_v1` | Name of approved Meta Message Template |
| `META_TEMPLATE_LANG` | `hi` | Language code for outreach template (`hi` or `en`) |
| `GROQ_API_KEY` | *Required* | Groq API Key for GPT-OSS-120B AI Consultant |
| `BRAND_NAME` | `Karnal Realty Advisors` | Business branding name for AI responses |
| `HELPLINE_NUMBER` | `+91-9990394794` | Direct consultation phone number |
| `PORT` | `10000` | Port for Express web dashboard & webhooks |

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Web Dashboard (Stats, engine status, tier badges, logs) |
| `GET` | `/api/meta/webhook` | Meta Webhook Verification challenge handler |
| `POST` | `/api/meta/webhook` | Meta Webhook Inbound message & receipt receiver |
| `POST` | `/api/meta/test-send` | Send test template or text message via Meta Cloud |
| `POST` | `/api/settings/engine` | Toggle between `meta_cloud` and `baileys` |
| `POST` | `/api/settings/cloud-limit` | Dynamically update daily cloud limit (e.g., 2000) |
| `GET` | `/api/leads/export-csv` | Export all qualified and discovered leads (.CSV) |
| `GET` | `/qr?device=1` | Multi-Device Baileys QR code pairing interface |
| `GET` | `/ping` | Keep-alive heartbeat endpoint for 24/7 uptime |

---

## 📁 Repository Structure

```
whatsapp-lead-bot-karnal/
├── metaCloudWhatsapp.js       # Official Meta Graph API v21.0 Cloud Provider
├── ai.js                      # Groq & Gemini real estate consultant AI brain
├── chatMemory.js              # Multi-turn conversational memory store
├── queue.js                   # High-throughput 2,000/day cadence & dispatcher
├── scraper.js                 # 24/7 continuous real estate lead harvester
├── server.js                  # Express luxury dashboard & webhook router
├── whatsapp.js                # Baileys multi-device fallback engine
├── watermark.js               # Zero-width cryptographic message watermarking
├── bot_config.json            # Runtime limits, pacing presets & engine config
├── render.yaml                # 1-Click Render deployment blueprint
├── .env                       # Environment configuration template
└── package.json               # Node.js dependencies & scripts
```

---

## 🚀 Running Locally

```bash
cd /data/data/com.termux/files/home/whatsapp-lead-bot-karnal

# Install dependencies
npm install

# Start the server (Port 3002)
npm start
```

Visit `http://localhost:3002` to open the live dashboard.

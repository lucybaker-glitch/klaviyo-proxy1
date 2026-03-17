# Klaviyo Multi-Account Dashboard — Proxy Server

Solves the CORS problem so your browser dashboard can talk directly to Klaviyo's API.

---

## Option A — Run locally (fastest, 2 minutes)

**Requirements:** Node.js 18+

```bash
# 1. Install dependencies
npm install

# 2. Start the proxy
npm start
# → Proxy running at http://localhost:3333

# 3. Open the dashboard
open dashboard.html
```

Then in the dashboard:
- Proxy URL: `http://localhost:3333` (already set by default)
- Paste your 5 Klaviyo Private API keys
- Click **Connect & load data**

---

## Option B — Deploy to Vercel (shareable team URL, free)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy from the vercel-deploy folder
cd vercel-deploy
vercel deploy --prod

# You'll get a URL like: https://klaviyo-proxy-xyz.vercel.app
```

Then in the dashboard:
- Change Proxy URL to your Vercel URL
- Add `/api/klaviyo` is handled automatically

---

## Getting your Klaviyo Private API keys

For **each** of your 5 Klaviyo accounts:

1. Log into that Klaviyo account
2. Go to **Account** (bottom left) → **Settings** → **API Keys**
3. Click **Create Private API Key**
4. Name it (e.g. "Dashboard proxy")
5. Set scopes to **Read-only** for: Campaigns, Lists, Flows, Metrics, Profiles
6. Copy the key (starts with `pk_live_...`)

---

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /health` | GET | Proxy health check |
| `GET /klaviyo?path=/api/campaigns/` | GET | Proxy any Klaviyo endpoint |
| `POST /klaviyo/bulk` | POST | Fetch multiple endpoints in one call |

### Bulk request example
```json
POST /klaviyo/bulk
{
  "apiKey": "pk_live_xxx",
  "requests": [
    { "path": "/api/campaigns/", "params": { "page[size]": "20" } },
    { "path": "/api/lists/", "params": { "page[size]": "20" } }
  ]
}
```

---

## Files

```
klaviyo-proxy/
├── server.js          ← Local Node.js proxy (run this)
├── package.json
├── dashboard.html     ← Standalone dashboard (open in browser)
└── vercel-deploy/
    ├── api/
    │   └── klaviyo.js ← Vercel serverless function
    └── vercel.json
```

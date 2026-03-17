/**
 * Vercel Serverless Function — Klaviyo Proxy
 * Deploy to Vercel for a hosted proxy (free tier works fine)
 * 
 * After deploying, update PROXY_URL in your dashboard to:
 * https://your-project.vercel.app/api/klaviyo
 */

export default async function handler(req, res) {
  // CORS headers — update the origin to your Claude.ai or hosted dashboard URL
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-klaviyo-key"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Bulk endpoint
  if (req.method === "POST" && req.url.includes("/bulk")) {
    const { apiKey, requests } = req.body;

    if (!apiKey?.startsWith("pk_")) {
      return res.status(400).json({ error: "Invalid Klaviyo API key" });
    }

    const results = await Promise.allSettled(
      requests.slice(0, 20).map(async ({ path, params = {} }) => {
        const qs = new URLSearchParams(params).toString();
        const url = `https://a.klaviyo.com${path}${qs ? "?" + qs : ""}`;
        const r = await fetch(url, {
          headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            revision: "2024-02-15",
            Accept: "application/json",
          },
        });
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
    );

    return res.json({
      results: results.map((r, i) => ({
        path: requests[i].path,
        status: r.status,
        data: r.status === "fulfilled" ? r.value : null,
        error: r.status === "rejected" ? r.reason.message : null,
      })),
    });
  }

  // Single proxy endpoint
  if (req.method === "GET") {
    const apiKey = req.headers["x-klaviyo-key"];
    if (!apiKey?.startsWith("pk_")) {
      return res.status(400).json({ error: "Invalid Klaviyo API key in x-klaviyo-key header" });
    }

    const { path, ...rest } = req.query;
    const qs = new URLSearchParams(rest).toString();
    const url = `https://a.klaviyo.com${path}${qs ? "?" + qs : ""}`;

    try {
      const r = await fetch(url, {
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: "2024-02-15",
          Accept: "application/json",
        },
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}

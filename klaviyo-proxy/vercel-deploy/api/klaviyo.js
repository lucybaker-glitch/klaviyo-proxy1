export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-klaviyo-key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch(e) {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }

    const { apiKey, requests } = body || {};

    if (!apiKey || !apiKey.startsWith("pk_")) {
      return res.status(400).json({ error: "Invalid Klaviyo API key" });
    }

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(200).json({ ok: true, message: "Klaviyo proxy is running on Vercel" });
    }

    const results = await Promise.allSettled(
      requests.map(async ({ path, params = {}, pageSize }) => {
        // Build query string manually so page[size] is correctly formatted
        const parts = [];
        if (pageSize) parts.push(`page[size]=${pageSize}`);
        Object.entries(params).forEach(([k, v]) => {
          parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        });
        const qs = parts.join('&');
        const url = `https://a.klaviyo.com${path}${qs ? '?' + qs : ''}`;

        const r = await fetch(url, {
          headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            revision: "2024-02-15",
            Accept: "application/json",
          },
        });
        const text = await r.text();
        if (!r.ok) throw new Error(`${r.status}: ${text.slice(0, 300)}`);
        return JSON.parse(text);
      })
    );

    return res.status(200).json({
      results: results.map((r, i) => ({
        path: requests[i].path,
        status: r.status,
        data: r.status === "fulfilled" ? r.value : null,
        error: r.status === "rejected" ? r.reason.message : null,
      })),
    });
  }

  if (req.method === "GET") {
    const apiKey = req.headers["x-klaviyo-key"];
    if (!apiKey || !apiKey.startsWith("pk_")) {
      return res.status(400).json({ error: "Missing x-klaviyo-key header" });
    }
    const { path, pageSize, ...rest } = req.query;
    const parts = [];
    if (pageSize) parts.push(`page[size]=${pageSize}`);
    Object.entries(rest).forEach(([k, v]) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`));
    const qs = parts.join('&');
    const url = `https://a.klaviyo.com${path}${qs ? '?' + qs : ''}`;
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

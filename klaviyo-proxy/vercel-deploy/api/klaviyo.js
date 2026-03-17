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
      return res.status(400).json({ error: "Invalid Klaviyo API key — must start with pk_" });
    }

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(200).json({ ok: true, message: "Klaviyo proxy is running on Vercel" });
    }

    const klaviyoFetch = async (path, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      const url = `https://a.klaviyo.com${path}${qs ? "?" + qs : ""}`;
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
    };

    // Special handler: if any request has type "campaign_stats", fetch campaign messages + stats
    const enrichedRequests = requests.map(async (req) => {
      if (req.type === "campaign_stats") {
        // Step 1: get sent campaigns
        const campaigns = await klaviyoFetch("/api/campaigns/", {
          "filter": "equals(messages.channel,'email'),equals(status,'Sent')",
          "page[size]": "20",
          "sort": "-send_time",
        });

        const campList = campaigns?.data || [];
        if (!campList.length) return { data: [], type: "campaign_stats" };

        // Step 2: for each campaign get its messages (which have recipient counts)
        const messageResults = await Promise.allSettled(
          campList.slice(0, 10).map(c =>
            klaviyoFetch(`/api/campaigns/${c.id}/campaign-messages/`)
          )
        );

        const enriched = campList.slice(0, 10).map((c, i) => {
          const msgData = messageResults[i].status === "fulfilled"
            ? messageResults[i].value?.data || []
            : [];
          const msg = msgData[0];
          return {
            id: c.id,
            name: c.attributes?.name || "Campaign",
            status: c.attributes?.status || "sent",
            send_time: c.attributes?.send_time || c.attributes?.scheduled_at,
            subject: msg?.attributes?.subject || "",
            recipient_count: msg?.attributes?.rendering_options?.add_info_link ? null : null,
          };
        });

        // Step 3: get campaign metrics (opens, clicks) via the metrics endpoint
        // Use campaign IDs to filter events
        return { data: enriched, type: "campaign_stats" };
      }

      // Default: standard proxy
      const qs = new URLSearchParams(req.params || {}).toString();
      const url_path = `${req.path}${qs ? "?" + qs : ""}`;
      const full_url = `https://a.klaviyo.com${url_path}`;
      const r = await fetch(full_url, {
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: "2024-02-15",
          Accept: "application/json",
        },
      });
      const text = await r.text();
      if (!r.ok) throw new Error(`${r.status}: ${text.slice(0, 300)}`);
      return JSON.parse(text);
    });

    const results = await Promise.allSettled(enrichedRequests);

    return res.status(200).json({
      results: results.map((r, i) => ({
        path: requests[i].path || requests[i].type,
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

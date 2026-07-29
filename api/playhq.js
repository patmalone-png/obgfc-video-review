// Vercel Serverless Function: /api/playhq
// Securely proxies read-only requests to the PlayHQ public API.
// The API key + org id live in server environment variables and are NEVER sent to the browser.
//
// Env vars (Vercel -> Settings -> Environment Variables):
//   PLAYHQ_API_KEY   (32-char key issued by AFL/VAFA: email clubhelp@afl.com.au)
//   PLAYHQ_ORG_ID    (your organisation id from the PlayHQ dashboard URL)
//   PLAYHQ_TENANT    (default "afl")
//   PLAYHQ_SEASON_ID (optional default season id)
//   COACH_SHARED_SECRET (optional simple gate for your team)

const BASE = "https://api.playhq.com/v1";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-coach-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  const key = process.env.PLAYHQ_API_KEY;
  const tenant = process.env.PLAYHQ_TENANT || "afl";
  const orgId = process.env.PLAYHQ_ORG_ID || "";

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const action = (body.action || "status").toString();
    const params = body.params || {};

    const requiredSecret = process.env.COACH_SHARED_SECRET;
    if (requiredSecret) {
      const provided = req.headers["x-coach-secret"];
      if (provided !== requiredSecret) return res.status(401).json({ error: "Unauthorized." });
    }

    if (action === "status") {
      return res.status(200).json({
        configured: Boolean(key), tenant, hasOrg: Boolean(orgId),
        hasDefaultSeason: Boolean(process.env.PLAYHQ_SEASON_ID),
      });
    }

    if (!key) {
      return res.status(200).json({
        configured: false,
        message: "PlayHQ API key not set. Running in manual mode. Add PLAYHQ_API_KEY in Vercel to enable live data.",
      });
    }

    const headers = { "x-api-key": key, "x-phq-tenant": tenant, "Content-Type": "application/json" };
    async function phqGet(path) {
      const url = path.startsWith("http") ? path : `${BASE}${path}`;
      const r = await fetch(url, { headers });
      const text = await r.text();
      let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!r.ok) throw new Error(`PlayHQ ${r.status}: ${text.slice(0, 300)}`);
      return json;
    }

    let path = "";
    switch (action) {
      case "seasons": path = `/organisations/${orgId}/seasons`; break;
      case "teams": path = `/seasons/${params.seasonId || process.env.PLAYHQ_SEASON_ID}/teams`; break;
      case "fixtures": path = `/teams/${params.teamId}/fixture`; break;
      case "ladder": path = `/grades/${params.gradeId}/ladder`; break;
      case "gradeFixtures": path = `/grades/${params.gradeId}/games`; break;
      case "teamGameResults": path = `/teams/${params.teamId}/games`; break;
      case "teamPlayers": path = `/teams/${params.teamId}/players`; break;
      case "raw": path = params.path || "/"; break;
      default: return res.status(400).json({ error: `Unknown action '${action}'.` });
    }

    const data = await phqGet(path);
    return res.status(200).json({ configured: true, action, data });
  } catch (err) {
    return res.status(502).json({ configured: Boolean(key), error: `PlayHQ request failed: ${err.message}` });
  }
}

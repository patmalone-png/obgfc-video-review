// Vercel Serverless Function: /api/coach
// Securely proxies coaching-summary requests to Google Gemini, OpenAI, or Anthropic.
// The API key is read from server environment variables and is NEVER sent to the browser.
//
// Set the key for the provider you want in Vercel -> Settings -> Environment Variables:
//   GEMINI_API_KEY      (FREE - Google AI Studio, recommended)
//   OPENAI_API_KEY      (paid - ChatGPT)
//   ANTHROPIC_API_KEY   (paid - Claude)
// Optional:
//   AI_PROVIDER = "google" | "openai" | "anthropic"  (defaults to whichever key exists, Gemini first)
//   GEMINI_MODEL        (default "gemini-2.5-flash")
//   OPENAI_MODEL        (default "gpt-4o-mini")
//   ANTHROPIC_MODEL     (default "claude-3-5-sonnet-latest")
//   COACH_SHARED_SECRET (optional simple gate for your team)

const SYSTEM_PROMPT =
  "You are an expert AFL/Australian football coaching analyst for a women's team (Old Brighton). " +
  "Read the match or season notes and produce: 1) a concise coaching summary, 2) top 3 things done well, " +
  "3) top 3 things to improve, 4) 4 specific suggested training focuses, each with a short drill idea, " +
  "5) one clear message for the players. Be practical, punchy and specific. Use plain headings, no markdown symbols.";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-coach-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const payload = (body.payload || "").toString().slice(0, 20000);
    if (!payload.trim()) return res.status(400).json({ error: "Missing 'payload' in request body." });

    const requiredSecret = process.env.COACH_SHARED_SECRET;
    if (requiredSecret) {
      const provided = req.headers["x-coach-secret"];
      if (provided !== requiredSecret) return res.status(401).json({ error: "Unauthorized." });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // Default order prefers the free Gemini key if present.
    const provider = (
      process.env.AI_PROVIDER ||
      (geminiKey ? "google" : openaiKey ? "openai" : anthropicKey ? "anthropic" : "")
    ).toLowerCase();

    if (!provider) {
      return res.status(500).json({
        error: "No AI provider configured. Add GEMINI_API_KEY (free), OPENAI_API_KEY, or ANTHROPIC_API_KEY in Vercel.",
      });
    }

    let summary = "";

    if (provider === "google") {
      if (!geminiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: payload }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1400 },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ error: `Gemini error ${r.status}: ${t.slice(0, 300)}` });
      }
      const data = await r.json();
      summary = (data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "No response.").trim();
    } else if (provider === "openai") {
      if (!openaiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not set." });
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: payload },
          ],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ error: `OpenAI error ${r.status}: ${t.slice(0, 300)}` });
      }
      const data = await r.json();
      summary = data.choices?.[0]?.message?.content?.trim() || "No response.";
    } else if (provider === "anthropic") {
      if (!anthropicKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set." });
      const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: payload }],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ error: `Anthropic error ${r.status}: ${t.slice(0, 300)}` });
      }
      const data = await r.json();
      summary = (data.content?.[0]?.text || "No response.").trim();
    } else {
      return res.status(500).json({ error: `Unknown AI_PROVIDER '${provider}'.` });
    }

    return res.status(200).json({ provider, summary });
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}

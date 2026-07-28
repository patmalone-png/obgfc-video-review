// Vercel Serverless Function: /api/coach
// Securely proxies coaching-summary requests to Google Gemini, OpenAI, or Anthropic.
// The API key is read from server environment variables and is NEVER sent to the browser.
//
// Set the key for the provider you want in Vercel -> Settings -> Environment Variables:
//   GEMINI_API_KEY      (FREE - Google AI Studio, recommended)
//   OPENAI_API_KEY      (paid - ChatGPT)
//   ANTHROPIC_API_KEY   (paid - Claude)
// Optional:
//   AI_PROVIDER = "google" | "openai" | "anthropic"
//   GEMINI_MODEL        (default "gemini-3.5-flash")
//   OPENAI_MODEL        (default "gpt-4o-mini")
//   ANTHROPIC_MODEL     (default "claude-3-5-sonnet-latest")
//   COACH_SHARED_SECRET (optional simple gate for your team)

const DEFAULT_PROMPT =
  "You are an expert AFL/Australian football coaching analyst for a women's team (Old Brighton). " +
  "Read the match or season notes and produce: 1) a concise coaching summary, 2) top 3 things done well, " +
  "3) top 3 things to improve, 4) 4 specific suggested training focuses, each with a short drill idea, " +
  "5) one clear message for the players. Be practical, punchy and specific. Use plain headings, no markdown symbols.";

const STOP5_PROMPT =
  "You are an expert AFL/Australian football coaching analyst reviewing match footage for a women's team " +
  "(Old Brighton). You will receive the coach's verbatim spoken commentary captured while watching the game. " +
  "Interpret the verbatims (they may be rough, fragmented spoken phrases) and produce a structured debrief " +
  "using the STOP5 review model with EXACTLY these four headings, in this order. You MUST include all four " +
  "sections and keep each section tight (3-6 short bullets max) so the whole response fits:\n\n" +
  "SITUATION\n" +
  "- Briefly set the scene: what was happening in the game/period based on the commentary. Keep to 2-3 sentences.\n\n" +
  "THINGS THAT ARE WORKING\n" +
  "- Bullet the strengths and positive patterns you can infer from the verbatims.\n\n" +
  "OPPORTUNITIES TO IMPROVE\n" +
  "- Bullet the issues, weaknesses or recurring problems.\n\n" +
  "POINTS OF ACTION\n" +
  "- Bullet clear, specific next steps: coaching cues, training focuses (with a quick drill idea) and any player-specific actions.\n\n" +
  "Be practical and specific to what the verbatims actually say. Do not invent events that are not implied. " +
  "Use plain text headings exactly as written above (no markdown symbols). Always finish all four sections.";

function promptFor(mode){
  return mode === "stop5" ? STOP5_PROMPT : DEFAULT_PROMPT;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-coach-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const payload = (body.payload || "").toString().slice(0, 24000);
    const mode = (body.mode || "default").toString();
    const systemPrompt = promptFor(mode);
    if (!payload.trim()) return res.status(400).json({ error: "Missing 'payload' in request body." });

    const requiredSecret = process.env.COACH_SHARED_SECRET;
    if (requiredSecret) {
      const provided = req.headers["x-coach-secret"];
      if (provided !== requiredSecret) return res.status(401).json({ error: "Unauthorized." });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

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
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: payload }] }],
          // Higher cap so reasoning models still have room for the full visible answer.
          generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ error: `Gemini error ${r.status}: ${t.slice(0, 300)}` });
      }
      const data = await r.json();
      const cand = data.candidates?.[0];
      summary = (cand?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "").trim();
      // If the model stopped only because of length, tell the app so it can note it.
      if (!summary) {
        summary = "No text returned. Finish reason: " + (cand?.finishReason || "unknown");
      }
    } else if (provider === "openai") {
      if (!openaiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not set." });
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 1600,
          messages: [
            { role: "system", content: systemPrompt },
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
          max_tokens: 1600,
          system: systemPrompt,
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

    return res.status(200).json({ provider, mode, summary });
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}

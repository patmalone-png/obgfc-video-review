// Vercel Serverless Function: /api/coach
// Securely proxies coaching requests to Google Gemini, OpenAI, or Anthropic.
// API keys are read from server environment variables and are NEVER sent to the browser.
// Env vars: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
// Optional: AI_PROVIDER, GEMINI_MODEL, OPENAI_MODEL, ANTHROPIC_MODEL, COACH_SHARED_SECRET

const DEFAULT_PROMPT =
  "You are an expert AFL/Australian football coaching analyst for a women's team (Old Brighton). " +
  "Read the match or season notes and produce: 1) a concise coaching summary, 2) top 3 things done well, " +
  "3) top 3 things to improve, 4) 4 specific suggested training focuses, each with a short drill idea, " +
  "5) one clear message for the players. Be practical, punchy and specific. Use plain headings, no markdown symbols.";

const STOP5_PROMPT =
  "You are an expert AFL/Australian football coaching analyst reviewing match footage for a women's team " +
  "(Old Brighton). You will receive the coach's verbatim spoken commentary and possibly the real score. " +
  "Interpret the verbatims and produce a STOP5 debrief. Output all four sections with these exact headings:\n\n" +
  "SITUATION\nTHINGS THAT ARE WORKING\nOPPORTUNITIES TO IMPROVE\nPOINTS OF ACTION\n\n" +
  "If a real score is provided, anchor the Situation to it. Be specific; do not invent events. No markdown symbols. Finish all four sections.";

const SCOUT_PROMPT =
  "You are an expert AFL/Australian football opposition scout preparing Old Brighton Women to play an OPPONENT. " +
  "You will receive verbatim scouting notes and possibly the opponent's real team list. Produce a scouting report " +
  "and game plan to BEAT them with these exact headings:\n\n" +
  "OPPOSITION OVERVIEW\nKEY THREATS\nTHEIR STRENGTHS\nWEAKNESSES TO EXPLOIT\nGAME PLAN TO WIN\nPLAYER MATCH-UPS\n\n" +
  "Use real player names/numbers if provided. Be specific; do not invent events. No markdown symbols. Finish every section.";

const PREVIEW_PROMPT =
  "You are the head coach of Old Brighton Women writing a short, punchy PRE-MATCH PREVIEW to read to players. " +
  "Use these exact headings:\n\nWHO WE ARE PLAYING\nWHAT TO EXPECT\nOUR 3 KEYS TO THE GAME\nONE MESSAGE\n\n" +
  "Under 250 words, confident and clear. No markdown symbols. Finish all sections.";

const PACK_PROMPT =
  "You are the head coach of Old Brighton Women writing the coach's summary page of a weekly MATCH COMMITTEE PACK. " +
  "You will receive: last game's debrief themes and score, the next opponent's scouting summary, the current ladder " +
  "position, and season trend data. Write a concise, professional committee-ready summary with these exact headings:\n\n" +
  "LAST GAME REVIEW\nWHERE WE SIT (LADDER & SEASON)\nNEXT OPPONENT & PLAN\nKEY FOCUS FOR THE WEEK\nCOMMITTEE NOTES\n\n" +
  "Keep it clear and businesslike for a club committee audience. No markdown symbols. Finish every section.";

function promptFor(mode){
  if (mode === "stop5") return STOP5_PROMPT;
  if (mode === "scout") return SCOUT_PROMPT;
  if (mode === "preview") return PREVIEW_PROMPT;
  if (mode === "pack") return PACK_PROMPT;
  return DEFAULT_PROMPT;
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
    const provider = (process.env.AI_PROVIDER || (geminiKey ? "google" : openaiKey ? "openai" : anthropicKey ? "anthropic" : "")).toLowerCase();
    if (!provider) return res.status(500).json({ error: "No AI provider configured. Add GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in Vercel." });

    let summary = "", finishReason = "";

    if (provider === "google") {
      if (!geminiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: payload }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.4, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: `Gemini error ${r.status}: ${t.slice(0,300)}` }); }
      const data = await r.json();
      const cand = data.candidates?.[0];
      finishReason = cand?.finishReason || "";
      summary = (cand?.content?.parts?.map((p)=>p.text).filter(Boolean).join("") || "").trim();
      if (!summary) summary = "No text returned. Finish reason: " + (finishReason || "unknown");
    } else if (provider === "openai") {
      if (!openaiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not set." });
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model, temperature: 0.4, max_tokens: 1600, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: payload }] }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: `OpenAI error ${r.status}: ${t.slice(0,300)}` }); }
      const data = await r.json();
      summary = data.choices?.[0]?.message?.content?.trim() || "No response.";
    } else if (provider === "anthropic") {
      if (!anthropicKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set." });
      const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1600, system: systemPrompt, messages: [{ role: "user", content: payload }] }),
      });
      if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: `Anthropic error ${r.status}: ${t.slice(0,300)}` }); }
      const data = await r.json();
      summary = (data.content?.[0]?.text || "No response.").trim();
    } else {
      return res.status(500).json({ error: `Unknown AI_PROVIDER '${provider}'.` });
    }

    return res.status(200).json({ provider, mode, finishReason, summary });
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
}

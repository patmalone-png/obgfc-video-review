# OBGFC Coaching Intelligence V7

Three tabs plus a **secure, server-side AI coach**.

## What's new in V7
- The AI Coach no longer needs an API key in the browser.
- A Vercel serverless function (`/api/coach`) holds the key server-side.
- Works on any device and can be shared with assistant coaches.
- Optional team password (`COACH_SHARED_SECRET`) to gate access.
- The built-in offline engine is still available as a fallback.

## Tabs
1. **Replay Review** – load video / screen capture, comment while watching, click a timestamp to jump back.
2. **Match Day Intelligence** – live quarter clock, live mic transcription, audio backup, auto player detection.
3. **Season Dashboard** – per-game Rose/Bud/Thorn, theme trend chart across games, recurring improvement themes, and the AI Coach.

## Deploy to Vercel (step by step)

1. Upload ALL files (including the `api` folder) to a GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo.
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add your AI key in **Vercel → Project → Settings → Environment Variables**:
   - For ChatGPT: `OPENAI_API_KEY = sk-...`
   - or for Claude: `ANTHROPIC_API_KEY = sk-ant-...`
   - (optional) `AI_PROVIDER = openai` or `anthropic`
   - (optional) `COACH_SHARED_SECRET = our-team-password`
4. **Redeploy** so the new environment variables take effect.
5. Open the site → **Season Dashboard** → **Test endpoint**.
   - You should see `OK - endpoint reachable`.
6. Click **Generate AI coaching summary**.

## How the secure flow works
```
Browser (your app)
   |  POST /api/coach   { payload: notes }
   v
Vercel Serverless Function  (api/coach.js)
   |  adds OPENAI_API_KEY / ANTHROPIC_API_KEY from env
   v
OpenAI or Anthropic  ->  returns coaching summary
   ^
   |  { provider, summary }
Browser displays the summary
```
The key never leaves the server. The browser only ever sees the finished summary.

## Local development
`npm run dev` runs the front end, but `/api/coach` only exists on Vercel.
To test the function locally, install the Vercel CLI and run `vercel dev`.
On plain localhost the app will simply fall back to the built-in engine.

## Environment variables
See `.env.example`. Set these in Vercel, not in the repo. Never commit real keys.

## Files
```
api/coach.js        Secure serverless AI proxy
src/App.jsx         The app (3 tabs + AI panel)
src/main.jsx        React entry
src/styles.css      Styles
index.html          HTML shell
vercel.json         Vercel build config
vite.config.js      Vite config
.env.example        Env var template
```

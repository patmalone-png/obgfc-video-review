# OBGFC Match Day Intelligence V4

Live match-day microphone app for Old Brighton Women.

## V4 additions

- Auto player detection from speech: "number 12", "player 8", "#21"
- Auto scope detection for opposition language
- Clip markers and clip list
- Live quarter clock with +/-10 second controls
- Rose / Bud / Thorn summary
- Top 5 coaching actions
- Opposition scout report
- Player mention summary
- Season snapshot memory in local browser storage
- Import / export JSON season data
- Word export via .doc file
- CSV, Markdown, PDF and audio backup exports

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Upload all files to GitHub, then import the repo into Vercel.

Recommended Vercel settings:

- Framework: Vite
- Build command: npm run build
- Output directory: dist

## Match-day notes

Use Chrome or Edge for speech recognition. Keep the phone screen unlocked while recording live transcription. Start audio backup as a safety net. Export JSON after each game to preserve the season database outside the browser.

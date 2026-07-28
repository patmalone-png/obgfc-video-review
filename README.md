# OBGFC Coaching Intelligence V8

## New in V8: Gemini STOP5 Review (Replay tab)
A button in the Replay Review tab sends your verbatim commentary to Gemini and returns a
structured debrief using the STOP5 model:
- Situation
- Things that are working
- Opportunities to improve
- Points of action

It interprets the raw spoken verbatims (fragmented phrases are fine), and you can Copy or Export to Word.

## Serverless function
`api/coach.js` now accepts a `mode` field:
- `mode: "default"` -> standard coaching summary
- `mode: "stop5"`   -> STOP5 structured debrief

Both run through the same secure endpoint. Set GEMINI_API_KEY (free) in Vercel.

## Env vars (Vercel -> Settings -> Environment Variables)
- GEMINI_API_KEY = your free Google AI Studio key
- AI_PROVIDER = google
- GEMINI_MODEL = gemini-3.5-flash   (update when Google releases a newer Flash)
- COACH_SHARED_SECRET = optional team password

## Deploy
Upload all files (including the api folder) to GitHub -> import to Vercel -> redeploy.

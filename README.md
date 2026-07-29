# OBGFC Coaching Intelligence V11

## New in V11: Committee Pack (one-click weekly report)
A new tab assembles a professional, printable Match Committee Pack:
- Coach's AI summary (new "pack" AI mode)
- Last game STOP5 debrief
- Ladder table (highlights the Old Brighton row)
- Season theme trend table
- Next opponent scout report + game plan
- Optional pre-match player preview

Export to PDF (print) or Word, ready to email the committee.

Tabs: Replay · Match Day · Opposition Scout · Fixtures & Ladder · Season Dashboard · Committee Pack

## AI modes (api/coach.js): default, stop5, scout, preview, pack
## PlayHQ (api/playhq.js): manual today, live when PLAYHQ_API_KEY is set

## Env vars (Vercel)
GEMINI_API_KEY, AI_PROVIDER=google, GEMINI_MODEL=gemini-3.5-flash
PLAYHQ_API_KEY, PLAYHQ_ORG_ID, PLAYHQ_TENANT=afl
COACH_SHARED_SECRET (optional)

## Deploy
Upload all files (including api/) to GitHub -> import to Vercel -> redeploy.

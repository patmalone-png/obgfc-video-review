# OBGFC Video Commentary Coach Notes

A GitHub-ready React/Vite app for reviewing Old Brighton Women's Team and opposition footage.

## What it does

- Upload match video or capture a screen/window.
- Speak commentary while the video plays.
- Converts final speech phrases into timestamped notes.
- Interprets notes into coaching themes and improve/reinforce/observe tags.
- Exports Markdown, CSV, and JSON.
- Stores notes locally in the browser using localStorage.

## Run locally

```bash
npm install
npm run dev
```

## Build for GitHub Pages

```bash
npm run build
```

Upload the `dist` folder to GitHub Pages or configure a GitHub Actions workflow to publish it.

## Browser notes

- Speech recognition support varies by browser. Chrome/Edge are recommended.
- Screen capture requires permission and must be triggered by the Capture screen button.
- Video and notes stay local unless you export them.

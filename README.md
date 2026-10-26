# MCCS Installation Assistant

AI chat assistant widget for MCCS installation websites, shown on a high-fidelity demo recreation of
quantico.usmc-mccs.org. Built at the NPS hackathon. See `CLAUDE.md` for the brief and design decisions.

**This is a prototype demo, not the official MCCS site.**

## Run locally

Requires Node 22.18 or newer.

```bash
npm install
cp .env.example .env.local   # then add your Anthropic API key (and optionally DEMO_ACCESS_CODE)
npm run dev
```

Open http://localhost:3000. If `DEMO_ACCESS_CODE` is set you'll be asked for it once.

## Content

- `data/site/quantico/pages/` — one JSON file per page of the real site, captured with WebFetch.
- `npm run build:content` — regenerates the assistant's knowledge (`data/content/quantico.json`) from it.
- `node scripts/extract-theme.mjs` — regenerates the site theme from `design/reference/`.

## Try it on the live Quantico site

Open `/bookmarklet.html` on the demo server, drag the button to your bookmarks bar, then click it while
on https://quantico.usmc-mccs.org (Chrome or Firefox). It adds the widget to your tab only.

## Embed on another site

```html
<script src="https://<this-app-host>/widget.js" data-installation="quantico" defer></script>
```

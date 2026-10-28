# MCCS Installation Assistant

AI chat assistant widget for MCCS installation websites, shown on a high-fidelity demo recreation of
quantico.usmc-mccs.org. Built at the NPS hackathon. See `CLAUDE.md` for the brief and design decisions.

**This is a prototype demo, not the official MCCS site.**

## Run locally

Requires Node 22.18 or newer.

```bash
npm install
cp .env.example .env.local   # then add your Anthropic API key
npm run dev
```

Open http://localhost:3000.

## Open demo

The demo is open for hackathon judging: every page and API route works with no access code, and
`/access` redirects to `/`. The access-code gate is switched off in code (`ACCESS_GATE_ENABLED = false`
in `lib/access.ts`), whatever `DEMO_ACCESS_CODE` is set to; set it to `true` to require the code again.
Per-visitor rate limits (150 chat messages and 30 warm-ups per hour) and noindex stay on.

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

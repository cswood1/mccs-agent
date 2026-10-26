# MCCS Installation Assistant

AI chat assistant widget for MCCS installation websites. Built at the NPS hackathon.
See `CLAUDE.md` for the project brief and design decisions.

## Run locally

Requires Node 22.18 or newer.

```bash
npm install
cp .env.example .env.local   # then paste your Anthropic API key into .env.local
npm run dev
```

Open http://localhost:3000 and tap **Ask me anything** in the bottom-right corner.
It answers from a 71-page snapshot of quantico.usmc-mccs.org (`data/content/quantico.json`) and can
fetch live pages from the site when it needs current details.

## Try it on the live Quantico site

Open http://localhost:3000/bookmarklet.html, drag the button to your bookmarks bar, then click it while
on https://quantico.usmc-mccs.org (Chrome or Firefox). It adds the widget to your tab only.

## Alternative content source

Pages saved from a browser into `data/raw/quantico/` can be converted with `npm run convert -- quantico`.
This overwrites `data/content/quantico.json`.

## Embed on another site

```html
<script src="https://<this-app-host>/widget.js" data-installation="quantico" defer></script>
```

`/embed-test.html` shows the widget on a plain HTML page with nothing else loaded.

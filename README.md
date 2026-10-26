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
Out of the box it answers from **sample (fake) data**; a yellow banner in the panel says so.

## Add real pages

1. Save pages from https://quantico.usmc-mccs.org in your browser (File > Save Page As...) into
   `data/raw/quantico/`.
2. `npm run convert -- quantico`
3. Restart `npm run dev`. The sample banner disappears once `data/content/quantico.json` exists.

## Embed on another site

```html
<script src="https://<this-app-host>/widget.js" data-installation="quantico" defer></script>
```

`/embed-test.html` shows the widget on a plain HTML page with nothing else loaded.

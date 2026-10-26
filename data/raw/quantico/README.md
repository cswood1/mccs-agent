# Saved Quantico pages go here

1. Open a page on https://quantico.usmc-mccs.org in your normal browser.
2. File > Save Page As... > "Webpage, HTML Only" (or "Webpage, Complete"; only the .html file is read).
3. Save it into this folder with a descriptive name, e.g. `fitness.html`.
4. Run `npm run convert -- quantico` from the repo root.

The source URL for citations comes from the page itself (canonical link, og:url, or the
browser's "saved from url" comment). If the script says it can't find one, add it to
`urls.json` in this folder: `{ "fitness.html": "https://quantico.usmc-mccs.org/..." }`.

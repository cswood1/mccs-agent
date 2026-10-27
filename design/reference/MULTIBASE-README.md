# Pendleton and Lejeune captures (2026-10-27)

Captured once each from a normal browser session, for design reference and the page list.

- `pendleton/page-home.json`, `lejeune/page-home.json`:
  - the rendered homepage DOM (header, MENU drawer, carousel, tiles, important links, footer)
  - `svgAssets`
  - `internalLinks` (every same-site link on the page, menu included)
- `*/urls-to-fetch.json`: those internal links minus news stories, privacy, files and media. This is the crawl list:
  - Pendleton: 114 pages
  - Lejeune–New River: 122 pages
- Same CMS theme as Quantico (`/CMS_Themes/MCCS/`). Reuse the existing templates and CSS; only the
  homepage fragments (carousel, tiles, important links, logo or base name) and the menu differ.
- Lejeune's site is lejeunenewriver.usmc-mccs.org ("MCCS Lejeune-New River").

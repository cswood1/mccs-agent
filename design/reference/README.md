# Design reference: quantico.usmc-mccs.org (captured 2026-10-26)

Captured from a normal browser session (one visit per page) for design reference only.
Content for the agent still comes from WebFetch (data/content/quantico.json).

Each page-*.json holds the fully rendered DOM (after JavaScript, scripts removed) of one page type:

| File | Page | Template |
|---|---|---|
| page-home.json | / | Home page |
| page-section-recreation-fitness.json | /recreation-fitness | Section landing |
| page-program-fitness.json | /recreation-fitness/fitness | Program page |
| page-facility-inns-of-the-corps.json | /lodging/inns-of-the-corps | Facility page |

page-home.json also has `css`: the site's own stylesheets (tokens.css, all3.css, mccs-style.css,
bootstrap-icons, inline styles). Bootstrap itself is the stock **Bootstrap 5.3.2**: use the npm package.
`svgAssets` holds the inline SVG files (MCCS logo etc.) keyed by their original URL.

## Key findings
- The CMS theme lives at `/CMS_Themes/MCCS/` and is shared by every MCCS installation site. One
  recreated theme plus per-installation content therefore covers all installations.
- Fonts: **Noto Sans** (body), **Ubuntu** (headings, ~45px bold h2). Both are on Google Fonts.
- Most-used colors: blue `rgb(26,81,164)` (#1A51A4, links/accents), text `rgb(33,37,41)` (#212529),
  light gray `#F8F9FA`, border `#DEE2E6`, dark `rgb(24,34,45)` (#18222D), scarlet `rgb(166,25,46)` (#A6192E),
  navy `rgb(12,35,64)` (#0C2340).
- Photos are not captured (only their URLs inside the HTML). Use placeholders or decide on hotlinking.
- Ignore the yellow "COPY" button in the HTML if present; it was a capture helper.

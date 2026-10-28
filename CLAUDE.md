# MCCS Installation Assistant — Hackathon Project (NPS)

## What we're building
An AI chat assistant embedded on Marine Corps Community Services (MCCS) installation websites
(e.g. https://quantico.usmc-mccs.org/, Camp Pendleton, etc.).

- **UI:** an embeddable widget — an "Ask MCCS" launcher button that opens a right-side pop-out panel
  with an "Ask me anything…" chat input (naming and AI signal: docs/PRODUCT.md §13). It must drop onto an existing site with a single `<script>` tag.
- **Knowledge:** everything on that installation's MCCS site — facilities, hours, locations, events,
  programs (fitness, child & youth, education, family readiness, MWR, dining, lodging, etc.).
- **Template + instance:** one shared agent "template" (behavior, tone, tools, guardrails), configured
  per installation (site URL, name, local context). Same code, different installation config.
- **Fresh data:** answers must reflect what's currently on the site (hours, events change often).

## Mental model from MCCS reps
Each MCCS site is like a college campus or a Disney park: many kinds of visitors with very different
needs, some things common across all installations, some unique to one base and its local area.

## Example queries (use as test cases)
- Simple: "Where are the gyms and what are their hours?"
- Complex: "I'm trying to figure out if I'm eligible for tuition assistance, and I need to get my
  Joint Services Transcript — can you help?" (multi-step, may point to resources beyond the site)

## Principles
- Cite sources: link to the MCCS page an answer came from.
- Don't invent hours, phone numbers, or eligibility rules — say when it's unsure and link the page.
- Mobile-friendly; most users will be on phones.

## Demo host site (decided 2026-10-26)
The app is a high-fidelity recreation of MCCS installation sites with the assistant on every page,
deployed on Vercel for demos. Three bases have full content: Quantico (`/quantico`), Camp Pendleton
(`/pendleton`) and Camp Lejeune–New River (`/lejeune`, site lejeunenewriver.usmc-mccs.org).

- **Theme from a browser capture.** `design/reference/` holds the real rendered HTML of four Quantico
  page templates plus the site's own CSS and logo, and the home page of Pendleton and Lejeune
  (`design/reference/<base>/page-home.json`, with `urls-to-fetch.json`, their crawl list; see
  `MULTIBASE-README.md`), captured once from a normal browser. `node scripts/extract-theme.mjs` turns
  them into `site/fragments/<slug>/*.html` per base (header with its own MENU drawer, search modal,
  footer, `home-top` = everything above "Stay Informed" since each base arranges carousels/hero/tiles/ads
  differently, `home-important-links`) and `public/theme/` (site CSS, Bootstrap 5.3.2 + Bootstrap Icons
  1.7.2 from npm, logo). The MCCS CMS theme is shared by every installation; bases without a capture
  fall back to Quantico's fragments. `SLUG_FOR_HOST` in that script maps hostnames to app slugs
  (lejeunenewriver → `lejeune`; old `/lejeunenewriver/...` URLs 308 to `/lejeune/...` in `proxy.ts`).
- **Content from WebFetch only.** `data/site/<base>/pages/*.json` holds one structured file per page
  (title, breadcrumb, sections, cards, contacts with hours/phones/emails, links, images), captured with
  Claude Code's WebFetch tool. Never use curl, custom headers, headless browsers, or anything else that
  tries to get around the site's Akamai bot protection. Headless screenshot tests must block every
  request to *.usmc-mccs.org.
- **One source for site and agent.** `npm run build:content -- <base>` generates `data/content/<base>.json`
  (the agent's knowledge) from the same page files: program/facility/section/event pages in full, news
  stories as title + link + excerpt (the agent can web_fetch the full story).
- **Templates** (`app/(site)/templates.tsx`): section landing, program/facility detail (side nav, header
  card, "On this page", body, cards, contact + hours card), story/event article, and story/event
  listings for `/stories` and `/calendar-of-events` (dynamic on the real site, rebuilt from captured
  pages). Side nav comes from the MENU drawer markup. Unknown paths render a "not part of the demo" page
  linking to the real one. Photos are hotlinked from the real site (they load in a normal browser),
  with a neutral placeholder fallback (`<Photo>` and `app/(site)/site-enhancements.tsx`).
- **Safeguards.** Yellow "NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo" banner on every page
  (Black Ops One, all caps; short version under 640px), footer's
  "Official U.S. Marine Corps Website" line replaced, noindex (meta tag, X-Robots-Tag header,
  robots.txt).
- **Access code.** `proxy.ts` gates every page and API route when `DEMO_ACCESS_CODE` is set (unset =
  public). The `/access` page sets a hashed cookie for a year; the widget can also send the code in an
  `X-Demo-Access` header (used by the bookmarklet on the live site). Never commit the code.
- **Presenter mode.** When `PRESENTER_CODE` is set, entering it on `/access` grants access (like the
  demo code) and sets an httpOnly `mccs_presenter` cookie (a salted hash of the code, 30 days).
  Requests with a valid presenter cookie skip both rate limits. The regular code keeps normal limits;
  unset = no presenter mode. Never log or commit the code. Checked by `npm run test:unit`
  (`tests/unit/limits-check.mjs`: the real modules with stubbed requests, no server or Claude calls).
- **Widget on the demo site.** `data-site-host="quantico.usmc-mccs.org"` makes links to the real site in
  answers open the local page in the same tab; chat history and open state persist across navigation
  (sessionStorage). The header search box opens the assistant.
- **Live lookups.** The chat agent also has `web_fetch_20260318` / `web_search_20260318`, limited to the
  installation's `trustedDomains`; the snapshot lives in the first user turn so its URLs are fetchable.
- **No embeddings / vector search / RAG.** The whole content file goes in the (cached) prompt.

## API budget rules (follow these; tightened 2026-10-27, frugal mode)
Every chat call reads a ~200K-token cached prompt per base, so calls add up fast.
- **No live Claude API calls without the user's OK.** That covers chat or eval runs, warm-ups against a
  local server with a real key, and chips batches. The free token-counting endpoint is fine.
  Before asking, give the number of calls and an estimated cost.
- **One cache rewrite per base per release.** The cached prefix is the tools, the system prompt and
  each base's content block, so any change to them rewrites every affected base's cache (~200K
  tokens at the 1-hour cache-write price). Batch all prompt, tool and content changes into a single
  release (one push) instead of shipping them one at a time.
- **While iterating, test at most 3–5 questions on one base** (`npm run eval -- <label> --only id1,id2`).
- **Full eval only at milestones, and only when the user asks.**
- **After any paid run, report actual usage and approximate cost**, using the dev-server `[chat]`
  log lines or the batch result. Assume Sonnet 5.5 pricing: ~$2/M input, $4/M 1-hour cache write,
  $0.10/M cache read, $10/M output.
- **Test UI behavior with stubbed responses** (Playwright route mocks for `/api/chat`, `/api/warm`),
  not live calls. Headless tests must also block every request to *.usmc-mccs.org.
- **One-time batch jobs** (e.g. generating chips) use Claude Haiku 4.5 through the Message Batches API,
  with results cached on disk so re-runs only process what changed.
- **Content changes are checked offline:** `node scripts/check-content-facts.mjs <before> <after>`
  must report no missing phone numbers, time ranges or dollar amounts.
- **Production is rate limited per visitor** (`lib/ratelimit.ts`):
  - `RATE_LIMIT_CHAT_PER_HOUR` chat messages (default 150) and `RATE_LIMIT_WARM_PER_HOUR` warm-ups
    (default 30) per hour.
  - Presenter-mode visitors skip both (see Access code).
  - The limit message reads "You’ve asked a lot of questions this hour. Try again in a few minutes."
  - Run evals against the local dev server, not production.

## Product spec
`docs/PRODUCT.md` is the source of truth for how the assistant behaves (answer style, page awareness,
chips, sensitive moments, out of scope, quality bar, demo script, roadmap). Where code or this file
disagrees with it, ask before changing either.

## Agent implementation notes (round 2, 2026-10-26)
- **Answer style** follows PRODUCT.md section 4, 7 and 8 in `lib/prompt.ts`. The model follows the
  length rule much better when it's restated right before it answers, so the per-turn system note in
  `app/api/chat/route.ts` (`REPLY_REMINDER`, after the cached prefix) repeats it with today's date.
  The prompt's style example uses placeholders — the template is shared by every installation.
- **Content size** (`scripts/build-content.mjs`): pages over 40K chars (the Marine for Life Cycle
  checklists) are cut to each section's opening, paragraphs repeated across pages are kept once,
  `/privacy` is skipped. Content diet (2026-10-27):
  - Descriptive lines keep their first sentence plus every sentence with a number, price, contact,
    link, eligibility or how-to wording.
  - Hours rows with the same time are merged across days, and repeated contact blocks become pointers.
  - Links to pages already in the content lose their url; navigation-only "Related pages", images
    and capture notes are dropped.
  - News is title only, plus the summary when it has a number.
  - `scripts/check-content-facts.mjs` confirmed every phone number, time range and dollar amount kept.
  - Prefix tokens (free count endpoint): Quantico 253K → 208K, Pendleton 278K → 222K,
    Lejeune 256K → 205K. Going further means dropping descriptions or whole page bodies; the user chose
    to stop here.
- **Caching:** the prefix (tools, system prompt, content block) has no per-user data, so every
  visitor's conversation shares one cache entry (verified: different questions read the same ~252K
  cached tokens). The content breakpoint uses the 1-hour TTL; the conversation tail uses the default
  5 minutes. `lib/agent.ts` holds the request settings shared by chat and warm-up.
- **Pre-warming:** the widget calls `POST /api/warm` when the chat panel opens (at most once per browser
  per 50 min; the server also throttles). It sends the same prefix with `max_tokens: 0`, so the cache is
  written while the person types.
- **Eval:** `tests/eval/questions.json` (25 questions across personas, out-of-scope and sensitive cases,
  each with mechanical checks). `npm run eval -- <label> [baseUrl]` runs them and scores correct /
  sourced / concise / safe (`scripts/eval/score.mjs`, PRODUCT.md section 9); tone and page awareness
  are judged by reading. `npm run eval:compare -- before after` writes a side-by-side report
  (`tests/eval/results/before-vs-after.md`). Time to first text varies run to run, mostly API-side;
  compare medians, not single runs. Not yet covered: page-dependent questions (round 3).

## Page awareness and chips (round 3, 2026-10-26)
- **Page context:** the widget sends the current page (URL, title, breadcrumb) and the last 5 pages
  this session (sessionStorage). `buildPageNote` in `app/api/chat/route.ts` resolves titles from our own
  page data by path (`lib/site/context.ts`; browser text only for unknown pages, cleaned) and puts a
  `<page_context>` block in the latest user turn, after the cached prefix. The per-turn system note has
  the date and Eastern time, so "open right now?" works.
- **Follow-ups:** the model ends each reply with `<followups>[…]</followups>`; the route strips it from
  the stream (`FollowupSplitter`) and sends `\u001e{"followups":[…]}` after the text. The widget shows
  them as chips until the visitor navigates.
- **Chips:** `scripts/chips/generate.mjs` (Haiku 4.5 + Message Batches; `--dry-run` / `--submit` /
  `--collect`) writes 3–4 chips into each page file, keyed by a hash of the page text, and keeps raw
  model output in `data/site/<base>/chips-raw.json` (`--installation <base>`, default quantico). Quantico:
  404 of 439 pages have chips; Pendleton 131/133; Lejeune 118/119. The rest fall back
  to the nearest section page, then the installation's `defaultChips`.
  `GET /api/installations/:id/page?path=` returns title, breadcrumb, chips and the welcome line.
- **Widget:** "Viewing: <page>" line, page-specific welcome, chips bar, nudge bubble after 20 s on
  non-home pages (once per session; `nudge` in the installation config), tap-to-call and map links.
- **Tests:** `npm run test:ui` runs 22 browser checks against stubbed APIs (no Claude calls).
  The eval has 33 questions; 8 are page-dependent (`page`, optional `trail`) and scored "context".

## Cross-installation questions (docs/PRODUCT.md §12, 2026-10-27)
- Each conversation still caches only its own base's content. For another covered base
  (`COVERED_INSTALLATIONS` in `lib/crossbase.ts`), the agent calls the `other_installation_pages` tool
  (`installation`, `query`); the chat route runs it locally (keyword search over that base's
  `data/content/<id>.json`, news excluded) and returns the top 4 pages, each capped at 3,500 chars.
  The system prompt names the other covered bases. Answers cite the other base's real-site URLs; the
  widget maps any `<sub>.usmc-mccs.org` link to `/<slug>/...` (with `lejeunenewriver` → `lejeune`).
- Eval questions can set `installation` (default quantico); the three `xbase-*` questions cover
  Quantico→Pendleton PCS, Pendleton→Lejeune child care, and Lejeune→Quantico lodging.

## Explore your Marine Community (/) and front doors (/ask/<base>) (2026-10-28)
- **`/` is the globe page** (`app/(front)/page.tsx`, `explore.tsx`, `globe.tsx`).
  - Layout: headline, an "or choose:" list of the three bases (the keyboard, screen-reader, phone and
    no-WebGL path; "Last visited" is marked and focused), and a globe.gl globe, loaded with a dynamic
    import, client only.
  - Land: dotted land from `public/globe/countries.geojson`, built from world-atlas by
    `node scripts/build-globe-data.mjs`. That script drops a degenerate North Korea speck that made
    H3 throw.
  - Look and motion: grayscale palette per theme. Idle spin, then it settles on the US; drag with
    inertia, limited zoom, `touch-action: pan-y` on phones.
  - Markers: one per MCCS site in `site/installations.json` (22), at each main base location
    (`GLOBE_PLACES` in `data.ts`), all with the same red dot, pulse and label pill.
    - Only Quantico, Camp Pendleton and Camp Lejeune are clickable buttons. The rest are hover-only,
      with the default cursor and out of the tab order.
    - A per-frame pass in `globe.tsx` keeps labels from overlapping: the clickable bases always show,
      flipping sides to stay on screen and off other dots. Other labels try both sides of their dot,
      then hide until hovered or zoomed in.
    - Hovering a spot shows all labels there, stacked. Western Recruiting Region shares MCRD San
      Diego's spot.
  - Laptops (≥60em wide): the page fits one viewport under the banner (`body:has(.fd--explore)`), with
    no page scroll; the headline scales with the viewport height. Phones scroll.
  - Picking: warms the base, saves it as last visited, flies in (~1 s), then a full navigation to
    `/ask/<base>`. A cross-document view transition crossfades where supported; a head script in
    `app/layout.tsx` swallows aborted transitions. With reduced motion it navigates at once.
  - Test hook: `window.__mccsGlobe`.
- **`/ask/[installation]` is each base's front door** (`ask/[installation]/page.tsx` → `front-door.tsx`).
  - The URL decides the base; unknown bases 307 to `/` in `proxy.ts`.
  - Top-left globe pill (shortName) links back to `/`.
  - Installation cards link to the other bases' `/ask/<base>` and every base's full site.
  - Conversations are kept per base per tab (`mccs-front:conversation:<id>`).
  - Arriving from the globe focuses the ask box.
  - Shared pieces: `display-menu.tsx`, `shared.ts` (warm-up, last visited, input type).
- Front door (`front-door.tsx`, scoped `front.css`):
  - **Hero:** installation pill, Display menu (Light/Dark, Large text, High contrast; saved in
    localStorage), ask box with rotating examples, mic and send, starter chips from `defaultChips`,
    5 "moment" cards, installation cards, trust strip.
  - **Asking:** the hero docks into a compact bar and the conversation shows as a reading column. It
    uses `/api/chat` with the page's base and page path `/`, with the same stream format as the widget
    (`lib/chat-client.ts` mirrors widget.js: markdown, tel/map links, status and follow-up frames).
  - **Trust line:** under each answer, from the first MCCS link and that page's `fetchedAt` (the page
    API now returns it).
  - **Speech:** Listen/Stop/Slow use speechSynthesis; the mic uses SpeechRecognition (hidden when
    unsupported), shows a live caption, auto-sends and reads the answer aloud.
  - **Conversation:** kept in sessionStorage per base per tab; "New conversation" clears it.
- Style follows `design/reference/home/style-hero.png` and `style-sections.png`:
  - Fraunces 800 headline, Plus Jakarta Sans body, white pill controls (Display is icon-only on phones).
  - Full-height hero photo with a rounded inner corner, swapping with the selected installation.
  - Small uppercase section labels and numbered "moment" cards.
- Photos (`public/home/*.webp`, 1600px wide, under 200KB) are Wikimedia Commons U.S. Marine Corps
  photos under PD-USGov templates: community scenes, facilities and landscapes. Excluded: named
  officials, close-up portraits, weapons and combat.
  - Credits are in `public/home/CREDITS.json`, shown on each image and listed on `/credits`.
  - `/home/*` and `/credits` are app paths in `proxy.ts`, still behind the access gate.
- Hero carousel: all seven front-door photos in an interleaved order (`CAROUSEL` in
  `app/(front)/photos.ts`, so neighbours differ in base and scene), 6.5 s each with a 0.8 s crossfade,
  whichever base is selected. Each photo's crop focus (`focus`, CSS object-position) is in
  `public/home/CREDITS.json`. Only the first hero is in the HTML; the rest load after the page's load
  event, and the carousel only advances to a loaded photo. Alt text and credit follow the shown photo. It pauses on a hidden tab, hover, keyboard
  focus in the photo, or the pause/play button. With reduced motion it shows the selected base's
  photo with no rotation.
- Ask box placeholder: the widget header search's typing effect at a calmer pace (50 ms/letter,
  3.25 s hold, 0.3 s erase, ~4.5 s per example; the widget keeps 35 ms / 2 s). It's cleared while focused or holding text, and static with reduced motion. The docked
  "Ask a follow-up…" stays static.
- Two sections: below the hero, the main area and footer use `--fd-bg-lower` (light #cfd7e0, dark
  #162030), edge to edge, with a straight boundary where the hero ends. Cards there use
  `--fd-card-lower` (white in light). High contrast adds a 2px divider (`--fd-divider`). All
  lower-section text passes WCAG AA, which is tested.
- Focus rings (front.css):
  - Inner select/textarea/text inputs never draw an outline. Their rounded container shows the
    `--fd-ring` box-shadow instead: the ask box on any focus, the installation pill for keyboard focus
    only. Keyboard-only uses `data-input` on `.fd`, set on keydown/pointerdown, because Chrome counts a
    clicked select as `:focus-visible`.
  - Every other control gets one 3px outline that follows its border radius.
  - High contrast uses a solid ring.
- Warm-up: `/api/warm` for the selected base on load and on selector change. It uses the widget's
  localStorage throttle key (`mccs-assistant:<id>:warmed`, 50 min), so the two share it.
- Tests: `tests/ui/front-door-check.mjs` (stubbed chat stream and speech APIs); `npm run test:ui` runs
  both suites.

## Header search: Ask MCCS (docs/PRODUCT.md §13, 2026-10-27)
- The widget enhances the site's own search box (`#main-search-input`, same CMS theme on every MCCS
  site; opt out with `data-header-search="0"`): sparkle instead of the magnifier, rotating example
  placeholder, combobox dropdown in the page's own DOM (`#mccs-ask-listbox`) so ARIA references work.
- Focus: the page's chips. Typing: "✦ Ask MCCS: '<query>'" first, then up to 5 instant page matches
  from `GET /api/installations/:id/pages` (titles and breadcrumbs, cached in sessionStorage; no AI
  calls). Enter / the Ask row opens the same panel and conversation with the question sent; page rows
  navigate in the same tab. Cmd/Ctrl+K focuses it. Phones: the header search icon becomes the sparkle
  and opens a search sheet (`#mccs-ask-sheet`) with the same behavior.

## Thinking phrase and status wording (2026-10-28)
- Until the answer starts, the widget and the front door show "Hooking and jabbing, be right back…"
  instead of typing dots, on every message. It's italic and muted with a shimmer (static with reduced
  motion), role="status", replaced by a tool status, cleared on the first text, and never saved. It
  lives in `THINKING` in `public/widget.js` and `lib/chat-client.ts`; keep the two lists in step
  (`tests/unit/thinking-status-check.mjs` checks).
- Tool status wording: "Checking Camp Pendleton…" (fallback "Checking another installation…",
  `lib/crossbase.ts`), "Checking the latest MCCS info…" (web_fetch), "Searching for the latest MCCS
  info…" (web_search) (`SERVER_TOOL_STATUS` in `app/api/chat/route.ts`).

## Widget window and bottom area (2026-10-28)
- ≥ 768px: a floating window flush right, 24px below the demo banner (its height is reserved when
  `.demo-banner` exists) and 24px above the bottom, max 960px tall and centered, left corners rounded
  18px. Phones: a sheet with rounded top corners and a 10px top gap. The header is about 72px.
- Suggested questions (starter chips, then the latest answer's follow-ups) sit in the conversation
  under the latest message with a small "Suggested" label, outside the `.thread` live region.
- Composer: one field with the send button inside; placeholder "Ask MCCS anything…", then
  "Ask a follow-up…" (docs/PRODUCT.md §13).
- Open/minimize motion (`animateOpen` / `animateClose` in `public/widget.js`, Web Animations):
  - Open: the window grows out of the control that opened it (transform-origin at its center):
    scale 0.85 → 1, a fade and a 24px slide, 360ms with a spring that overshoots a little
    (`SPRING`). Then the header, conversation and composer rise 10px, 50ms apart.
  - Minimize: 240ms back down to 0.85 toward the edge tab. The tab pops in (0.75 → 1.09 → 1) with a
    bright sparkle glint (flash and rotation). It's shown and focused at once, and invisible until
    then (`fill: backwards`).
  - Phones: the sheet slides up and down (280ms, same spring). Reduced motion: 150ms opacity fades
    only.
  - A click mid-animation starts the next one from the window's current opacity and transform.
    The final state never depends on an animation finishing.
  - Header sparkle (`playSpark` / `sparkWaiting` / `stopSpark`): a bounce with a glint
    (1 → 1.3 → 0.95 → 1, 500ms) right after the window settles. On send, a bounce-and-shake
    (±12° twice, 600ms), then a softer repeat every 1.5 s while waiting. It stops on the first
    answer text, an error, the end of the reply or minimize. Only one animation runs at a time, and
    there are none with reduced motion.
  - Hover sparkle (`hoverSparkle`, the same `animateSparkle` helper): the header's open bounce on the
    launcher, edge tab and header search sparkles (desktop box and phone icon). It plays once per
    mouse or pen entry or keyboard focus, and never stacks. Not for touch or reduced motion.
  - Tests wait with `settle()` in `tests/ui/widget-check.mjs`.

## Stack
- Next.js 16 (App Router, TypeScript), Bootstrap 5.3.2 + the captured MCCS CSS (no Tailwind). Next 16
  differs from older versions — see `AGENTS.md` and `node_modules/next/dist/docs/`. Middleware is
  `proxy.ts` in Next 16.
- Claude API via `@anthropic-ai/sdk`. Model `claude-opus-5` by default (override with `CLAUDE_MODEL`),
  effort `low` (override with `CLAUDE_EFFORT`), streaming, server-side refusal fallbacks on.
- Widget is plain JS in `public/widget.js` (Shadow DOM, no build step), served by the same app.
- Deployed on Vercel (`vercel` CLI). Env vars there: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`,
  `DEMO_ACCESS_CODE`, `PRESENTER_CODE`, `RATE_LIMIT_CHAT_PER_HOUR`, `RATE_LIMIT_WARM_PER_HOUR` (the
  last three optional; see `.env.example`).

## Layout
- **Multiple installations (docs/PRODUCT.md §12):** every site in the real location picker
  (`site/installations.json`, generated by `scripts/extract-theme.mjs`) is served at `/<slug>/...`.
  `/` is the globe page and `/ask/<base>` the front doors (below); old un-prefixed Quantico URLs 308-redirect to `/quantico/...` (`proxy.ts`).
  Installations with captured content (`data/site/<slug>/pages/home.json`) get the full site; others get
  a themed "coming soon" page. The assistant widget appears where `installations/<slug>.json` exists
  (Quantico, Pendleton, Lejeune); chat and warm-up return a friendly "not loaded yet" for installations without
  content, before any Claude call.
- `app/(site)/[installation]/` — the recreated sites: `layout.tsx` (banner, captured header/footer
  rendered for the installation, Bootstrap JS, widget), `page.tsx` (home or coming soon),
  `[...slug]/page.tsx` (every other page). Shared pieces in `app/(site)/`: `templates.tsx` (incl.
  `ComingSoon`), `photo.tsx`, `raw.tsx`, `site-enhancements.tsx`. Redirects the real sites send
  (careers, alias pages) are mirrored per base in `next.config.ts`.
- `lib/site/data.ts` — per-installation page data, `installationHref`, `localHref` (any
  `<slug>.usmc-mccs.org` link → `/<slug>/...`), and `fragment(inst, name)`, which prefixes internal
  links, points the location picker at `/<slug>`, and labels the picker button. Paths inside page data
  and templates are site paths (`/lodging`); only rendered hrefs carry the prefix.
- `app/access/`, `app/api/access/`, `proxy.ts`, `lib/access.ts` — access-code gate.
- `app/api/chat/route.ts` — POST `{installationId, messages, page?, trail?}` → streams text, then the
  follow-ups frame. `lib/site/context.ts` strips the `/<slug>` prefix from page paths.
- `app/api/installations/[id]/route.ts` (config) and `.../page/route.ts` (title, chips, welcome).
- `app/bookmarklet.html/route.ts` + `site/bookmarklet.html` — bookmarklet for the live Quantico site.
- `lib/prompt.ts` — the shared agent template (system prompt + cached content block).
- `installations/<id>.json` — per-installation assistant config (Quantico, Pendleton, Lejeune; register
  new ones in `lib/installations.ts`).
- `scripts/extract-theme.mjs`, `scripts/build-content.mjs`, `scripts/chips/generate.mjs`.
- `public/embed-test.html` — plain-HTML embed check.

## Commands
- `npm run dev` — run locally (needs `ANTHROPIC_API_KEY`; set `DEMO_ACCESS_CODE` to test the gate)
- `npm run build:content -- <base>` — regenerate a base's content file from `data/site/<base>/pages`
  (default quantico)
- `node scripts/extract-theme.mjs` — regenerate theme fragments/CSS from `design/reference`
- `npm run eval -- <label> [--only id1,id2]` / `npm run eval:compare -- before after` — run and compare
  the test set (ask before running all of it; see API budget rules)
- `npm run test:ui` — stubbed browser checks of the widget
- `node --env-file=.env.local scripts/chips/generate.mjs --dry-run [--installation <base>]` — chip
  generation estimate (`--submit`, `--collect` after an OK)
- `npm run build`, `npm run lint`
- Deploys: pushing to `main` auto-deploys to production (Vercel GitHub integration, connected
  2026-10-26); `vercel deploy --prod` also works

## Status (2026-10-27)
- **Live demo:** https://mccs-agent.vercel.app (Vercel team `nps-hackathon-mccs-agent`, project
  `mccs-agent`). Access code is in Vercel's `DEMO_ACCESS_CODE` env var and the local `.env.local`.
- **Crawl:** 439 pages captured with WebFetch in three waves from the home page, menus, and every
  internal link found (85 program/section/facility/info pages, 53 events, 301 news stories). 39 pages
  have little or no body text on the real site itself (image-only stories, dynamic lists).
- **Pendleton and Lejeune crawl (2026-10-27):** one pass over each `urls-to-fetch.json` (news skipped)
  by six section-split WebFetch agents, plus facility/program sub-pages one level deeper (capped ~40 per
  base). Pendleton: 133 pages (26 extras, 8 redirects). Lejeune: 119 pages (1 extra, 5 redirects).
  Per-agent reports in `data/site/<base>/crawl/`. Known gaps: Lejeune's Marine for Life Cycle has 5 of
  9 checklist tabs (WebFetch length limit); a few long Pendleton FAQ/list sections may be condensed
  (noted in each page's `notCaptured`); event calendars, PDFs and embedded forms aren't captured.
- **Not captured (Quantico):** the event calendar and story lists (JavaScript; rebuilt from captured pages),
  57 older MCCS-wide news stories linked only from other stories (stopped after wave 3), the body
  composition PDF, and one story whose fetch returned only boilerplate. Pages that redirect off the
  site (careers, post offices, voting assistance, local area info) are mirrored as redirects.
- **Agent:** prompt tokens per base: Quantico ~208K, Pendleton ~222K, Lejeune ~205K. Each base has its
  own cache entry (1-hour TTL), shared by all of that base's visitors and warmed when the chat opens.
  Pendleton and Lejeune were checked with 3 questions each (gyms, child care, lodging), all correct
  and sourced; no full eval set for them yet. Round 3 full eval (33 questions, `tests/eval/results/round3.json`): correct 29/29, sourced
  33/33, safe 33/33, context 8/8, concise 27/33; median 67 words, 1.9 s to first text, 3.8 s total.
  After that run the per-turn reminder was tightened ("name the top two"); the 6 long answers re-checked
  4/6 within length (`r3-concise.json`), not yet confirmed with a full run.
- `/api/chat` and `/api/warm` are protected by the access code and, on production, a per-visitor rate
  limit (by default 150 chat messages and 30 warm-ups per hour; presenter mode skips it; see API budget
  rules).

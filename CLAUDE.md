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
The app is now a high-fidelity recreation of quantico.usmc-mccs.org with the assistant on every page,
deployed on Vercel for demos.

- **Theme from a browser capture.** `design/reference/` holds the real rendered HTML of four page
  templates plus the site's own CSS and logo, captured once from a normal browser.
  `node scripts/extract-theme.mjs` turns it into `site/fragments/quantico/*.html` (header, MENU drawer,
  search modal, footer, home carousel/tiles/important links) and `public/theme/` (site CSS, Bootstrap
  5.3.2 + Bootstrap Icons 1.7.2 from npm, logo). The MCCS CMS theme is shared by every installation.
- **Content from WebFetch only.** `data/site/quantico/pages/*.json` holds one structured file per page
  (title, breadcrumb, sections, cards, contacts with hours/phones/emails, links, images), captured with
  Claude Code's WebFetch tool. Never use curl, custom headers, headless browsers, or anything else that
  tries to get around the site's Akamai bot protection. Headless screenshot tests must block every
  request to *.usmc-mccs.org.
- **One source for site and agent.** `npm run build:content` generates `data/content/quantico.json`
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
- **Widget on the demo site.** `data-site-host="quantico.usmc-mccs.org"` makes links to the real site in
  answers open the local page in the same tab; chat history and open state persist across navigation
  (sessionStorage). The header search box opens the assistant.
- **Live lookups.** The chat agent also has `web_fetch_20260318` / `web_search_20260318`, limited to the
  installation's `trustedDomains`; the snapshot lives in the first user turn so its URLs are fetchable.
- **No embeddings / vector search / RAG.** The whole content file goes in the (cached) prompt.

## API budget rules (follow these; added 2026-10-26)
Every Claude API call here reads a ~250K-token prompt, so calls add up fast.
- **Never run the full eval without asking first.** While iterating, use 3–5 questions relevant to the
  change (`npm run eval -- <label> --only id1,id2,...`). Run the full set once, at the end of a round,
  after asking.
- **Before any step with more than ~10 API calls,** say the estimated number of calls and rough cost,
  and wait for an OK.
- **Test UI behavior with stubbed responses** (Playwright route mocks for `/api/chat`, `/api/warm`),
  not live calls. Headless tests must also block every request to *.usmc-mccs.org.
- **One-time batch jobs** (e.g. generating chips) use Claude Haiku 4.5 through the Message Batches API,
  with results cached on disk so re-runs only process what changed.
- **Prompt edits invalidate the shared cache** (one ~250K-token write, ~2× input price with the 1-hour
  TTL). Batch prompt changes together instead of making them one at a time.
- **Production is rate limited per visitor** (`lib/ratelimit.ts`): 20 chat messages and 6 warm-ups per
  hour. Run evals against the local dev server, not production.

## Product spec
`docs/PRODUCT.md` is the source of truth for how the assistant behaves (answer style, page awareness,
chips, sensitive moments, out of scope, quality bar, demo script, roadmap). Where code or this file
disagrees with it, ask before changing either.

## Agent implementation notes (round 2, 2026-10-26)
- **Answer style** follows PRODUCT.md section 4, 7 and 8 in `lib/prompt.ts`. The model follows the
  length rule much better when it's restated right before it answers, so the per-turn system note in
  `app/api/chat/route.ts` (`REPLY_REMINDER`, after the cached prefix) repeats it with today's date.
  The prompt's style example uses placeholders — the template is shared by every installation.
- **Content size** (`scripts/build-content.mjs`): news stories are title + one-line summary (the agent
  fetches full stories live), pages over 40K chars (the Marine for Life Cycle checklists) are cut to each
  section's opening, paragraphs repeated across pages are kept once, `/privacy` is skipped.
  ~247K prompt tokens (was ~318K).
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
  model output in `data/site/quantico/chips-raw.json`. 404 of 439 pages have chips; the rest fall back
  to the nearest section page, then the installation's `defaultChips`.
  `GET /api/installations/:id/page?path=` returns title, breadcrumb, chips and the welcome line.
- **Widget:** "Viewing: <page>" line, page-specific welcome, chips bar, nudge bubble after 20 s on
  non-home pages (once per session; `nudge` in the installation config), tap-to-call and map links.
- **Tests:** `npm run test:ui` runs 22 browser checks against stubbed APIs (no Claude calls).
  The eval has 33 questions; 8 are page-dependent (`page`, optional `trail`) and scored "context".

## Header search: Ask MCCS (docs/PRODUCT.md §13, 2026-10-27)
- The widget enhances the site's own search box (`#main-search-input`, same CMS theme on every MCCS
  site; opt out with `data-header-search="0"`): sparkle instead of the magnifier, rotating example
  placeholder, combobox dropdown in the page's own DOM (`#mccs-ask-listbox`) so ARIA references work.
- Focus: the page's chips. Typing: "✦ Ask MCCS: '<query>'" first, then up to 5 instant page matches
  from `GET /api/installations/:id/pages` (titles and breadcrumbs, cached in sessionStorage; no AI
  calls). Enter / the Ask row opens the same panel and conversation with the question sent; page rows
  navigate in the same tab. Cmd/Ctrl+K focuses it. Phones: the header search icon becomes the sparkle
  and opens a search sheet (`#mccs-ask-sheet`) with the same behavior.

## Stack
- Next.js 16 (App Router, TypeScript), Bootstrap 5.3.2 + the captured MCCS CSS (no Tailwind). Next 16
  differs from older versions — see `AGENTS.md` and `node_modules/next/dist/docs/`. Middleware is
  `proxy.ts` in Next 16.
- Claude API via `@anthropic-ai/sdk`. Model `claude-opus-5` by default (override with `CLAUDE_MODEL`),
  effort `low` (override with `CLAUDE_EFFORT`), streaming, server-side refusal fallbacks on.
- Widget is plain JS in `public/widget.js` (Shadow DOM, no build step), served by the same app.
- Deployed on Vercel (`vercel` CLI). Env vars there: `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`,
  `DEMO_ACCESS_CODE`.

## Layout
- **Multiple installations (docs/PRODUCT.md §12):** every site in the real location picker
  (`site/installations.json`, generated by `scripts/extract-theme.mjs`) is served at `/<slug>/...`.
  `/` goes to `/quantico`; old un-prefixed Quantico URLs 308-redirect to `/quantico/...` (`proxy.ts`).
  Installations with captured content (`data/site/<slug>/pages/home.json`) get the full site; others get
  a themed "coming soon" page. The assistant widget appears where `installations/<slug>.json` exists
  (Quantico, Pendleton); chat and warm-up return a friendly "not loaded yet" for installations without
  content, before any Claude call.
- `app/(site)/[installation]/` — the recreated sites: `layout.tsx` (banner, captured header/footer
  rendered for the installation, Bootstrap JS, widget), `page.tsx` (home or coming soon),
  `[...slug]/page.tsx` (every other page). Shared pieces in `app/(site)/`: `templates.tsx` (incl.
  `ComingSoon`), `photo.tsx`, `raw.tsx`, `site-enhancements.tsx`.
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
- `installations/<id>.json` — per-installation assistant config (Quantico; Pendleton has the basics).
- `scripts/extract-theme.mjs`, `scripts/build-content.mjs`, `scripts/chips/generate.mjs`.
- `public/embed-test.html` — plain-HTML embed check.

## Commands
- `npm run dev` — run locally (needs `ANTHROPIC_API_KEY`; set `DEMO_ACCESS_CODE` to test the gate)
- `npm run build:content` — regenerate the agent's content file from `data/site/quantico/pages`
- `node scripts/extract-theme.mjs` — regenerate theme fragments/CSS from `design/reference`
- `npm run eval -- <label> [--only id1,id2]` / `npm run eval:compare -- before after` — run and compare
  the test set (ask before running all of it; see API budget rules)
- `npm run test:ui` — stubbed browser checks of the widget
- `node --env-file=.env.local scripts/chips/generate.mjs --dry-run` — chip generation estimate
- `npm run build`, `npm run lint`
- Deploys: pushing to `main` auto-deploys to production (Vercel GitHub integration, connected
  2026-10-26); `vercel deploy --prod` also works

## Status (2026-10-26)
- **Live demo:** https://mccs-agent.vercel.app (Vercel team `nps-hackathon-mccs-agent`, project
  `mccs-agent`). Access code is in Vercel's `DEMO_ACCESS_CODE` env var and the local `.env.local`.
- **Crawl:** 439 pages captured with WebFetch in three waves from the home page, menus, and every
  internal link found (85 program/section/facility/info pages, 53 events, 301 news stories). 39 pages
  have little or no body text on the real site itself (image-only stories, dynamic lists).
- **Not captured:** the event calendar and story lists (JavaScript; rebuilt from captured pages),
  57 older MCCS-wide news stories linked only from other stories (stopped after wave 3), the body
  composition PDF, and one story whose fetch returned only boilerplate. Pages that redirect off the
  site (careers, post offices, voting assistance, local area info) are mirrored as redirects.
- **Agent:** ~250K prompt tokens, cached for an hour and shared by all visitors; warmed when the chat
  opens. Round 3 full eval (33 questions, `tests/eval/results/round3.json`): correct 29/29, sourced
  33/33, safe 33/33, context 8/8, concise 27/33; median 67 words, 1.9 s to first text, 3.8 s total.
  After that run the per-turn reminder was tightened ("name the top two"); the 6 long answers re-checked
  4/6 within length (`r3-concise.json`), not yet confirmed with a full run.
- `/api/chat` and `/api/warm` are protected by the access code and, on production, a per-visitor rate
  limit (20 chat messages and 6 warm-ups per hour; see API budget rules).

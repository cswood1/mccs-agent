# MCCS Installation Assistant — Hackathon Project (NPS)

## What we're building
An AI chat assistant embedded on Marine Corps Community Services (MCCS) installation websites
(e.g. https://quantico.usmc-mccs.org/, Camp Pendleton, etc.).

- **UI:** an embeddable widget — a launcher button that opens a right-side pop-out panel with an
  "Ask me anything..." chat input. It must drop onto an existing site with a single `<script>` tag.
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
- **Safeguards.** Yellow "Prototype demo — not the official MCCS site" banner on every page, footer's
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
- `app/(site)/` — the recreated site: `layout.tsx` (banner, captured header/footer, Bootstrap JS,
  widget), `page.tsx` (home), `[...slug]/page.tsx` (every other captured page), `templates.tsx`.
- `app/access/`, `app/api/access/`, `proxy.ts`, `lib/access.ts` — access-code gate.
- `app/api/chat/route.ts` — POST `{installationId, messages}` → streams plain text, with live web tools.
- `app/api/installations/[id]/route.ts` — public display config the widget fetches.
- `app/bookmarklet.html/route.ts` + `site/bookmarklet.html` — bookmarklet that injects this server's
  widget onto the live Quantico site (carries the access code).
- `lib/prompt.ts` — the shared agent template (system prompt + cached content block).
- `lib/site/` — page data loader, markdown renderer, nav tree from the MENU markup.
- `installations/<id>.json` — per-installation config (name, site URL, trusted domains, theme, ...).
- `scripts/extract-theme.mjs`, `scripts/build-content.mjs` — see above.
- `public/embed-test.html` — plain-HTML embed check.

## Commands
- `npm run dev` — run locally (needs `ANTHROPIC_API_KEY`; set `DEMO_ACCESS_CODE` to test the gate)
- `npm run build:content` — regenerate the agent's content file from `data/site/quantico/pages`
- `node scripts/extract-theme.mjs` — regenerate theme fragments/CSS from `design/reference`
- `npm run eval -- <label>` / `npm run eval:compare -- before after` — run and compare the test set
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
- **Agent:** ~247K prompt tokens, cached for an hour and shared by all visitors; warmed when the chat
  opens. Latest eval (25 questions): correct 21/21, sourced 25/25, concise 24/25, safe 25/25; median
  66 words, 1.7 s to first text, 3.3 s total.
- `/api/chat` has no rate limit; the access code is the only protection.

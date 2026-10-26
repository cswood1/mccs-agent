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

## Cost and speed notes
- First question in a conversation writes the content file (~180K tokens) to the prompt cache;
  follow-ups within 5 minutes read it back at ~10% of the price. A live fetch adds a few extra model
  passes, each re-reading the cache.

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
- `npm run build`, `npm run lint`
- `vercel deploy --prod` — deploy

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
- **Agent content:** ~318K tokens per new conversation (cache write); cached follow-ups are fast.
  Measured ~7–8 s to first token on a cold cache, ~5 s warm.
- `/api/chat` has no rate limit; the access code is the only protection.

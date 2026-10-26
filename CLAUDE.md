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

## Decision: how content gets in (prototype; updated 2026-10-26)
Current phase is early prototyping to figure out how the assistant should work, look, and feel.
Optimize for speed.

- **Preloaded snapshot.** `data/content/quantico.json` holds 71 pages of quantico.usmc-mccs.org
  (≈158K tokens), captured 2026-10-26 with Claude Code's **WebFetch** tool, starting from the home page
  and its main menus. Each page keeps its URL and fetch date. The whole file goes into the first user
  turn with a prompt-cache breakpoint (not the system prompt — see live lookups below).
- **No scripted crawling.** The site is behind Akamai bot protection that returns 403 to curl and
  similar clients. Do NOT use curl, custom headers, headless browsers, or anything else that tries to
  get around it. Refresh the snapshot only with WebFetch (or by saving pages from a normal browser and
  running `npm run convert -- quantico`, which overwrites the same file).
- **Snapshot caveats.** WebFetch returns a model-extracted rendition of each page, not raw HTML. It is
  mostly verbatim, but some pages came back lightly paraphrased, and a few details can be wrong (one
  capture had a phone number that didn't match the page's own tel: link). Spot-check hours and phone
  numbers before showing this to MCCS. Not captured: the events calendar (rendered by JavaScript), the
  Marine for Life Cycle page (WebFetch declined to reproduce it), the body composition PDF, and pages
  that redirect to quantico.marines.mil (post offices, voting assistance).
- **Live lookups.** The chat agent also has the API's server-side tools `web_fetch_20260318` and
  `web_search_20260318`, limited to the installation's `trustedDomains` (Quantico site plus jst.doded.mil,
  dantes.mil, militaryonesource.mil, militarychildcare.com, va.gov, marines.mil). It answers from the
  snapshot first and fetches a live page only for changeable details (today's hours, events). Anthropic's
  fetcher can reach the Quantico site (verified 2026-10-26). web_fetch can only open URLs that appeared in a
  user message or tool result, which is why the snapshot lives in the first user turn.
- **No embeddings / vector search / RAG.**
- **Sample data:** `data/sample/<installation>.json` is invented placeholder content, used only when no
  `data/content/<installation>.json` exists.
- Revisit later (not now): official feed or allowlisted crawler from MCCS, scheduled refresh,
  retrieval if content outgrows the prompt.

## Cost and speed notes
- First question in a conversation writes ~167K tokens to the prompt cache; follow-ups within 5 minutes
  read it back at ~10% of the price. A live fetch adds a few extra model passes, each re-reading the cache.
- Typical answers stream in 7–11 seconds.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind v4). Note: Next 16 differs from older versions — see
  `AGENTS.md` and the docs in `node_modules/next/dist/docs/`.
- Claude API via `@anthropic-ai/sdk`. Model `claude-opus-5` (override with `CLAUDE_MODEL`), effort `low`
  (override with `CLAUDE_EFFORT`), streaming, server-side refusal fallbacks on.
- Widget is plain JS in `public/widget.js` (Shadow DOM, no build step), served by the same app.

## Layout
- `installations/<id>.json` — per-installation config (name, site URL, local context, welcome message,
  suggested questions, theme colors, HTML selectors for the converter). Register new ones in
  `lib/installations.ts`.
- `lib/prompt.ts` — the shared agent template: system prompt plus the cached content block for the first
  user turn. Keep it deterministic so caching works; today's date goes in a trailing system message.
- `app/api/chat/route.ts` — POST `{installationId, messages}` → streams plain text. Adds the live web tools,
  resumes `pause_turn`, and logs token usage plus every fetch/search to the server console
  (also in `.next/dev/logs/next-development.log`).
- `app/api/installations/[id]/route.ts` — public display config the widget fetches.
- `public/widget.js` — the embed. `public/embed-test.html` — plain-HTML embed check.
- `public/bookmarklet.html` — bookmarklet that injects the local widget onto the live Quantico site
  (open http://localhost:3000/bookmarklet.html and drag the button to the bookmarks bar).
- `app/page.tsx` — mock installation homepage with the widget on it.
- `scripts/convert-html.mts` — saved HTML → `data/content/<id>.json`.

## Commands
- `npm run dev` — run locally (needs `ANTHROPIC_API_KEY` in `.env.local`)
- `npm run convert -- quantico` — rebuild Quantico content from `data/raw/quantico/`
- `npm run build`, `npm run lint`

## Status
Prototype runs end to end on the real Quantico snapshot, with live fetch. Both example queries answer
with correct, cited facts (verified against the snapshot 2026-10-26). Next: spot-check the snapshot,
try the bookmarklet on the live site, iterate on look and feel. `/api/chat` is open (CORS `*`, no rate limit) — fine for local
prototyping, must be locked down before any public deploy.

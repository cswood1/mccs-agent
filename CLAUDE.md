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

## Decision: how content gets in (prototype, decided 2026-10-26)
Current phase is early prototyping to figure out how the assistant should work, look, and feel.
Optimize for speed.

- **No crawling.** The MCCS sites sit behind Akamai bot protection, which returns 403 to scripted
  requests. Don't try to get around it. Instead, pages are saved by hand from a normal browser into
  `data/raw/<installation>/*.html`.
- **No embeddings / vector search / RAG.** `npm run convert -- <installation>` turns the saved HTML into
  clean markdown-ish text in `data/content/<installation>.json` (each page keeps its source URL and
  saved date). The whole file is loaded into the system prompt, with prompt caching on that block.
- **Citations** come from the per-page URLs in the prompt; the model is told to link them inline.
- **Sample data:** `data/sample/<installation>.json` is invented placeholder content, used only when no
  `data/content/<installation>.json` exists. When sample data is in use the widget shows a banner and
  answers start with "(Sample data)".
- Revisit later (not now): official feed or allowlisted crawler from MCCS, scheduled refresh,
  retrieval if content outgrows the prompt.

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
- `lib/prompt.ts` — the shared agent template (system prompt). Keep it deterministic so caching works.
- `app/api/chat/route.ts` — POST `{installationId, messages}` → streams plain text. Logs token usage
  including `cache_read` to the server console.
- `app/api/installations/[id]/route.ts` — public display config the widget fetches.
- `public/widget.js` — the embed. `public/embed-test.html` — plain-HTML embed check.
- `app/page.tsx` — mock installation homepage with the widget on it.
- `scripts/convert-html.mts` — saved HTML → `data/content/<id>.json`.

## Commands
- `npm run dev` — run locally (needs `ANTHROPIC_API_KEY` in `.env.local`)
- `npm run convert -- quantico` — rebuild Quantico content from `data/raw/quantico/`
- `npm run build`, `npm run lint`

## Status
Prototype runs end to end on sample data. Next: add real saved Quantico pages, test the example
queries, iterate on look and feel. `/api/chat` is open (CORS `*`, no rate limit) — fine for local
prototyping, must be locked down before any public deploy.

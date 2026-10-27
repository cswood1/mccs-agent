# MCCS Installation Assistant: Product Spec

Owner: product. This spec is the source of truth for how the assistant behaves. Where code or
CLAUDE.md disagrees with it, ask before changing either. Last updated 2026-10-26.

## 1. What we're proving

A Marine, spouse or visitor lands on their installation's MCCS site and gets a correct, short,
sourced answer in seconds, from whatever page they happen to be on. One template plus one
installation config is all it takes to stand up a new base.

**Demo north star:** in 3 minutes, a judge sees the assistant (1) answer a vague question correctly
because it knows what page they're on, (2) follow them as they browse, (3) handle a multi-step
benefits question, and (4) treat a sensitive moment with care. They leave believing it would work at
any installation.

## 2. Who it's for

| Persona | Typical need | What "great" feels like |
|---|---|---|
| PCS family, new to base | "Where do I even start?" Lodging, child care, schools, gyms | Oriented in one answer, with a next step |
| Junior Marine | Gym hours, food, rec, cheap things to do this weekend | Instant, specific, no fluff |
| Spouse / parent | Child care, family programs, support, events for kids | Warm, practical, knows the waitlist reality |
| Career-minded Marine | Tuition Assistance, JST, transition (TRS, SkillBridge) | Step-by-step, accurate, points to the right office |
| Retiree / DoD civilian / visitor | Eligibility ("can I use this?"), lodging, golf, dining | Clear yes/no on eligibility with the source |

Most users are on a phone, often in a hurry.

## 3. Principles

1. **Answer first.** The first sentence answers the question. No preamble, no restating the question.
2. **Short by default, deep on request.** Offer to go deeper instead of front-loading everything.
3. **Trustworthy.** Every fact comes from the site or a trusted official source, with a link. Never
   invent hours, phone numbers, prices, dates or eligibility. Say what you don't know.
4. **Knows where you are.** The current page is the default subject of vague questions.
5. **Hands off well.** When MCCS isn't the answer (medical, legal, pay, orders), say who is.
6. **Warm, plain-spoken, community tone.** Friendly and respectful, like a sharp front-desk staffer
   who's been on base for years. No jokes, no Marine-slang cosplay, no exclamation-point cheer.

## 4. Answer style

- **Length:** about 60 words by default. Up to about 120 for multi-step processes. Never a wall of text.
- **Shape:** 1–2 sentence direct answer, then the key specifics (hours, location, phone), then at most
  one offer to go deeper ("Want the pool hours too?").
- **Lists:** bullets only for 3 or more parallel items. Numbered steps only for real sequences.
- **Clarifying questions:** at most one, and only when the answer truly depends on it (for example,
  eligibility differs for active duty and retirees). Otherwise answer for the most likely person
  and note the difference in a phrase.
- **Citations:** 1–2 inline links to the most relevant page(s), not a link per sentence.
- **Freshness:** hours and events carry a light "as of [date]" note. If the agent fetched the live
  page, it says "checked just now."
- **Actions:** phone numbers render as tap-to-call, addresses as map links, and site pages as
  same-tab links. These are the most useful things on a phone.
- **Formatting:** plain text, **bold** for the key fact, simple lists, links. No headings, no tables.

## 5. Page awareness

**Signals the widget sends with every message:** current URL, page title, breadcrumb, and the last 5
pages visited this session (the trail). Nothing personal. The trail lives in the session only.

**How the agent uses them:**
- The current page is the default subject. "What are the hours?" on the Bowling page means the
  bowling center.
- The trail quietly shapes answers (a visitor who went Child & Youth → CDC → School Age Care is
  probably a parent). **Use it, never mention it.** No "I see you looked at…".
- If the question is clearly about something else, answer that. Page context is a default, not a cage.
- The page note goes after the cached content block, so it never breaks the prompt cache.

**How the panel adapts on navigation:**
- Conversation history persists across pages (same tab, same session).
- Chips update to the new page.
- A context line under the panel title: "Viewing: Bowling Center".
- If the conversation is empty, the welcome line matches the page:
  "Questions about the Bowling Center? I can help."

**Nudge (on by default for the demo, config flag `nudge`):** after about 20 s on a non-home page with
the panel closed, show a small bubble on the launcher with that page's first chip, for example
"Questions about bowling hours?". At most once per session. It dismisses on click and never
covers content.

## 6. Chips

- **Per-page chips (primary):** 3–4 for each captured page, pre-generated at build time by reading
  the page, stored with the page data, and regenerated whenever content is rebuilt. Rules: user's
  voice, 35 characters or fewer, answerable from the content (or a trusted live fetch), specific to
  that page, and spread across different needs (hours/location, cost/eligibility, how-to/booking).
- **Section chips (fallback):** for pages without their own chips.
- **Home / default set:**
  "Just PCS’d here, where do I start?", "Which gyms are open today?",
  "What’s happening this weekend?", "Child care options on base",
  "Help me use Tuition Assistance", "Where can I eat on base?" (show 4).
- **Follow-up chips:** after each answer, 2 next questions the model suggests, returned as
  structured data rather than in the answer text. They replace the page chips until the user
  navigates.
- Chips live in installation data, so each installation has its own.

## 7. Sensitive moments

When someone signals distress, crisis, abuse, assault, or a safety concern:
- Respond with warmth first, in one human sentence. Then give the right resource immediately:
  - **Crisis or suicidal thoughts:** Military/Veterans Crisis Line, dial 988 then press 1 (or text 838255).
  - **Emergency:** 911.
  - For other cases, give the installation's own office and 24/7 line **exactly as listed on the
    captured site**, never from memory:
    - sexual assault: the SAPR program
    - domestic abuse: the Family Advocacy Program
    - counseling or stress: Prevention & Counseling, Military OneSource for confidential non-medical counseling
- Don't probe for details, don't diagnose, don't lecture. Offer to help find something else.
- Never collect names, DoD ID numbers, SSNs or other identifying details, anywhere.

## 8. Out of scope (say so, then hand off)

Medical care and TRICARE, legal advice, pay and allowances, orders and assignments, base access and
gate policy (point to the installation's official site), and anything requiring login (booking,
payments). For these, name the right office or official site in one sentence.

## 9. Quality bar

A test set of 20+ questions in the repo covers every persona and section, vague page-dependent
questions, multi-step processes, eligibility, out-of-scope requests, and sensitive moments. Score
every run on:
1. **Correct:** facts match the captured page.
2. **Sourced:** it links the right page.
3. **Concise:** within the length targets.
4. **Context-aware:** page-dependent questions are resolved from the page.
5. **Tone:** warm and plain.
6. **Safe:** sensitive cases follow section 7.

**Ship bar:** 100% on correct and safe, 90% or better on the rest. Report time to first word for each answer.

## 10. Demo script (about 3 minutes)

1. **Home page.** Point out the chips. Tap "Just PCS’d here, where do I start?" and get a short
   orientation with links.
2. Tap a link in the answer (for example Child & Youth). The page changes in the same tab, the chat stays
   open, and the chips and context line update.
3. Ask, without naming anything: "How does the waitlist work?" It answers about this page's program.
4. Go to Fitness. Ask: "Is it open right now?" It answers for the gym, with the hours and an "as of" note.
5. **Multi-step question:** "I want to use Tuition Assistance. How do I get my JST?" It gives
   numbered steps, the Education Center's location and phone, and a link to the official JST site.
6. **Sensitive moment:** "My husband deployed and I'm really struggling." It responds warmly and
   gives the right resources immediately.
7. **Cross-base moment:** On the Quantico site, ask: "I'm PCSing to Pendleton next month, what should
   I set up?" It answers from Pendleton's pages and links to them.

## 11. Roadmap (in order)

**Working rhythm:**
- Ship in small slices of about 10 minutes, one visible change each.
- After every slice: commit, push (which auto-deploys), give a 3-line report, then stop.
- Run 3–5 targeted test questions per slice.
- Run the full eval only at milestones, and only when asked.
- The team tests the live demo between slices.
- Round 3 ships as separate slices:
  1. page awareness, chips and follow-ups
  2. nudge
  3. tap-to-call and map links

1. **Round 2 (in progress):** conversational style, speed and cost, test set, auto-deploy.
2. **Round 3:** page awareness, chips, follow-ups, nudge, tap-to-call and map links, and the
   sensitive-moment rules (this spec, sections 4–7).
3. **Round 4:** polish:
   - panel visual design to match the MCCS brand
   - typing and streaming feel
   - empty and error states
   - accessibility (keyboard, screen reader, contrast)
4. **Round 5: multi-installation demo environment** (high pitch value). See section 12.

## 12. Multi-installation environment

All MCCS installation sites run on the same CMS theme (`/CMS_Themes/MCCS/`, verified on Quantico and
Pendleton), so one recreated theme and one assistant template cover every base. The work per base
is content capture plus a few base-specific details (logo, homepage tiles, carousel).

**Tiers:**

| Tier | Sites | Captured |
|---|---|---|
| Deep | Quantico (done), **Camp Pendleton**, **Camp Lejeune–New River** | Everything: programs, facilities, events, news |
| Core | Cherry Point, South Carolina (Parris Island/Beaufort), Albany, Hampton Roads, Henderson Hall, 8th & I, Miramar, Twentynine Palms, Yuma, Barstow, Bridgeport, Hawaii, Iwakuni, Camp Fuji, Camp Mujuk | Program, facility and info pages from the menus (about 60–100 per site); no news archive |
| Shared | usmc-mccs.org (Marine Corps–wide) | Corps-wide programs that base pages link to (EFMP, FAP, etc.) |

The recruiting-region sites are out of scope unless time allows.

**How it works:**
- One app. The real location picker switches installations, and each installation gets its own
  path (`/quantico/...`, `/pendleton/...`).
- The same assistant template runs everywhere, with its own config, content, chips and prompt cache
  for each installation, so cost per conversation is unchanged.
- Base-specific homepage details come from one normal browser visit per site, the same method used for Quantico.
- Content capture uses WebFetch only, in background batches. Each deep site is about 45 minutes; the
  core sites are a few hours in total.
- **Cross-installation questions:** the agent can answer from another installation's content when
  asked ("I'm PCSing to Pendleton next month, what should I set up?") and link to that base's pages.
  This is a headline demo moment.

**Order:**
1. Round 3.
2. Pendleton deep, which proves the template.
3. Lejeune deep.
4. Core sites in the background while round 4 polish happens.

**Demo framing:**
- Deep sites are the live demo.
- Core sites show coverage.
- Pitch line: "One integration with MCCS HQ's CMS lights up every installation."

**Risks:**
- Accuracy is harder to spot-check at scale, so spot-check the deep sites only.
- A copy of the whole network is more exposure. The access code, banner and noindex stay mandatory.

## 13. Entry points, naming and the AI signal (decided 2026-10-27)

**Name:** the assistant is **"Ask MCCS"** everywhere. Panel title: "Ask MCCS", with the subtitle
being the installation's short name only (for example "MCB Quantico", "MCB Camp Pendleton"), so "MCCS" isn't
repeated. The short name is display-only config and is never part of the cached prompt. The floating button label is "Ask MCCS". The
composer placeholder stays "Ask me anything…". Never "<Installation> Assistant".

**AI signal:** an original, simple four-point sparkle icon, in the theme's scarlet and gold. It
appears on the floating button, in the panel header next to the title, and in the search bar. The
floating button gets a soft gradient border that shimmers once on page load (no shimmer with
prefers-reduced-motion). Keep it subtle; no characters or mascots.

**Two entry points, one assistant.** The floating button and the header search bar open the same
panel and the same conversation.

**Header search bar becomes Ask MCCS:**
- **Looks like search.** It keeps the site's search bar position and shape. The sparkle replaces the
  magnifier. Placeholder text rotates through examples ("Ask MCCS anything, like 'Is the gym open
  now?'").
- **On focus,** a dropdown shows the current page's chips (same source as the panel).
- **While typing** (no AI calls):
  - The first row is always "✦ Ask MCCS: '<what they typed>'".
  - Below it, up to 5 instant page matches from the captured page titles and breadcrumbs, as plain
    same-tab links.
- **Submitting:** Enter, or choosing the Ask row, opens the panel with the question already sent.
  Choosing a page row navigates normally.
- **Phones:** the header search icon becomes the sparkle and opens the same experience.
- **Accessibility:** keyboard navigation through the rows, standard combobox semantics.

**Why:** a plain "Ask me anything" bubble reads as a legacy help chat. Making the search bar the
front door shows the assistant replacing site search: one box handles both "take me to a page" and
"answer my question".

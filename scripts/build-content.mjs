/**
 * Build the chat agent's knowledge file from the recreated site's page data, so the
 * site and the agent always say the same thing.
 *
 *   npm run build:content [-- <id>]   (installation defaults to quantico)
 *
 * Reads  data/site/<id>/pages/*.json  (captured with WebFetch)
 * Writes data/content/<id>.json        (the format lib/installations.ts loads)
 *
 * Kept small, because the whole file goes into every conversation's (cached) prompt:
 * - Program, facility, section and event pages: full text.
 * - News stories (mostly generic MCCS-wide articles): title + one-line summary. The page
 *   tag carries the link, and the agent can web_fetch the full story.
 * - Oversized pages (over OVERSIZED_CHARS, e.g. the Marine for Life Cycle checklists): each
 *   section's heading and first paragraph, plus a note to fetch the page.
 * - Paragraphs repeated across pages (cross-promo blocks, recurring event descriptions) are
 *   kept on their first page only.
 * - Content diet (2026-10-27, CLAUDE.md API budget rules), facts kept, wording trimmed:
 *   - Descriptive prose: each paragraph keeps its first sentence plus every sentence with a fact:
 *     a digit, $, email, link, eligibility or how-to wording (FACT). Lists, tables, headings and
 *     contact blocks are kept whole.
 *   - Hours: consecutive days with the same time become one row ("Monday–Friday: 5am - 9pm");
 *     generic labels ("Phone (Phone)") are dropped.
 *   - A contact block repeated on a later page becomes a one-line pointer to the first page.
 *   - Dropped: links to pages already in the content (the link text stays; the page tag has the
 *     url), "Related pages" lists for pages already in the content, images, capture notes.
 *   - News: title only, plus the summary when it has a number.
 *   `node scripts/check-content-facts.mjs <before.json> <after.json>` confirms no phone number,
 *   time range or dollar amount was lost.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const id = process.argv[2] || "quantico";
const root = process.cwd();
const dir = path.join(root, "data", "site", id, "pages");
const SUMMARY_CHARS = 200;
const OVERSIZED_CHARS = 40_000;
const DEDUPE_MIN_CHARS = 80;

const pages = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));

// Legal boilerplate with nothing an installation visitor asks about.
const SKIP_PATHS = new Set(["/privacy"]);
const failed = (p) => /structured extraction failed|no real main content|only (site-wide )?navigation|returned the .* hub|wrong content|mismatch/i.test(p.notCaptured || "");
const isNews = (p) => /\/news\//.test(p.url);

// Labels that only repeat the field name.
const GENERIC_LABEL = /^(phone|main|telephone|tel|hours|hours of operation|operating hours|regular hours|hours of operations?)$/i;
const label = (l) => (l && !GENERIC_LABEL.test(l.trim()) ? ` (${l.trim()})` : "");
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Consecutive weekdays with the same time become one row; other rows stay as they are. */
function hourRows(rows) {
  const out = [];
  for (const r of rows) {
    const last = out.at(-1);
    const day = WEEK.indexOf((r.days || "").trim());
    if (last && day > 0 && last.time === r.time && last.endDay === day - 1) {
      last.endDay = day;
      continue;
    }
    out.push({ startDay: day, endDay: day, days: r.days, time: r.time });
  }
  return out.map((r) => `- ${r.startDay >= 0 && r.endDay > r.startDay ? `${WEEK[r.startDay]}–${WEEK[r.endDay]}` : r.days}: ${r.time}`);
}

function contactText(c) {
  const out = [];
  if (c.name) out.push(`Contact: ${c.name}`);
  if (c.address) out.push(`Address: ${c.address.replace(/\n+/g, ", ")}`);
  for (const ph of c.phones || []) out.push(`Phone${label(ph.label)}: ${ph.number}`);
  for (const e of c.emails || []) out.push(`Email: ${e}`);
  for (const h of c.hours || []) {
    out.push(`Hours${label(h.label)}:`);
    out.push(...hourRows(h.rows || []));
  }
  for (const n of c.notes || []) out.push(n);
  return out.join("\n");
}

// A sentence worth keeping even when it isn't a paragraph's first: numbers, prices, contacts,
// links, eligibility rules and how-to steps.
const FACT =
  /\d|\$|@|\]\(|https?:|\b(eligib\w*|must|requir\w*|only|authoriz\w*|ID|CAC|ages?|years? old|active[- ]duty|spouses?|dependents?|family members?|retirees?|civilians?|veterans?|reservists?|guests?|sponsors?|fees?|free|costs?|prices?|call|register\w*|registration|sign[- ]?up|apply|application|book\w*|reserv\w+|bring|submit|complete|enroll\w*|schedul\w*|appointments?|walk-ins?|e-?mail|bldg|waitlist|not (allowed|permitted)|prohibited)\b/i;
// A sentence ends at . ! or ? followed by a space; periods inside "$16.67" or "a.m." don't end it.
const SENTENCE = /(?:[^.!?]|[.!?]+(?!\s|$))+(?:[.!?]+(?=\s|$))?\s*/g;
const TRIM_FROM_CHARS = 100;
// Kept whole: tables, quotes, headings and bold-only lines. List items are trimmed like prose,
// keeping their bullet and bold lead-in.
const isStructured = (line) => /^\s*([|>#]|\*\*[^*]+\*\*:?\s*$)/.test(line);
const LEAD = /^(\s*(?:[-*•]|\d+[.)])\s+(?:\*\*[^*]+\*\*:?\s*(?:[-–—:]\s*)?)?)/;

/** Descriptive lines keep their first sentence and every sentence with a fact. */
function trimProse(md) {
  return (md || "")
    .split("\n")
    .map((line) => {
      if (line.length < TRIM_FROM_CHARS || isStructured(line)) return line;
      const lead = line.match(LEAD)?.[1] ?? "";
      const body = line.slice(lead.length);
      const sentences = body.match(SENTENCE) || [body];
      return lead + sentences.filter((sent, i) => i === 0 || FACT.test(sent)).join("").trim();
    })
    .join("\n");
}

const norm = (u) => {
  try {
    const x = new URL(u);
    return x.origin + (x.pathname.replace(/\/+$/, "") || "/");
  } catch {
    return u;
  }
};

/** Links to pages already in the content keep their text only (the page tag carries the url). */
function stripKnownLinks(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\((https?:[^)\s]+)\)/g, (m, text, url) => (contentUrls.has(norm(url)) ? text : m));
}

function fullText(p) {
  const parts = [`# ${p.title}`];
  if (p.intro) parts.push(trimProse(p.intro));
  for (const s of p.sections || []) {
    if (/^on this page:?$/i.test((s.heading || "").trim())) continue;
    if (!s.markdown?.trim()) continue; // a heading with nothing under it (e.g. "Contact Information")
    parts.push([s.heading ? `## ${s.heading}` : "", trimProse(s.markdown)].filter(Boolean).join("\n"));
  }
  for (const c of p.contacts || []) parts.push(contactText(c));
  // Sub-pages that aren't in the content themselves, when the card has something to cite: a file
  // (forms, maps, menus) or a number. Other cards only repeat navigation.
  const subpages = (p.cards || []).filter(
    (c) => c.url && !/\/(news|activity)\//.test(c.url) && !contentUrls.has(norm(c.url)) && (/\/modules\//.test(c.url) || /\d/.test(c.text || "")),
  );
  if (subpages.length) {
    parts.push("Related pages:\n" + subpages.map((c) => `- [${c.title}](${c.url})${c.text ? ` — ${c.text}` : ""}`).join("\n"));
  }
  return stripKnownLinks(parts.join("\n\n")).replace(/\n{3,}/g, "\n\n").trim();
}

/** First sentence of plain text, capped at SUMMARY_CHARS. */
function firstSentence(md) {
  const plain = (md || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = (plain.match(/^.*?[.!?](\s|$)/) || [plain])[0].trim();
  return sentence.length > SUMMARY_CHARS ? sentence.slice(0, SUMMARY_CHARS).replace(/\s+\S*$/, "") + "…" : sentence;
}

function newsText(p) {
  const body = [p.intro, ...(p.sections || []).map((s) => s.markdown)].filter(Boolean).join("\n\n");
  const summary = firstSentence(body);
  // The agent can web_fetch the story; keep the summary only when it carries a number.
  return summary && /\d/.test(summary) ? `# ${p.title}\n${summary}` : `# ${p.title}`;
}

function oversizedText(p) {
  const parts = [`# ${p.title}`, "(Long page, shortened here: each section's opening only. Fetch the page for the full text.)"];
  for (const s of p.sections || []) {
    const first = (s.markdown || "").split(/\n\s*\n/).find((para) => para.trim()) || "";
    parts.push([s.heading ? `## ${s.heading}` : "", first.trim()].filter(Boolean).join("\n"));
  }
  return parts.join("\n\n");
}

const included = (p) => p.url && p.title && !failed(p) && !SKIP_PATHS.has(new URL(p.url).pathname);
const contentUrls = new Set(pages.filter(included).map((p) => norm(p.url)));

const skipped = [];
const seenContacts = new Map(); // contact block -> first page url
const seenText = new Set();
const seenParagraphs = new Set();
const out = [];
let oversized = 0;
// Program pages first (so shared paragraphs stay on them), then events, then news; each by URL.
const rank = (p) => (/\/news\//.test(p.url) ? 2 : /\/activity\//.test(p.url) ? 1 : 0);
for (const p of pages.sort((a, b) => rank(a) - rank(b) || a.url.localeCompare(b.url))) {
  if (!p.url || !p.title) { skipped.push(`${p.url || "(no url)"}: no title`); continue; }
  if (failed(p)) { skipped.push(`${p.url}: ${p.notCaptured}`); continue; }
  if (SKIP_PATHS.has(new URL(p.url).pathname)) { skipped.push(`${p.url}: boilerplate`); continue; }
  let text = isNews(p) ? newsText(p) : fullText(p);
  // A contact block already given on an earlier page: point to it instead of repeating it.
  text = text
    .split(/\n\s*\n/)
    .map((para) => {
      if (!para.startsWith("Contact: ") || para.split("\n").length < 3) return para;
      const first = seenContacts.get(para);
      if (!first) {
        seenContacts.set(para, p.url);
        return para;
      }
      return `${para.split("\n")[0]} (details on ${first})`;
    })
    .join("\n\n");
  if (!isNews(p) && text.length > OVERSIZED_CHARS) { text = oversizedText(p); oversized++; }
  const key = text.replace(/^# .*\n/, "");
  if (key.length > 200 && seenText.has(key)) { skipped.push(`${p.url}: duplicate of another page`); continue; }
  seenText.add(key);
  // Drop paragraphs already given on an earlier page.
  text = text
    .split(/\n\s*\n/)
    .filter((para) => {
      const k = para.trim();
      if (k.length < DEDUPE_MIN_CHARS || k.startsWith("# ")) return true;
      if (seenParagraphs.has(k)) return false;
      seenParagraphs.add(k);
      return true;
    })
    .join("\n\n");
  out.push({ url: p.url, title: p.title, savedAt: p.fetchedAt, text });
}
// Stable order in the prompt: by URL.
out.sort((a, b) => a.url.localeCompare(b.url));

const content = {
  installationId: id,
  sample: false,
  generatedAt: "2026-10-26T00:00:00.000Z",
  source: `Generated by scripts/build-content.mjs from data/site/${id}/pages (captured with WebFetch on ${[...new Set(pages.map((p) => p.fetchedAt).filter(Boolean))].sort().join(", ")}).`,
  pages: out,
};
mkdirSync(path.join(root, "data", "content"), { recursive: true });
writeFileSync(path.join(root, "data", "content", `${id}.json`), JSON.stringify(content, null, 2) + "\n");

const chars = out.reduce((n, p) => n + p.text.length, 0);
console.log(`${out.length} pages (${out.filter((p) => !/\/news\//.test(p.url)).length} full, ${out.filter((p) => /\/news\//.test(p.url)).length} news summaries, ${oversized} shortened), ${chars.toLocaleString()} chars.`);
if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ` + skipped.join("\n  "));

/**
 * Build the chat agent's knowledge file from the recreated site's page data, so the
 * site and the agent always say the same thing.
 *
 *   npm run build:content            (installation defaults to quantico)
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

function contactText(c) {
  const out = [];
  if (c.name) out.push(`Contact: ${c.name}`);
  if (c.address) out.push(`Address: ${c.address.replace(/\n+/g, ", ")}`);
  for (const ph of c.phones || []) out.push(`Phone${ph.label ? ` (${ph.label})` : ""}: ${ph.number}`);
  for (const e of c.emails || []) out.push(`Email: ${e}`);
  for (const h of c.hours || []) {
    out.push(`Hours${h.label ? ` (${h.label})` : ""}:`);
    for (const r of h.rows || []) out.push(`- ${r.days}: ${r.time}`);
  }
  for (const n of c.notes || []) out.push(n);
  return out.join("\n");
}

function fullText(p) {
  const parts = [`# ${p.title}`];
  if (p.intro) parts.push(p.intro);
  for (const s of p.sections || []) {
    if (/^on this page:?$/i.test((s.heading || "").trim())) continue;
    if (!s.markdown?.trim() && !s.heading?.trim()) continue;
    parts.push([s.heading ? `## ${s.heading}` : "", s.markdown || ""].filter(Boolean).join("\n"));
  }
  for (const c of p.contacts || []) parts.push(contactText(c));
  const subpages = (p.cards || []).filter((c) => c.url && !/\/(news|activity)\//.test(c.url));
  if (subpages.length) {
    parts.push("Related pages:\n" + subpages.map((c) => `- [${c.title}](${c.url})${c.text ? ` — ${c.text}` : ""}`).join("\n"));
  }
  if (p.notCaptured) parts.push(`(Capture note: ${p.notCaptured.length > 160 ? p.notCaptured.slice(0, 160).replace(/\s+\S*$/, "") + "…" : p.notCaptured})`);
  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
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
  return summary ? `# ${p.title}\n${summary}` : `# ${p.title}`;
}

function oversizedText(p) {
  const parts = [`# ${p.title}`, "(Long page, shortened here: each section's opening only. Fetch the page for the full text.)"];
  for (const s of p.sections || []) {
    const first = (s.markdown || "").split(/\n\s*\n/).find((para) => para.trim()) || "";
    parts.push([s.heading ? `## ${s.heading}` : "", first.trim()].filter(Boolean).join("\n"));
  }
  return parts.join("\n\n");
}

const skipped = [];
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
  source: `Generated by scripts/build-content.mjs from data/site/${id}/pages (captured with WebFetch on 2026-10-26).`,
  pages: out,
};
mkdirSync(path.join(root, "data", "content"), { recursive: true });
writeFileSync(path.join(root, "data", "content", `${id}.json`), JSON.stringify(content, null, 2) + "\n");

const chars = out.reduce((n, p) => n + p.text.length, 0);
console.log(`${out.length} pages (${out.filter((p) => !/\/news\//.test(p.url)).length} full, ${out.filter((p) => /\/news\//.test(p.url)).length} news summaries, ${oversized} shortened), ${chars.toLocaleString()} chars.`);
if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ` + skipped.join("\n  "));

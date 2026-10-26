/**
 * Pre-generate 3–4 suggested-question chips for every captured page (docs/PRODUCT.md §6),
 * with Claude Haiku 4.5 through the Message Batches API (half price, async).
 *
 *   node --env-file=.env.local scripts/chips/generate.mjs --dry-run   # estimate only, no API calls
 *   node --env-file=.env.local scripts/chips/generate.mjs --submit    # create the batch
 *   node --env-file=.env.local scripts/chips/generate.mjs --collect   # wait for it, write chips
 *
 * Chips are written into each page file (data/site/<id>/pages/*.json) as `chips`, with a hash
 * of the text they were generated from (`chipsSourceHash`). Pages whose text hasn't changed
 * are skipped, so re-runs only pay for what changed.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const MODEL = "claude-haiku-4-5";
const MAX_PAGE_CHARS = 6000;
// Haiku 4.5 list price per million tokens; the Batches API is half of this.
const PRICE = { input: 1.0, output: 5.0, batchDiscount: 0.5 };

const id = "quantico";
const root = process.cwd();
const pagesDir = path.join(root, "data", "site", id, "pages");
const pendingFile = path.join(root, "data", "site", id, "chips-batch.json");
const mode = process.argv.find((a) => ["--dry-run", "--submit", "--collect"].includes(a)) ?? "--dry-run";

const INSTRUCTIONS = `You write suggested-question chips for one page of an MCCS (Marine Corps Community Services) installation website. Visitors tap a chip to ask an AI assistant that question about the page.

Rules:
- Write 5 chips, in the visitor's own voice (first person, casual, like they'd type it on a phone).
- Hard limit: each chip is 35 characters or fewer, counting spaces and the question mark. Short is better. Examples with their lengths: "Bowling hours on Saturday?" (26), "Can I bring my dog?" (19), "How do I sign up?" (17), "Who can use the pool?" (21).
- Each chip must be answerable from the page text below.
- Be specific to this page (name the thing when it helps, e.g. "Bowling hours on Saturday?").
- Spread them across different needs: hours or location, cost or who can use it, how to sign up or book.
- No yes/no questions when an open question works better. No emoji.

Reply with only a JSON array of 5 strings, no code fence, like ["First chip?", "Second chip?", "Third chip?", "Fourth chip?", "Fifth chip?"].`;

const failed = (p) => /structured extraction failed|no real main content|only (site-wide )?navigation|returned the .* hub|wrong content|mismatch/i.test(p.notCaptured || "");

/** The page as plain-ish text for the model, capped. */
function pageText(p) {
  const parts = [`Title: ${p.title}`, `URL: ${p.url}`];
  if (p.intro) parts.push(p.intro);
  for (const s of p.sections || []) parts.push([s.heading, s.markdown].filter(Boolean).join("\n"));
  for (const c of p.contacts || []) {
    parts.push(
      [c.name, c.address, ...(c.phones || []).map((x) => `${x.label}: ${x.number}`), ...(c.hours || []).flatMap((h) => [h.label, ...(h.rows || []).map((r) => `${r.days}: ${r.time}`)])]
        .filter(Boolean)
        .join("\n"),
    );
  }
  const subpages = (p.cards || []).filter((c) => c.url && !/\/(news|activity)\//.test(c.url)).map((c) => `- ${c.title}: ${c.text}`);
  if (subpages.length) parts.push("Sub-pages:\n" + subpages.join("\n"));
  const text = parts.join("\n\n").replace(/\]\([^)]*\)/g, "]");
  return text.length > MAX_PAGE_CHARS ? text.slice(0, MAX_PAGE_CHARS) + "\n…" : text;
}

// Hash of the page text only: chips are regenerated when a page's content changes.
const hash = (s) => createHash("sha256").update(MODEL + s).digest("hex").slice(0, 16);
const rawFile = path.join(root, "data", "site", id, "chips-raw.json");

function loadTodo() {
  const todo = [];
  let upToDate = 0;
  for (const f of readdirSync(pagesDir).filter((f) => f.endsWith(".json")).sort()) {
    const p = JSON.parse(readFileSync(path.join(pagesDir, f), "utf8"));
    if (!p.title || failed(p)) continue;
    const text = pageText(p);
    const h = hash(text);
    if (p.chipsSourceHash === h && Array.isArray(p.chips) && p.chips.length >= 2) {
      upToDate++;
      continue;
    }
    todo.push({ file: f, text, hash: h });
  }
  return { todo, upToDate };
}

function request(item, i) {
  return {
    custom_id: `p${String(i).padStart(4, "0")}`,
    params: {
      model: MODEL,
      max_tokens: 250,
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: `<page>\n${item.text}\n</page>` }],
    },
  };
}

/** Parse and validate the model's chips; returns [] if unusable. */
function parseChips(raw) {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return arr
      .filter((c) => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => c.length > 3 && c.length <= 35)
      .slice(0, 4);
  } catch {
    return [];
  }
}

if (mode === "--dry-run") {
  const { todo, upToDate } = loadTodo();
  const inChars = todo.reduce((n, t) => n + t.text.length + INSTRUCTIONS.length + 40, 0);
  const inTokens = Math.round(inChars / 3.5);
  const outTokens = todo.length * 60;
  const cost = ((inTokens * PRICE.input + outTokens * PRICE.output) / 1e6) * PRICE.batchDiscount;
  console.log(
    `${todo.length} pages need chips (${upToDate} already up to date).\n` +
      `One batch of ${todo.length} requests to ${MODEL}.\n` +
      `Estimated ~${inTokens.toLocaleString()} input + ~${outTokens.toLocaleString()} output tokens ≈ $${cost.toFixed(2)} at batch prices.`,
  );
  process.exit(0);
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic();

if (mode === "--submit") {
  if (existsSync(pendingFile)) {
    console.error(`A batch is already pending (${pendingFile}). Run --collect first.`);
    process.exit(1);
  }
  const { todo } = loadTodo();
  if (!todo.length) {
    console.log("All pages already have up-to-date chips.");
    process.exit(0);
  }
  const requests = todo.map(request);
  const batch = await client.messages.batches.create({ requests });
  writeFileSync(
    pendingFile,
    JSON.stringify({ batchId: batch.id, items: todo.map((t, i) => ({ custom_id: requests[i].custom_id, file: t.file, hash: t.hash })) }, null, 2),
  );
  console.log(`Submitted batch ${batch.id} with ${requests.length} requests. Run --collect to wait for results.`);
}

if (mode === "--collect") {
  const pending = JSON.parse(readFileSync(pendingFile, "utf8"));
  let batch;
  for (;;) {
    batch = await client.messages.batches.retrieve(pending.batchId);
    if (batch.processing_status === "ended") break;
    console.log(`Batch ${batch.processing_status}: ${batch.request_counts.processing} still processing…`);
    await new Promise((r) => setTimeout(r, 30_000));
  }
  const byId = new Map(pending.items.map((x) => [x.custom_id, x]));
  let written = 0;
  const problems = [];
  let inTok = 0;
  let outTok = 0;
  // Keep the raw model output, so parsing changes never need another API call.
  const raw = existsSync(rawFile) ? JSON.parse(readFileSync(rawFile, "utf8")) : {};
  for await (const result of await client.messages.batches.results(pending.batchId)) {
    const item = byId.get(result.custom_id);
    if (!item) continue;
    if (result.result.type !== "succeeded") {
      problems.push(`${item.file}: ${result.result.type}`);
      continue;
    }
    const msg = result.result.message;
    inTok += msg.usage.input_tokens;
    outTok += msg.usage.output_tokens;
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    raw[item.file] = { hash: item.hash, text };
    const chips = parseChips(text);
    if (chips.length < 2) {
      problems.push(`${item.file}: unusable output ${JSON.stringify(text.slice(0, 80))}`);
      continue;
    }
    const file = path.join(pagesDir, item.file);
    const page = JSON.parse(readFileSync(file, "utf8"));
    page.chips = chips;
    page.chipsSourceHash = item.hash;
    writeFileSync(file, JSON.stringify(page, null, 2) + "\n");
    written++;
  }
  writeFileSync(rawFile, JSON.stringify(raw, null, 1) + "\n");
  rmSync(pendingFile);
  const cost = ((inTok * PRICE.input + outTok * PRICE.output) / 1e6) * PRICE.batchDiscount;
  console.log(`Wrote chips for ${written} pages. Actual usage: ${inTok.toLocaleString()} in + ${outTok.toLocaleString()} out ≈ $${cost.toFixed(2)}.`);
  if (problems.length) console.log(`${problems.length} problems (re-run --submit to retry them):\n  ` + problems.join("\n  "));
}

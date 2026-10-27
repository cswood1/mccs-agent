/**
 * Confirms a rebuilt content file kept every fact the agent must never invent: phone numbers,
 * time ranges and dollar amounts. Offline, no API calls.
 *
 *   node scripts/check-content-facts.mjs <before.json> <after.json>
 *
 * Each value is normalized (phones to their 10 digits; times and prices lowercased with spaces,
 * dashes and "to" unified) and compared as a set per file. Exits 1 if anything is missing.
 */
import { readFileSync } from "node:fs";

const [beforeFile, afterFile] = process.argv.slice(2);
if (!beforeFile || !afterFile) {
  console.error("Usage: node scripts/check-content-facts.mjs <before.json> <after.json>");
  process.exit(2);
}

const PHONE = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
const T = String.raw`\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|noon|midnight)?`;
const TIME_RANGE = new RegExp(String.raw`\b${T}\s*(?:-|–|—|to|until)\s*${T}`, "gi");
const DOLLARS = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

const isTime = (s) => /a\.?m|p\.?m|noon|midnight|:\d{2}/i.test(s); // "5-10" alone is not a time range
const normTime = (s) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "").replace(/–|—|to|until/g, "-");

function facts(file) {
  const content = JSON.parse(readFileSync(file, "utf8"));
  const text = content.pages.map((p) => p.text).join("\n");
  const phones = new Set([...text.matchAll(PHONE)].map((m) => m[1] + m[2] + m[3]));
  const times = new Set([...text.matchAll(TIME_RANGE)].map((m) => m[0]).filter(isTime).map(normTime));
  const dollars = new Set([...text.matchAll(DOLLARS)].map((m) => m[0].replace(/\s/g, "")));
  return { id: content.installationId, chars: text.length, phones, times, dollars };
}

const before = facts(beforeFile);
const after = facts(afterFile);
let lost = 0;
console.log(`${after.id}: ${before.chars.toLocaleString()} -> ${after.chars.toLocaleString()} chars`);
for (const kind of ["phones", "times", "dollars"]) {
  const missing = [...before[kind]].filter((v) => !after[kind].has(v));
  lost += missing.length;
  console.log(`  ${kind.padEnd(8)} before ${String(before[kind].size).padStart(4)}  after ${String(after[kind].size).padStart(4)}  missing ${missing.length}${missing.length ? ": " + missing.slice(0, 20).join(", ") : ""}`);
}
process.exit(lost ? 1 : 0);

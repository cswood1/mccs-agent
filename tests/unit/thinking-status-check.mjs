/**
 * Thinking phrases and tool status wording (display only), checked offline: no server, no Claude.
 *
 *   node --import ./tests/unit/alias-hooks.mjs tests/unit/thinking-status-check.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

const { THINKING, THINKING_RARE, pickThinking } = await import("../../lib/chat-client.ts");
const { crossBaseStatus } = await import("../../lib/crossbase.ts");

// Seeded random numbers (mulberry32), so the frequency check is the same every run.
let seed = 42;
const random = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let prev = "";
let repeats = 0;
let rare = 0;
const all = [...THINKING, THINKING_RARE];
let unknown = 0;
for (let i = 0; i < 12000; i++) {
  const t = pickThinking(prev, random);
  if (t === prev) repeats++;
  if (t === THINKING_RARE) rare++;
  if (!all.includes(t)) unknown++;
  prev = t;
}
check("Phrases are the four in the brief", JSON.stringify(all) === JSON.stringify(["Let me check on that…", "Checking on that…", "Checking, be right back…", "Hooking and jabbing, be right back…"]));
check("Never the same phrase twice in a row", repeats === 0 && unknown === 0, JSON.stringify({ repeats, unknown }));
check("“Hooking and jabbing” is about 1 in 6", rare / 12000 > 0.13 && rare / 12000 < 0.2, String(rare / 12000));

// The widget keeps its own copy (no build step): same phrases.
const widget = readFileSync(new URL("../../public/widget.js", import.meta.url), "utf8");
check("Widget uses the same phrase list", THINKING.every((t) => widget.includes(`"${t}"`)) && widget.includes(`"${THINKING_RARE}"`));

check("Cross-base status: the base's name without MCB", crossBaseStatus('{"installation":"pendleton"}') === "Checking Camp Pendleton…" && crossBaseStatus('{"installation":"quantico","query":"x"}') === "Checking Quantico…" && crossBaseStatus('{"installation":"lejeune"') === "Checking Camp Lejeune…");
check("Cross-base status fallback", crossBaseStatus('{"query":"x"}') === "Checking another installation…");
const route = readFileSync(new URL("../../app/api/chat/route.ts", import.meta.url), "utf8");
check("web_fetch / web_search status wording", route.includes('web_fetch: "Checking the latest MCCS info…"') && route.includes('web_search: "Searching for the latest MCCS info…"'));

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

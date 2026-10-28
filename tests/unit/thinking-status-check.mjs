/**
 * Thinking phrase and tool status wording (display only), checked offline: no server, no Claude.
 *
 *   node --import ./tests/unit/alias-hooks.mjs tests/unit/thinking-status-check.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

const chatClient = await import("../../lib/chat-client.ts");
const { THINKING } = chatClient;
const { crossBaseStatus } = await import("../../lib/crossbase.ts");

check("One thinking phrase: “Hooking and jabbing, be right back…”", JSON.stringify(THINKING) === JSON.stringify(["Hooking and jabbing, be right back…"]), JSON.stringify(THINKING));
check("No random picker left", !("pickThinking" in chatClient) && !("THINKING_RARE" in chatClient));

// The widget keeps its own copy (no build step): the same list, and no picker.
const widget = readFileSync(new URL("../../public/widget.js", import.meta.url), "utf8");
check("Widget uses the same list", widget.includes(`var THINKING = ${JSON.stringify(THINKING)};`) && !/pickThinking|THINKING_RARE|Math\.random/.test(widget));

check("Cross-base status: the base's name without MCB", crossBaseStatus('{"installation":"pendleton"}') === "Checking Camp Pendleton…" && crossBaseStatus('{"installation":"quantico","query":"x"}') === "Checking Quantico…" && crossBaseStatus('{"installation":"lejeune"') === "Checking Camp Lejeune…");
check("Cross-base status fallback", crossBaseStatus('{"query":"x"}') === "Checking another installation…");
const route = readFileSync(new URL("../../app/api/chat/route.ts", import.meta.url), "utf8");
check("web_fetch / web_search status wording", route.includes('web_fetch: "Checking the latest MCCS info…"') && route.includes('web_search: "Searching for the latest MCCS info…"'));

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

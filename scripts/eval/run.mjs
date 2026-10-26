/**
 * Run the test questions against a running server and record answers, timing and length.
 *
 *   node --env-file=.env.local scripts/eval/run.mjs <label> [baseUrl]
 *
 * label    name for this run, e.g. "before" or "after" (results/<label>.json)
 * baseUrl  defaults to http://localhost:3000
 *
 * Each question is its own one-turn conversation, run one at a time so timings are clean.
 * Sends the access cookie when DEMO_ACCESS_CODE is set. On a local dev server it also reads
 * token usage (cache read/write) from Next's dev log.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { score, tally } from "./score.mjs";

const [label, base = "http://localhost:3000"] = process.argv.slice(2);
if (!label) {
  console.error("Usage: node --env-file=.env.local scripts/eval/run.mjs <label> [baseUrl]");
  process.exit(1);
}

const root = process.cwd();
const questions = JSON.parse(readFileSync(path.join(root, "tests/eval/questions.json"), "utf8"));
const code = process.env.DEMO_ACCESS_CODE?.trim();
const cookie = code
  ? `mccs_demo_access=${createHash("sha256").update(`mccs-demo-access:${code}`).digest("hex")}`
  : "";
const devLog = path.join(root, ".next/dev/logs/next-development.log");
const isLocal = /localhost|127\.0\.0\.1/.test(base);

function usageLinesSince(offset) {
  if (!isLocal || !existsSync(devLog)) return [];
  const text = readFileSync(devLog, "utf8").slice(offset);
  return [...text.matchAll(/\[chat\] [^"]*?model=(\S+) stop=(\S+) in=(\d+) cache_read=(\d+) cache_write=(\d+) out=(\d+)/g)].map((m) => ({
    model: m[1],
    stop: m[2],
    input: +m[3],
    cacheRead: +m[4],
    cacheWrite: +m[5],
    output: +m[6],
  }));
}

const results = [];
for (const [i, q] of questions.entries()) {
  const logOffset = isLocal && existsSync(devLog) ? readFileSync(devLog, "utf8").length : 0;
  const started = performance.now();
  let firstByte = null;
  let answer = "";
  let status = 0;
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ installationId: "quantico", messages: [{ role: "user", content: q.question }] }),
    });
    status = res.status;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstByte === null) firstByte = performance.now() - started;
      answer += decoder.decode(value, { stream: true });
    }
  } catch (err) {
    answer = `ERROR: ${err.message}`;
  }
  const total = performance.now() - started;
  await new Promise((r) => setTimeout(r, 400)); // let the server write its usage log line
  const usage = usageLinesSince(logOffset);
  const row = {
    id: q.id,
    topic: q.topic,
    question: q.question,
    status,
    firstTokenSec: firstByte === null ? null : +(firstByte / 1000).toFixed(2),
    totalSec: +(total / 1000).toFixed(2),
    chars: answer.length,
    words: answer.trim().split(/\s+/).filter(Boolean).length,
    links: (answer.match(/\]\(https?:\/\//g) || []).length,
    usage,
    answer: answer.trim(),
  };
  row.scores = score(q, row.answer);
  results.push(row);
  console.log(
    `${String(i + 1).padStart(2)}. ${q.id.padEnd(17)} first ${String(row.firstTokenSec).padStart(5)}s  total ${String(row.totalSec).padStart(5)}s  ${String(row.words).padStart(4)} words  ${row.links} links` +
      `  ${Object.entries(row.scores).filter(([, v]) => v === false).map(([k]) => "FAIL:" + k).join(" ")}` +
      (usage.length ? `  cache_read=${usage.map((u) => u.cacheRead).join("+")} cache_write=${usage.map((u) => u.cacheWrite).join("+")}` : ""),
  );
}

const avg = (k) => +(results.reduce((n, r) => n + (r[k] ?? 0), 0) / results.length).toFixed(2);
const median = (k) => {
  const v = results.map((r) => r[k] ?? 0).sort((a, b) => a - b);
  return +((v[(v.length - 1) >> 1] + v[v.length >> 1]) / 2).toFixed(2);
};
const summary = {
  label,
  base,
  ranAt: new Date().toISOString(),
  questions: results.length,
  coldFirstTokenSec: results[0]?.firstTokenSec ?? null,
  medianFirstTokenSec: median("firstTokenSec"),
  avgFirstTokenSec: avg("firstTokenSec"),
  medianTotalSec: median("totalSec"),
  avgTotalSec: avg("totalSec"),
  medianWords: median("words"),
  avgWords: avg("words"),
  avgLinks: avg("links"),
  scores: tally(results),
};
const outDir = path.join(root, "tests/eval/results");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify({ summary, results }, null, 2) + "\n");
console.log("\n" + JSON.stringify(summary));

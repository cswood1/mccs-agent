/**
 * Compare two eval runs side by side.
 *
 *   node scripts/eval/compare.mjs before after
 *
 * Writes tests/eval/results/<a>-vs-<b>.md with a summary, a per-question table, and both answers.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { score, tally } from "./score.mjs";

const [a = "before", b = "after"] = process.argv.slice(2);
const dir = path.join(process.cwd(), "tests/eval/results");
const load = (label) => JSON.parse(readFileSync(path.join(dir, `${label}.json`), "utf8"));
const A = load(a);
const B = load(b);
// Score both runs with today's checks, so older runs are comparable.
const questions = JSON.parse(readFileSync(path.join(process.cwd(), "tests/eval/questions.json"), "utf8"));
for (const run of [A, B]) for (const r of run.results) {
  const q = questions.find((x) => x.id === r.id);
  r.scores = q ? score(q, r.answer) : {};
}
const mark = (v) => (v === true ? "✓" : v === false ? "✗" : "–");

const median = (rows, k) => {
  const v = rows.map((r) => r[k] ?? 0).sort((x, y) => x - y);
  return +((v[(v.length - 1) >> 1] + v[v.length >> 1]) / 2).toFixed(2);
};
const mean = (rows, k) => +(rows.reduce((n, r) => n + (r[k] ?? 0), 0) / rows.length).toFixed(2);
const prefix = (rows) => rows[0]?.usage?.[0] ? rows[0].usage[0].cacheRead + rows[0].usage[0].cacheWrite : null;

const stat = (label, rows) => {
  const t = tally(rows);
  return `| ${label} | ${rows.length} | ${rows[0].firstTokenSec}s | ${median(rows, "firstTokenSec")}s | ${median(rows, "totalSec")}s | ${median(rows, "words")} | ${mean(rows, "links")} | ${t.correct} | ${t.sourced} | ${t.concise} | ${t.safe} | ${prefix(rows)?.toLocaleString() ?? "?"} |`;
};

const lines = [
  `# Eval: ${a} vs ${b}`,
  "",
  `Questions from tests/eval/questions.json, one-turn conversations, run one at a time. Scores are the mechanical checks in scripts/eval/score.mjs (docs/PRODUCT.md section 9); tone and page awareness are judged by reading.`,
  `${a}: ${A.summary.ranAt} · ${b}: ${B.summary.ranAt}`,
  "",
  "| Run | Questions | First answer, cold cache | Median time to first text | Median total time | Median words | Avg links | Correct | Sourced | Concise | Safe | Cached prompt tokens |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|",
  stat(a, A.results),
  stat(b, B.results),
  "",
  "## Per question",
  "",
  `| # | Question | First text ${a} → ${b} | Total ${a} → ${b} | Words ${a} → ${b} | Links ${a} → ${b} | ${b}: correct / sourced / concise / safe |`,
  "|---|---|---|---|---|---|---|",
  ...B.results.map((s, i) => {
    const r = A.results.find((x) => x.id === s.id);
    const f = (v, u = "") => (v === undefined || v === null ? "—" : `${v}${u}`);
    const sc = s.scores;
    return `| ${i + 1} | ${s.question} | ${f(r?.firstTokenSec, "s")} → ${s.firstTokenSec}s | ${f(r?.totalSec, "s")} → ${s.totalSec}s | ${f(r?.words)} → ${s.words} | ${f(r?.links)} → ${s.links} | ${mark(sc.correct)} ${mark(sc.sourced)} ${mark(sc.concise)} ${mark(sc.safe)} |`;
  }),
  "",
  "## Answers",
  "",
];
for (const [i, s] of B.results.entries()) {
  const r = A.results.find((x) => x.id === s.id);
  lines.push(
    `### ${i + 1}. ${s.question}`,
    "",
    ...(r
      ? [`**${a}** (${r.firstTokenSec}s to first text, ${r.totalSec}s total, ${r.words} words)`, "", r.answer.split("\n").map((l) => `> ${l}`).join("\n"), ""]
      : [`**${a}**: not in that run (question added later)`, ""]),
    `**${b}** (${s.firstTokenSec}s to first text, ${s.totalSec}s total, ${s.words} words)`,
    "",
    (s.answer ?? "").split("\n").map((l) => `> ${l}`).join("\n"),
    "",
  );
}
const out = path.join(dir, `${a}-vs-${b}.md`);
writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.slice(0, 10).join("\n"));
console.log(`\nWrote ${path.relative(process.cwd(), out)}`);

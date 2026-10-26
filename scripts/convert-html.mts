/**
 * Convert saved MCCS pages (data/raw/<installation>/*.html) into clean text the
 * agent loads into its system prompt (data/content/<installation>.json).
 *
 *   npm run convert -- quantico
 *
 * Save pages from a normal browser (File > Save Page As..., "Webpage, HTML Only"
 * is enough). The source URL is read from the page's canonical link, og:url, or
 * Chrome's "saved from url" comment. If a page has none of those, add it to
 * data/raw/<installation>/urls.json: { "fitness.html": "https://..." }.
 *
 * Runs directly on Node 22.18+ (built-in TypeScript type stripping).
 */
import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import turndownPluginGfm from "turndown-plugin-gfm";
import type { InstallationConfig, InstallationContent, ContentPage } from "../lib/installations.ts";

const id = process.argv[2];
if (!id) {
  console.error("Usage: npm run convert -- <installation-id>   (e.g. quantico)");
  process.exit(1);
}

const root = process.cwd();
const configPath = path.join(root, "installations", `${id}.json`);
if (!existsSync(configPath)) {
  console.error(`No installation config at installations/${id}.json`);
  process.exit(1);
}
const config: InstallationConfig = JSON.parse(await readFile(configPath, "utf8"));

const rawDir = path.join(root, "data", "raw", id);
const manifestPath = path.join(rawDir, "urls.json");
const manifest: Record<string, string> = existsSync(manifestPath)
  ? JSON.parse(await readFile(manifestPath, "utf8"))
  : {};

const files = (await readdir(rawDir)).filter((f) => /\.html?$/i.test(f)).sort();
if (files.length === 0) {
  console.error(`No .html files in data/raw/${id}/. Save some pages there first.`);
  process.exit(1);
}

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
turndown.use(turndownPluginGfm.gfm);
// Links with no visible text are noise; keep their text-less form out entirely.
turndown.addRule("dropEmptyLinks", {
  filter: (node) => node.nodeName === "A" && !node.textContent?.trim(),
  replacement: () => "",
});

const byUrl = new Map<string, ContentPage>();
let warnings = 0;

for (const file of files) {
  const html = await readFile(path.join(rawDir, file), "utf8");
  const $ = cheerio.load(html);

  const url =
    manifest[file] ||
    $('link[rel="canonical"]').attr("href") ||
    $('meta[property="og:url"]').attr("content") ||
    /<!--\s*saved from url=\(\d+\)(\S+?)\s*-->/i.exec(html)?.[1];
  if (!url) {
    console.warn(`  ! ${file}: no source URL found; add it to data/raw/${id}/urls.json. Skipping.`);
    warnings++;
    continue;
  }

  const title = (
    $('meta[property="og:title"]').attr("content") ||
    $("title").first().text() ||
    $("h1").first().text() ||
    file
  )
    .replace(/\s+/g, " ")
    .trim();

  // Strip things that are never useful as answer content.
  $("script, style, noscript, template, svg, canvas, iframe, img, picture, video, audio, form, button, input, select, link, meta").remove();
  $(config.html.removeSelectors.join(", ")).remove();

  // Prefer the page's main content region; fall back to <body>.
  const mainSelector = config.html.contentSelectors.find((sel) => $(sel).first().text().trim().length > 200);
  const main = $(mainSelector ?? "body").first();

  // Make links absolute so citations and in-answer links work.
  main.find("a[href]").each((_, a) => {
    const href = $(a).attr("href")!.trim();
    if (/^(javascript:|#)/i.test(href)) {
      $(a).replaceWith($(a).text());
      return;
    }
    try {
      $(a).attr("href", new URL(href, url).toString());
    } catch {
      $(a).replaceWith($(a).text());
    }
  });

  const text = turndown
    .turndown(main.html() ?? "")
    .split("\n")
    .map((l) => l.trimEnd().replace(/^(\s*)([-*]|\d+\.) {2,}/, "$1$2 "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < 50) {
    console.warn(`  ! ${file}: almost no text extracted (${text.length} chars). Check contentSelectors in installations/${id}.json.`);
    warnings++;
  }

  const savedAt = (await stat(path.join(rawDir, file))).mtime.toISOString().slice(0, 10);
  const existing = byUrl.get(url);
  if (existing && existing.text.length >= text.length) continue; // keep the fuller copy of a duplicate
  byUrl.set(url, { url, title, savedAt, text });
  console.log(`  ✓ ${file} → ${url} (${text.length.toLocaleString()} chars)`);
}

// Stable order keeps the prompt byte-identical between runs (prompt caching).
const pages = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
const output: InstallationContent = {
  installationId: id,
  sample: false,
  generatedAt: new Date().toISOString(),
  pages,
};

await mkdir(path.join(root, "data", "content"), { recursive: true });
const outPath = path.join(root, "data", "content", `${id}.json`);
await writeFile(outPath, JSON.stringify(output, null, 2) + "\n");

const chars = pages.reduce((n, p) => n + p.text.length, 0);
console.log(
  `\nWrote ${pages.length} pages to data/content/${id}.json — ${chars.toLocaleString()} chars, roughly ${Math.round(chars / 4).toLocaleString()} tokens.${warnings ? ` ${warnings} warning(s) above.` : ""}`,
);

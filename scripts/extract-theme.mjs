/**
 * Build the recreated site's theme from the browser capture in design/reference/.
 *
 *   node scripts/extract-theme.mjs
 *
 * Writes:
 *   site/fragments/quantico/*.html  header, search modal, footer, and the purely visual home blocks
 *   public/theme/css/*.css          the site's own stylesheets (served as-is, in the original order)
 *   public/theme/vendor/            Bootstrap 5.3.2 + Bootstrap Icons 1.7.2 from node_modules
 *   public/theme/images/            logo SVG
 *
 * Fragments are cleaned: no scripts or inline handlers, internal links made local, media
 * pointed at the real site (the browser loads them; a client-side fallback swaps in a
 * placeholder if they fail), and the "Official U.S. Marine Corps Website" line replaced.
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const ROOT = process.cwd();
const SITE = "https://quantico.usmc-mccs.org";
const ref = (f) => JSON.parse(readFileSync(path.join(ROOT, "design/reference", f), "utf8"));
const out = (p, data) => {
  mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
  writeFileSync(path.join(ROOT, p), data);
};

const home = ref("page-home.json");
const $ = cheerio.load(home.html);

function clean(sel) {
  const el = $(sel).first().clone();
  if (!el.length) throw new Error(`Selector not found: ${sel}`);
  el.find("script, noscript").remove();
  el.find("button").filter((_, b) => $(b).text().trim() === "COPY").remove();
  el.find("*").addBack().each((_, node) => {
    for (const name of Object.keys(node.attribs ?? {})) {
      if (name.startsWith("on")) $(node).removeAttr(name);
    }
  });
  el.find("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (href.startsWith(SITE)) $(a).attr("href", href.slice(SITE.length) || "/");
  });
  el.find("img").each((_, img) => {
    for (const attr of ["src", "data-src"]) {
      const v = $(img).attr(attr);
      if (!v) continue;
      if (v.endsWith("logo-mccs-white.svg")) $(img).attr(attr, "/theme/images/logo-mccs-white.svg");
      else if (v.startsWith("/")) $(img).attr(attr, SITE + v);
    }
  });
  return $.html(el);
}

const F = "site/fragments/quantico";
out(`${F}/header.html`, clean("header#header"));
out(`${F}/search-modal.html`, clean("#searchModal"));

let footer = clean("footer");
footer = footer.replace(
  /©\s*\d{4}\s*Official U\.S\. Marine Corps Website/,
  "Prototype demo — not the official MCCS site.",
);
if (footer.includes("Official U.S. Marine Corps Website")) throw new Error("Footer still claims to be official");
out(`${F}/footer.html`, footer);

// Home page blocks that are pure presentation (slides, tile artwork, partner logos).
const blocks = $("#block-mccs-content > .content").children().toArray();
const blockHtml = (i) => clean(blocks[i]);
out(`${F}/home-carousel-desktop.html`, blockHtml(1));
out(`${F}/home-carousel-mobile.html`, blockHtml(2));
out(`${F}/home-tiles.html`, blockHtml(3));
out(`${F}/home-important-links.html`, blocks.slice(5).map((_, i) => blockHtml(5 + i)).join("\n"));

// Installation registry from the real location picker: one entry per site (slug = subdomain).
// The app serves each at /<slug>; ones without captured content show a "coming soon" page.
const registry = new Map();
$("#modal-block-views-block-change-location-change-location a[href]").each((_, a) => {
  const href = $(a).attr("href");
  const name = $(a).text().replace(/\s+/g, " ").trim();
  const url = new URL(href, SITE);
  const host = url.hostname.replace(/^www\./, "");
  const slug = host === "quantico.usmc-mccs.org" ? "quantico" : host.endsWith(".usmc-mccs.org") ? host.split(".")[0] : host.split(".")[0].replace(/^mccs/, "");
  const prev = registry.get(slug);
  // Camp Lejeune and New River share one site.
  registry.set(slug, { slug, name: prev ? `${prev.name}–${name}` : name, siteUrl: `${url.protocol}//${url.hostname}/` });
});
const installations = [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
out("site/installations.json", JSON.stringify(installations, null, 2) + "\n");

// Stylesheets, in the order the README lists them. Theme asset URLs point at /theme/images.
const css = home.css;
for (const name of ["tokens.css", "all3.css", "mccs-style.css", "inline-style-tags.css"]) {
  const text = css[name].replaceAll("/CMS_Themes/MCCS/images/", "/theme/images/");
  out(`public/theme/css/${name}`, text);
}

// Logo SVG (identical in every capture).
const svg = ref("page-section-recreation-fitness.json").svgAssets[`${SITE}/CMS_Themes/MCCS/images/logo-mccs-white.svg`];
out("public/theme/images/logo-mccs-white.svg", svg);

// Vendor files from npm, so the versions are pinned in package.json.
cpSync(path.join(ROOT, "node_modules/bootstrap/dist/css/bootstrap.min.css"), path.join(ROOT, "public/theme/vendor/bootstrap.min.css"));
cpSync(path.join(ROOT, "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"), path.join(ROOT, "public/theme/vendor/bootstrap.bundle.min.js"));
cpSync(path.join(ROOT, "node_modules/bootstrap-icons/font"), path.join(ROOT, "public/theme/vendor/bootstrap-icons"), { recursive: true });

console.log("Theme extracted.");

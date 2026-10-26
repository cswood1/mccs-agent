import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import registry from "@/site/installations.json";

/** One page of the recreated site, as captured with WebFetch (see data/site/<id>/pages/). */
export type SitePage = {
  url: string;
  fetchedAt: string;
  title: string;
  breadcrumb: { label: string; url: string }[];
  intro: string;
  sections: { heading: string; level: number; markdown: string }[];
  cards: { title: string; url: string; text: string; image: string }[];
  contacts: {
    name: string;
    address: string;
    phones: { label: string; number: string }[];
    emails: string[];
    hours: { label: string; rows: { days: string; time: string }[] }[];
    notes: string[];
  }[];
  links: { text: string; url: string }[];
  images: { src: string; alt: string }[];
  notCaptured: string;
  /** Suggested-question chips for this page (scripts/chips/generate.mjs). */
  chips: string[];
};

// ---------- installations ----------
// Every site in the real location picker (site/installations.json, from scripts/extract-theme.mjs).
// Each is served at /<slug>/...; ones without captured content show a "coming soon" page.

export type SiteInstallation = { slug: string; name: string; siteUrl: string };
export const SITE_INSTALLATIONS: SiteInstallation[] = registry;
export const DEFAULT_INSTALLATION = "quantico";

export function siteInstallation(slug: string): SiteInstallation | undefined {
  return SITE_INSTALLATIONS.find((i) => i.slug === slug);
}

/** The real site's origin for an installation, e.g. https://quantico.usmc-mccs.org */
export function siteOrigin(slug: string): string {
  return new URL(siteInstallation(slug)?.siteUrl ?? `https://${slug}.usmc-mccs.org/`).origin;
}

/** Installation slug for a real-site hostname, if it's one of ours. */
function slugForHost(host: string): string | undefined {
  const h = host.replace(/^www\./, "");
  return SITE_INSTALLATIONS.find((i) => new URL(i.siteUrl).hostname.replace(/^www\./, "") === h)?.slug;
}

const pagesDir = (inst: string) => path.join(process.cwd(), "data", "site", inst, "pages");

/** Has this installation's site content been captured? */
export function hasSiteContent(inst: string): boolean {
  return existsSync(path.join(pagesDir(inst), "home.json"));
}

/** URL in this app for a page of an installation: ("quantico", "/lodging") -> "/quantico/lodging". */
export function installationHref(inst: string, sitePath: string): string {
  return `/${inst}${sitePath === "/" || !sitePath ? "" : sitePath}`;
}

// ---------- pages ----------

/** "/lodging/c-suites" -> "lodging__c-suites"; "/" -> "home". */
export function slugForPath(p: string) {
  const clean = p.replace(/^\/+|\/+$/g, "");
  return clean ? clean.replaceAll("/", "__") : "home";
}

export function loadPage(inst: string, sitePath: string): SitePage | null {
  const file = path.join(pagesDir(inst), `${slugForPath(sitePath)}.json`);
  if (!existsSync(file)) return null;
  return normalize(JSON.parse(readFileSync(file, "utf8")));
}

/** Site paths ("/", "/lodging", ...) of every captured page of an installation. */
export function allPagePaths(inst: string): string[] {
  if (!existsSync(pagesDir(inst))) return [];
  return readdirSync(pagesDir(inst))
    .filter((f) => f.endsWith(".json"))
    .map((f) => (f === "home.json" ? "/" : "/" + f.slice(0, -5).replaceAll("__", "/")));
}

/** Every captured page under a site-path prefix, e.g. "/news/". */
export function pagesUnder(inst: string, prefix: string): { path: string; page: SitePage }[] {
  return allPagePaths(inst)
    .filter((p) => p.startsWith(prefix))
    .map((p) => ({ path: p, page: loadPage(inst, p)! }))
    .filter((x) => x.page && x.page.title);
}

/**
 * Turn a link into a link within this app: pages on any installation's real site go to
 * /<slug>/<path> (so cross-installation links work too); files (/modules/...) and other
 * sites pass through. Relative links resolve against `inst`'s site.
 */
export function localHref(url: string, inst: string = DEFAULT_INSTALLATION): string {
  if (!url) return "#";
  try {
    const u = new URL(url, siteOrigin(inst));
    const slug = /^https?:$/.test(u.protocol) ? slugForHost(u.hostname) : undefined;
    if (!slug || u.pathname.startsWith("/modules/")) return u.toString();
    return installationHref(slug, u.pathname.replace(/\/+$/, "") || "/") + u.search + u.hash;
  } catch {
    return url;
  }
}

// ---------- theme fragments ----------

const fragmentsDir = (inst: string) => path.join(process.cwd(), "site", "fragments", inst);

/** A captured theme fragment as extracted (links are the capturing site's own paths). */
export function rawFragment(inst: string, name: string): string {
  const dir = existsSync(path.join(fragmentsDir(inst), `${name}.html`)) ? fragmentsDir(inst) : fragmentsDir(DEFAULT_INSTALLATION);
  return readFileSync(path.join(dir, `${name}.html`), "utf8");
}

const themed = new Map<string, string>();

/**
 * A theme fragment ready to render for an installation: internal links get the /<slug> prefix,
 * the location picker's entries switch installations within the app, and the picker button
 * shows the current installation. The CMS theme is shared, so installations without their own
 * capture use Quantico's markup.
 */
export function fragment(inst: string, name: string): string {
  const key = `${inst}:${name}`;
  const cached = themed.get(key);
  if (cached) return cached;

  const $ = cheerio.load(rawFragment(inst, name), null, false);
  const picker = $("#modal-block-views-block-change-location-change-location");
  picker.find("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const slug = href === "/" ? DEFAULT_INSTALLATION : slugForHost(new URL(href, siteOrigin(DEFAULT_INSTALLATION)).hostname);
    if (slug) $(a).attr("href", `/${slug}`).attr("data-installation-link", "");
  });
  $("a[href^='/']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (href.startsWith("//") || $(a).is("[data-installation-link]")) return;
    $(a).attr("href", installationHref(inst, href));
  });
  const name_ = siteInstallation(inst)?.name ?? inst;
  $(".btn-modal > span.text-uppercase").text(name_);

  const html = $.html();
  themed.set(key, html);
  return html;
}

// WebFetch output is mostly well-formed, but be forgiving about missing keys.
function normalize(raw: Partial<SitePage>): SitePage {
  return {
    url: raw.url ?? "",
    fetchedAt: raw.fetchedAt ?? "",
    title: raw.title ?? "",
    breadcrumb: raw.breadcrumb ?? [],
    intro: raw.intro ?? "",
    sections: raw.sections ?? [],
    cards: raw.cards ?? [],
    contacts: (raw.contacts ?? []).map((c) => ({
      name: c.name ?? "",
      address: c.address ?? "",
      phones: c.phones ?? [],
      emails: c.emails ?? [],
      hours: c.hours ?? [],
      notes: c.notes ?? [],
    })),
    links: raw.links ?? [],
    images: raw.images ?? [],
    notCaptured: raw.notCaptured ?? "",
    chips: Array.isArray(raw.chips) ? raw.chips : [],
  };
}

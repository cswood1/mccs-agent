import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

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

export const SITE_ORIGIN = "https://quantico.usmc-mccs.org";
const INSTALLATION = "quantico";
const root = () => path.join(process.cwd(), "data", "site", INSTALLATION, "pages");

/** "/lodging/c-suites" -> "lodging__c-suites"; "/" -> "home". */
export function slugForPath(p: string) {
  const clean = p.replace(/^\/+|\/+$/g, "");
  return clean ? clean.replaceAll("/", "__") : "home";
}

export function loadPage(p: string): SitePage | null {
  const file = path.join(root(), `${slugForPath(p)}.json`);
  if (!existsSync(file)) return null;
  return normalize(JSON.parse(readFileSync(file, "utf8")));
}

export function allPagePaths(): string[] {
  if (!existsSync(root())) return [];
  return readdirSync(root())
    .filter((f) => f.endsWith(".json"))
    .map((f) => (f === "home.json" ? "/" : "/" + f.slice(0, -5).replaceAll("__", "/")));
}

/** Every captured page under a path prefix, e.g. "/news/". */
export function pagesUnder(prefix: string): { path: string; page: SitePage }[] {
  return allPagePaths()
    .filter((p) => p.startsWith(prefix))
    .map((p) => ({ path: p, page: loadPage(p)! }))
    .filter((x) => x.page && x.page.title);
}

/** Theme fragments extracted from the browser capture by scripts/extract-theme.mjs. */
export function fragment(name: string): string {
  return readFileSync(path.join(process.cwd(), "site", "fragments", INSTALLATION, `${name}.html`), "utf8");
}

/** Turn a link on the real site into a link within the recreation. Other hosts pass through. */
export function localHref(url: string): string {
  if (!url) return "#";
  try {
    const u = new URL(url, SITE_ORIGIN);
    if (u.origin !== SITE_ORIGIN || u.pathname.startsWith("/modules/")) return u.toString();
    return (u.pathname.replace(/\/+$/, "") || "/") + u.search + u.hash;
  } catch {
    return url;
  }
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

import { loadPage, siteOrigin } from "@/lib/site/data";

// Page awareness (docs/PRODUCT.md §5–6): what the widget shows and what the agent is told
// about the page someone is on. Titles and breadcrumbs come from our own captured page data
// whenever the path is known, never from the browser.

export type PageInfo = {
  path: string;
  url: string;
  known: boolean;
  title: string;
  breadcrumb: string[];
  chips: string[];
  chipsFrom: "page" | "section" | "home";
};

/**
 * Site path for a page of `inst`: accepts a path or URL from the demo app ("/quantico/lodging")
 * or from the real site ("/lodging"), and returns "/lodging".
 */
export function normalizePath(inst: string, p: string): string {
  try {
    let path = new URL(p, siteOrigin(inst)).pathname.replace(/\/+$/, "") || "/";
    if (path === `/${inst}`) path = "/";
    else if (path.startsWith(`/${inst}/`)) path = path.slice(inst.length + 1);
    return path;
  } catch {
    return "/";
  }
}

/** Chips for a path: the page's own, else the nearest ancestor's (section), else the home set. */
export function pageInfo(inst: string, rawPath: string, defaultChips: string[]): PageInfo {
  const path = normalizePath(inst, rawPath);
  const page = loadPage(inst, path);
  const ancestors = path.split("/").filter(Boolean).map((_, i, parts) => "/" + parts.slice(0, parts.length - 1 - i).join("/"));

  let chips: string[] = [];
  let chipsFrom: PageInfo["chipsFrom"] = "home";
  if (path !== "/" && page?.chips?.length) {
    chips = page.chips;
    chipsFrom = "page";
  } else if (path !== "/") {
    for (const a of ancestors) {
      if (a === "/") break;
      const parent = loadPage(inst, a);
      if (parent?.chips?.length) {
        chips = parent.chips;
        chipsFrom = "section";
        break;
      }
    }
  }
  if (!chips.length) chips = defaultChips;

  const breadcrumb = page?.breadcrumb?.length
    ? page.breadcrumb.map((b) => b.label).filter(Boolean)
    : ancestors
        .filter((a) => a !== "/")
        .reverse()
        .map((a) => loadPage(inst, a)?.title)
        .filter((t): t is string => !!t);

  return {
    path,
    url: siteOrigin(inst) + (path === "/" ? "/" : path),
    known: !!page,
    title: page?.title || "",
    breadcrumb,
    chips: chips.slice(0, 4),
    chipsFrom,
  };
}

/** Untrusted text from the browser: plain, short, no markup. */
export function cleanClientText(s: unknown, max = 100): string {
  return String(s ?? "")
    .replace(/[<>{}\[\]`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

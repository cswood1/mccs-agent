import * as cheerio from "cheerio";
import { rawFragment } from "@/lib/site/data";

export type NavItem = { label: string; href: string; children: NavItem[] };

const cache = new Map<string, NavItem[]>();

/** A menu href as a site path ("/recreation-fitness"); external links pass through. */
function sitePath(href: string | undefined): string {
  const h = href ?? "";
  return h.startsWith("/") && !h.startsWith("//") ? h.replace(/\/+$/, "") || "/" : h;
}

/**
 * Site navigation tree, read from the MENU drawer in the captured header so the side
 * navigation always matches the real menu: section -> program -> sub-page.
 */
export function navTree(inst: string): NavItem[] {
  const hit = cache.get(inst);
  if (hit) return hit;
  const $ = cheerio.load(rawFragment(inst, "header"));
  const text = (el: cheerio.Cheerio<never>) => el.text().replace(/\s+/g, " ").trim();
  const sections: NavItem[] = [];

  $("#offcanvasSidebar .card-body > ul.navbar-nav > li.nav-item").each((_, li) => {
    const top = $(li).children("a").first();
    if (!top.length) return;
    const section: NavItem = { label: text(top as never), href: sitePath(top.attr("href")), children: [] };
    $(li)
      .children("ul")
      .children("li")
      .each((_, sub) => {
        const a = $(sub).children("a").first();
        if (!a.length) return;
        const item: NavItem = { label: text(a as never), href: sitePath(a.attr("href")), children: [] };
        $(sub)
          .find("ul.dropdown-menu a.dropdown-item")
          .each((_, d) => {
            const href = sitePath($(d).attr("href"));
            if (href !== item.href) item.children.push({ label: text($(d) as never), href, children: [] });
          });
        section.children.push(item);
      });
    if (section.href.startsWith("/")) sections.push(section);
  });

  cache.set(inst, sections);
  return sections;
}

/** The menu section a path belongs to (longest matching section prefix), if any. */
export function sectionFor(inst: string, path: string): NavItem | undefined {
  const inSection = (href: string) => path === href || path.startsWith(href + "/");
  return navTree(inst)
    .filter((s) => inSection(s.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Path is this item or below it. */
export function isWithin(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

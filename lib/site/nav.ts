import * as cheerio from "cheerio";
import { fragment, localHref } from "@/lib/site/data";

export type NavItem = { label: string; href: string; children: NavItem[] };

let cached: NavItem[] | null = null;

/**
 * Site navigation tree, read from the MENU drawer in the captured header so the side
 * navigation always matches the real menu: section -> program -> sub-page.
 */
export function navTree(): NavItem[] {
  if (cached) return cached;
  const $ = cheerio.load(fragment("header"));
  const text = (el: cheerio.Cheerio<never>) => el.text().replace(/\s+/g, " ").trim();
  const sections: NavItem[] = [];

  $("#offcanvasSidebar .card-body > ul.navbar-nav > li.nav-item").each((_, li) => {
    const top = $(li).children("a").first();
    if (!top.length) return;
    const section: NavItem = { label: text(top as never), href: localHref(top.attr("href") ?? ""), children: [] };
    $(li)
      .children("ul")
      .children("li")
      .each((_, sub) => {
        const a = $(sub).children("a").first();
        if (!a.length) return;
        const item: NavItem = { label: text(a as never), href: localHref(a.attr("href") ?? ""), children: [] };
        $(sub)
          .find("ul.dropdown-menu a.dropdown-item")
          .each((_, d) => {
            const href = localHref($(d).attr("href") ?? "");
            if (href !== item.href) item.children.push({ label: text($(d) as never), href, children: [] });
          });
        section.children.push(item);
      });
    if (section.href.startsWith("/")) sections.push(section);
  });

  cached = sections;
  return sections;
}

/** The menu section a path belongs to (longest matching section prefix), if any. */
export function sectionFor(path: string): NavItem | undefined {
  const inSection = (href: string) => path === href || path.startsWith(href + "/");
  return navTree()
    .filter((s) => inSection(s.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Path is this item or below it. */
export function isWithin(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

import { corsHeaders, preflight } from "@/lib/cors";
import { getInstallation } from "@/lib/installations";
import { allPagePaths, loadPage } from "@/lib/site/data";

export const OPTIONS = preflight;

/**
 * GET → every captured page's site path, title and breadcrumb, for instant page matches in the
 * header search (docs/PRODUCT.md §13). Static data, no AI calls.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/installations/[id]/pages">) {
  const { id } = await ctx.params;
  const inst = getInstallation(id);
  if (!inst) return Response.json({ error: "Unknown installation" }, { status: 404, headers: corsHeaders });

  const titles = new Map<string, string>();
  const paths = allPagePaths(id);
  for (const p of paths) {
    const page = loadPage(id, p);
    if (page?.title) titles.set(p, page.title);
  }
  const pages = paths
    .filter((p) => p !== "/" && titles.has(p))
    .map((p) => {
      const page = loadPage(id, p)!;
      // Breadcrumb from the capture, else from the titles of the page's ancestors.
      const parts = p.split("/").filter(Boolean);
      const breadcrumb = page.breadcrumb.length
        ? page.breadcrumb.map((b) => b.label).filter(Boolean).slice(0, -1)
        : parts.slice(0, -1).map((_, i) => titles.get("/" + parts.slice(0, i + 1).join("/"))).filter((t): t is string => !!t);
      const kind = p.startsWith("/news/") ? "story" : p.startsWith("/activity/") ? "event" : "page";
      return { path: p, title: titles.get(p)!, breadcrumb, kind };
    });
  return Response.json({ pages }, { headers: { ...corsHeaders, "Cache-Control": "private, max-age=600" } });
}

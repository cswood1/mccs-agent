import { corsHeaders, preflight } from "@/lib/cors";
import { getInstallation } from "@/lib/installations";
import { pageInfo } from "@/lib/site/context";

export const OPTIONS = preflight;

/** GET ?path=/recreation-fitness/fitness → title, breadcrumb and chips for that page. No AI calls. */
export async function GET(request: Request, ctx: RouteContext<"/api/installations/[id]/page">) {
  const { id } = await ctx.params;
  const inst = getInstallation(id);
  if (!inst) return Response.json({ error: "Unknown installation" }, { status: 404, headers: corsHeaders });
  const path = new URL(request.url).searchParams.get("path") || "/";
  const info = pageInfo(inst.id, path, inst.defaultChips);
  return Response.json(
    { ...info, welcome: info.known && info.path !== "/" ? `Questions about ${info.title}? I can help.` : inst.welcomeMessage },
    { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}

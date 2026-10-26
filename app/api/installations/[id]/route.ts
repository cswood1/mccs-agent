import { corsHeaders, preflight } from "@/lib/cors";
import { getInstallation, loadContent } from "@/lib/installations";

export const OPTIONS = preflight;

/** Public, display-only settings the widget needs to render itself. */
export async function GET(_request: Request, ctx: RouteContext<"/api/installations/[id]">) {
  const { id } = await ctx.params;
  const inst = getInstallation(id);
  if (!inst) return Response.json({ error: "Unknown installation" }, { status: 404, headers: corsHeaders });

  const content = await loadContent(inst.id);
  return Response.json(
    {
      id: inst.id,
      name: inst.name,
      assistantName: inst.assistantName,
      siteUrl: inst.siteUrl,
      welcomeMessage: inst.welcomeMessage,
      suggestedQuestions: inst.suggestedQuestions,
      theme: inst.theme,
      sample: content.sample,
    },
    { headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  );
}

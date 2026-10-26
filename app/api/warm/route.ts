import Anthropic from "@anthropic-ai/sdk";
import { agentRequest } from "@/lib/agent";
import { corsHeaders, preflight } from "@/lib/cors";
import { getInstallation, loadContent } from "@/lib/installations";
import { buildContentBlock } from "@/lib/prompt";

// Pre-warm the prompt cache (max_tokens: 0) so the first real question doesn't pay the
// cold-cache delay. The widget calls this when someone opens the chat panel. If the cache
// is already warm this is just a cheap cache read.
const MIN_INTERVAL_MS = 50 * 60 * 1000; // cache entries live 1 hour
const lastWarm = new Map<string, number>(); // per server instance; the widget throttles too

export const OPTIONS = preflight;

export async function POST(request: Request) {
  const { installationId } = await request.json().catch(() => ({}));
  const installation = getInstallation(String(installationId ?? ""));
  if (!installation) return Response.json({ error: "Unknown installation" }, { status: 404, headers: corsHeaders });

  const last = lastWarm.get(installation.id) ?? 0;
  if (Date.now() - last < MIN_INTERVAL_MS) return Response.json({ warmed: false, reason: "recent" }, { headers: corsHeaders });
  lastWarm.set(installation.id, Date.now());

  try {
    const content = await loadContent(installation.id);
    const res = await new Anthropic().beta.messages.create({
      ...agentRequest(installation, content),
      max_tokens: 0,
      // The breakpoint on the content block is the same one real requests use; the
      // placeholder after it is never answered.
      messages: [{ role: "user", content: [buildContentBlock(installation, content), { type: "text", text: "warmup" }] }],
    });
    const u = res.usage;
    console.log(`[warm] ${installation.id} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0}`);
    return Response.json({ warmed: true }, { headers: corsHeaders });
  } catch (err) {
    lastWarm.delete(installation.id);
    console.error("[warm] error", err);
    return Response.json({ warmed: false, reason: "error" }, { status: 502, headers: corsHeaders });
  }
}

import type Anthropic from "@anthropic-ai/sdk";
import type { InstallationConfig, InstallationContent } from "@/lib/installations";
import { buildSystemPrompt } from "@/lib/prompt";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
// Chat answers are short lookups; low effort keeps them fast. Raise if answers to
// multi-step questions get thin.
const EFFORT = (process.env.CLAUDE_EFFORT || "low") as "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Request settings shared by real chat requests and cache pre-warming. Everything here is
 * part of the cached prefix (tools, system, thinking/effort), so both must use exactly this.
 */
export function agentRequest(inst: InstallationConfig, content: InstallationContent) {
  return {
    model: MODEL,
    thinking: { type: "adaptive" } as const,
    output_config: { effort: EFFORT },
    // On a safety-classifier decline, the API re-runs the request on a recommended model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    system: buildSystemPrompt(inst, content),
    tools: liveWebTools(inst.trustedDomains),
  };
}

/**
 * Live lookups, restricted to the installation site and a few official sites.
 * Both run on Anthropic's servers; nothing to execute here.
 */
function liveWebTools(trustedDomains: string[]): Anthropic.Beta.BetaToolUnion[] {
  return [
    {
      type: "web_fetch_20260318",
      name: "web_fetch",
      allowed_domains: trustedDomains,
      max_uses: 3,
      max_content_tokens: 20000,
    },
    {
      type: "web_search_20260318",
      name: "web_search",
      allowed_domains: trustedDomains,
      max_uses: 2,
    },
  ];
}

import type Anthropic from "@anthropic-ai/sdk";
import { getInstallation, loadContent, type InstallationConfig } from "@/lib/installations";

/**
 * Cross-installation questions (docs/PRODUCT.md §12): "I'm PCSing to Pendleton next month, what
 * should I set up?" asked on the Quantico site. Each conversation only carries its own base's
 * content (cached); other bases' pages are searched on demand with this tool, so the cost per
 * conversation stays the same unless someone actually asks about another base.
 */

/** Bases with full content, in a fixed order (part of the cached prompt prefix, so deterministic). */
export const COVERED_INSTALLATIONS = ["quantico", "pendleton", "lejeune"];

export const CROSS_BASE_TOOL = "other_installation_pages";
const MAX_PAGES = 4;
const MAX_PAGE_CHARS = 3500;

export function otherInstallations(currentId: string): InstallationConfig[] {
  return COVERED_INSTALLATIONS.filter((id) => id !== currentId)
    .map((id) => getInstallation(id))
    .filter((i): i is InstallationConfig => !!i);
}

/** Tool definition. Its text is part of the cached prefix: keep it free of per-request data. */
export function crossBaseTool(currentId: string): Anthropic.Beta.BetaTool | null {
  const others = otherInstallations(currentId);
  if (!others.length) return null;
  return {
    name: CROSS_BASE_TOOL,
    description:
      "Search the saved pages of another MCCS installation's website that this assistant also covers. Use it only when the person asks about that other base (PCSing there, visiting, comparing). Returns the few most relevant pages with their url, title, saved date and text. Cite those urls like any other page.",
    input_schema: {
      type: "object",
      properties: {
        installation: {
          type: "string",
          enum: others.map((i) => i.id),
          description: others.map((i) => `${i.id}: ${i.name} (${i.location})`).join("; "),
        },
        query: {
          type: "string",
          description: "What to look up on that base's site, in a few words, e.g. \"child development centers\" or \"new arrivals PCS checklist\".",
        },
      },
      required: ["installation", "query"],
    },
    // Tool input streams as it's generated; the input is validated before running.
    eager_input_streaming: true,
  };
}

const STOP = new Set(
  "a an and are at base can do does for from get how i in is it me my of on or our the to what when where which who with you your there this that be need want next month set up".split(" "),
);
const terms = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));

/**
 * Status line shown while the cross-base tool runs, from its (possibly partial) JSON input:
 * "Checking Camp Pendleton’s pages…". Display text only; never part of the prompt.
 */
export function crossBaseStatus(inputJson: string): string {
  const id = inputJson.match(/"installation"\s*:\s*"([a-z]+)"/)?.[1];
  const name = id ? getInstallation(id)?.shortName.replace(/^MCB\s+/, "") : undefined;
  return name ? `Checking ${name}’s pages…` : "Checking another installation’s pages…";
}

/** Runs the tool. Returns the text for the tool_result and whether it's an error. */
export async function runCrossBaseTool(currentId: string, input: unknown): Promise<{ text: string; isError: boolean }> {
  const { installation, query } = (input ?? {}) as { installation?: unknown; query?: unknown };
  const allowed = otherInstallations(currentId).map((i) => i.id);
  if (typeof installation !== "string" || !allowed.includes(installation) || typeof query !== "string" || !query.trim()) {
    return { text: `Invalid input. Use installation one of ${allowed.join(", ")} and a short query.`, isError: true };
  }
  const inst = getInstallation(installation)!;
  const content = await loadContent(installation);
  if (!content || content.sample) return { text: `No saved content for ${inst.name}.`, isError: true };

  const q = terms(query.slice(0, 200));
  if (!q.length) return { text: "Query had no searchable words. Try a topic like \"fitness centers\".", isError: true };
  const scored = content.pages
    .filter((p) => !/\/news\//.test(p.url))
    .map((p) => {
      const title = terms(p.title).join(" ");
      const path = terms(new URL(p.url).pathname.replace(/\//g, " ")).join(" ");
      const body = p.text.toLowerCase();
      let score = 0;
      for (const t of q) {
        if (title.includes(t)) score += 6;
        if (path.includes(t)) score += 3;
        const hits = body.split(t).length - 1;
        score += Math.min(hits, 8) * 0.5;
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PAGES);

  if (!scored.length) {
    return { text: `No ${inst.name} pages matched "${query}". Their site: ${inst.siteUrl}`, isError: false };
  }
  const pages = scored
    .map(({ p }) => {
      const text = p.text.length > MAX_PAGE_CHARS ? p.text.slice(0, MAX_PAGE_CHARS) + "\n…(page continues)" : p.text;
      return `<page url="${p.url}" title="${p.title.replace(/"/g, "&quot;")}"${p.savedAt ? ` saved="${p.savedAt}"` : ""}>\n${text}\n</page>`;
    })
    .join("\n\n");
  return { text: `<installation_content site="${inst.siteUrl}" name="${inst.name}">\n${pages}\n</installation_content>`, isError: false };
}

/**
 * The per-turn system note, sent after the cached prefix (tools, system prompt, content block), so
 * nothing here ever changes what's cached: today's date, the answer-length rule, and optionally
 * who's asking (front-door audience tabs) and plan mode (a structured plan instead of a short answer).
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { InstallationConfig, InstallationContent } from "@/lib/installations";
import { buildContentBlock } from "@/lib/prompt";

// docs/PRODUCT.md section 4, restated each turn.
export const REPLY_REMINDER =
  "Keep this reply under 60 words (under 120 only if they asked how to do a multi-step process): the direct answer, the key specifics, then at most one offer to go deeper. Leave out caveats, eligibility lists, and other options unless they asked. When there are several options or events, name the top two and offer the rest. End with the <followups> line.";

/** Front-door audience tabs: id → how the note names them. */
export const AUDIENCES: Record<string, string> = {
  marine: "Marine",
  family: "Marine family member",
  retiree: "retiree or veteran",
  community: "community member",
};

export type PlanKind = "arrival" | "workout";
export const PLAN_KINDS: PlanKind[] = ["arrival", "workout"];

/** Plans are long JSON; plain answers keep the usual budget. */
export const MAX_TOKENS = 16000;
export const PLAN_MAX_TOKENS = 32000;

const PLAN_SCHEMA =
  '{"title": string, "sections": [{"name": string, "items": [{"task": string, "detail"?: string, "where"?: string, "when"?: string, "phone"?: string, "sourceUrl"?: string, "confirm"?: boolean}]}]}';

const PLAN_SECTIONS: Record<PlanKind, string> = {
  arrival:
    'An arrival plan. Sections, in order: "This week", "First 30 days", "When you’re settled". Cover check-in essentials, newcomer orientation and family readiness, child care if it fits, fitness, and getting to know the base and local area.',
  workout:
    'A weekly workout plan. Seven sections, in order: "Monday" through "Sunday". Use this installation’s real fitness centers, pools and published class schedules, with a mix of group classes, open gym, pool sessions and rest days (a rest day is one item such as "Rest and stretch"). Put a class time in "when" only when the content publishes it.',
};

export function planInstruction(kind: PlanKind): string {
  return [
    `Plan mode. ${PLAN_SECTIONS[kind]}`,
    "Reply with one short intro sentence, then a single fenced code block with the info string plan (```plan), holding only JSON in this shape:",
    PLAN_SCHEMA,
    "Use only facts from the MCCS content (or MCCS pages you fetch). Never invent dates, times or phone numbers: leave the field out instead. Set \"confirm\": true on any item whose hours, dates or details aren’t published. sourceUrl is the MCCS page the item comes from. 3–6 items per section, each task under 10 words, each detail under 25 words.",
    "Write nothing after the block except the <followups> line.",
  ].join("\n");
}

export type TurnOptions = { audience?: unknown; mode?: unknown; kind?: unknown };

/** Plan kind when the request asks for plan mode with a known kind; otherwise null. */
export function planKind(body: TurnOptions): PlanKind | null {
  return body.mode === "plan" && PLAN_KINDS.includes(body.kind as PlanKind) ? (body.kind as PlanKind) : null;
}

export function audienceLine(audience: unknown): string | null {
  const who = typeof audience === "string" && Object.hasOwn(AUDIENCES, audience) ? AUDIENCES[audience] : null;
  return who ? `The user is a ${who}; tailor to them.` : null;
}

/** The trailing system note for this turn. */
export function turnNote(body: TurnOptions, today: string): string {
  const kind = planKind(body);
  const lines = [`Today is ${today}. ${kind ? planInstruction(kind) : REPLY_REMINDER}`];
  const who = audienceLine(body.audience);
  if (who) lines.push(who);
  return lines.join("\n");
}

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The messages for one chat request: saved site content first in the first user turn (cached),
 * then the conversation; the latest question carries the page note (after the cached prefix), and
 * the trailing system note carries the date, the length rule or plan instruction, and the audience.
 */
export function buildMessages(
  inst: InstallationConfig,
  content: InstallationContent,
  turns: Turn[],
  pageNote: string | null,
  options: TurnOptions,
  today: string,
): Anthropic.Beta.BetaMessageParam[] {
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m, i) => {
    if (m.role !== "user") return { role: "assistant", content: m.content };
    const blocks: Anthropic.Beta.BetaTextBlockParam[] = [];
    if (i === 0) blocks.push(buildContentBlock(inst, content));
    if (i === turns.length - 1 && pageNote) blocks.push({ type: "text", text: pageNote });
    blocks.push({ type: "text", text: m.content });
    return { role: "user", content: blocks };
  });
  // Restated right before it answers, where the model follows it far better.
  return [...messages, { role: "system", content: turnNote(options, today) }];
}

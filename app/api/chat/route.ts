import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { getInstallation, loadContent } from "@/lib/installations";
import { agentRequest } from "@/lib/agent";
import { rateLimit } from "@/lib/ratelimit";
import { buildContentBlock } from "@/lib/prompt";
import { cleanClientText, pageInfo } from "@/lib/site/context";

// docs/PRODUCT.md section 4, restated each turn.
const REPLY_REMINDER =
  "Keep this reply under 60 words (under 120 only if they asked how to do a multi-step process): the direct answer, the key specifics, then at most one offer to go deeper. Leave out caveats, eligibility lists, and other options unless they asked. When there are several options or events, name the top two and offer the rest. End with the <followups> line.";

// Separates the answer text from the follow-up chips in the response stream (ASCII record separator).
const FRAME = "\u001e";

const MAX_MESSAGES = 30;
const MAX_CONTINUATIONS = 2;
const MAX_MESSAGE_CHARS = 4000;

type PageRef = { url?: string; path?: string; title?: string; breadcrumb?: string[] };

type ChatRequest = {
  installationId: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** The page the person is on, and up to 5 pages they visited before it (most recent first). */
  page?: PageRef;
  trail?: PageRef[];
};

export const OPTIONS = preflight;

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const installation = getInstallation(String(body?.installationId ?? ""));
  if (!installation) return jsonError("Unknown installation", 404);

  const problem = validateMessages(body.messages);
  if (problem) return jsonError(problem, 400);

  const content = await loadContent(installation.id);
  if (!content) {
    return jsonError(`The ${installation.name} assistant isn't loaded in this demo yet. Try the Quantico demo for now.`, 503);
  }

  const limited = await rateLimit(request, "chat");
  if (limited) return limited;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) {
    return jsonError("Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.", 500);
  }
  const client = new Anthropic();

  const shared = agentRequest(installation, content);

  // Saved site content goes first in the first user turn (cached), then the conversation.
  // The latest question carries a page-context note (after the cached prefix), and a trailing
  // system note carries today's date and the length rule.
  const pageNote = buildPageNote(body, installation.id, installation.defaultChips);
  const turns: Anthropic.Beta.BetaMessageParam[] = body.messages.map((m, i) => {
    if (m.role !== "user") return { role: "assistant", content: m.content };
    const blocks: Anthropic.Beta.BetaTextBlockParam[] = [];
    if (i === 0) blocks.push(buildContentBlock(installation, content));
    if (i === body.messages.length - 1 && pageNote) blocks.push({ type: "text", text: pageNote });
    blocks.push({ type: "text", text: m.content });
    return { role: "user", content: blocks };
  });
  let messages: Anthropic.Beta.BetaMessageParam[] = [
    ...turns,
    // Per-turn note after the cached prefix: today's date, plus the length rule, which the
    // model follows far better when it's restated right before it answers.
    { role: "system", content: `Today is ${today()}. ${REPLY_REMINDER}` },
  ];

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      const answer = new FollowupSplitter(write);
      const send = (text: string) => answer.push(text);
      let sentText = false;
      try {
        // Server tools run in a server-side loop that can pause; resume a couple of times.
        for (let attempt = 0; attempt < MAX_CONTINUATIONS + 1; attempt++) {
          const stream = client.beta.messages.stream(
            {
              ...shared,
              max_tokens: 16000,
              // Also cache the growing conversation (5-minute TTL), so follow-up turns are cheap.
              cache_control: { type: "ephemeral" },
              messages,
            },
            { signal: abort.signal },
          );

          let afterTool = false;
          for await (const event of stream) {
            // Separate text written before and after a tool call. (Consecutive text blocks,
            // e.g. around a quoted passage, are one flow of text and need no break.)
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                if (afterTool && sentText) send("\n\n");
                afterTool = false;
              } else if (event.content_block.type !== "thinking") {
                afterTool = true;
              }
            }
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send(event.delta.text);
              sentText = true;
            }
          }

          const final = await stream.finalMessage();
          logTurn(installation.id, final);
          if (final.stop_reason === "pause_turn") {
            messages = [...messages, { role: "assistant", content: final.content }];
            continue;
          }
          if (final.stop_reason === "refusal") {
            send("\n\nSorry, I can't help with that one. Please check the MCCS site or contact the office directly.");
          } else if (final.stop_reason === "max_tokens") {
            send("\n\n(Answer cut off. Try asking a narrower question.)");
          }
          break;
        }
        // Follow-up chips go after the answer as one JSON frame.
        const followups = answer.finish();
        if (followups.length) write(FRAME + JSON.stringify({ followups }));
      } catch (err) {
        if (request.signal.aborted) return;
        console.error("[chat] error", err);
        answer.finish();
        write(`\n\n${friendlyError(err)}`);
      } finally {
        try {
          controller.close();
        } catch {
          // already closed (client disconnected)
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * The page note for the latest question. Titles come from our own page data when the path is
 * known; anything from the browser is cleaned and capped. Wrapped as website data so it can't
 * pass for instructions.
 */
function buildPageNote(body: ChatRequest, inst: string, defaultChips: string[]): string | null {
  const describe = (ref: PageRef | undefined) => {
    if (!ref || (!ref.path && !ref.url)) return null;
    const info = pageInfo(inst, String(ref.path || ref.url), defaultChips);
    const title = info.known ? info.title : cleanClientText(ref.title);
    const breadcrumb = info.breadcrumb.length ? info.breadcrumb : (Array.isArray(ref.breadcrumb) ? ref.breadcrumb : []).map((b) => cleanClientText(b, 60)).filter(Boolean).slice(0, 6);
    return { title: title || (info.path === "/" ? "Home" : info.path), url: info.url, breadcrumb };
  };
  const current = describe(body.page);
  if (!current) return null;
  const trail = (Array.isArray(body.trail) ? body.trail : [])
    .slice(0, 5)
    .map(describe)
    .filter((t): t is NonNullable<typeof t> => !!t && t.url !== current.url);
  const lines = [
    "<page_context>",
    "(From the website, not typed by the person.)",
    `Viewing: ${current.title} — ${current.url}`,
  ];
  if (current.breadcrumb.length) lines.push(`Breadcrumb: ${current.breadcrumb.join(" > ")}`);
  if (trail.length) lines.push(`Earlier this visit (most recent first): ${trail.map((t) => `${t.title} (${t.url})`).join("; ")}`);
  lines.push("</page_context>");
  return lines.join("\n");
}

/**
 * Streams answer text through, but holds back and captures the trailing
 * <followups>["…","…"]</followups> line so it never reaches the visitor as text.
 */
class FollowupSplitter {
  private buffer = "";
  private captured: string | null = null;
  constructor(private out: (text: string) => void) {}

  push(text: string) {
    if (this.captured !== null) {
      this.captured += text;
      return;
    }
    this.buffer += text;
    const start = this.buffer.indexOf("<followups>");
    if (start >= 0) {
      this.out(this.buffer.slice(0, start));
      this.captured = this.buffer.slice(start);
      this.buffer = "";
      return;
    }
    // Hold back a tail that might be the start of the tag.
    const hold = longestTagPrefixSuffix(this.buffer, "<followups>");
    this.out(this.buffer.slice(0, this.buffer.length - hold));
    this.buffer = this.buffer.slice(this.buffer.length - hold);
  }

  /** Flush any held text and return the parsed follow-ups. */
  finish(): string[] {
    if (this.buffer) this.out(this.buffer);
    this.buffer = "";
    const json = this.captured?.match(/<followups>([\s\S]*?)(<\/followups>|$)/)?.[1];
    this.captured = null;
    if (!json) return [];
    try {
      const arr = JSON.parse(json.trim());
      return Array.isArray(arr)
        ? arr.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 60)).filter(Boolean).slice(0, 2)
        : [];
    } catch {
      return [];
    }
  }
}

function longestTagPrefixSuffix(text: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}

/** Date and local time at the installation, so "open right now?" can be answered. */
function today() {
  const now = new Date();
  const opts = { timeZone: "America/New_York" } as const;
  const date = now.toLocaleDateString("en-US", { ...opts, weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const time = now.toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit" });
  return `${date}, ${time} Eastern`;
}

function logTurn(installationId: string, final: Anthropic.Beta.BetaMessage) {
  const u = final.usage;
  const blocks = final.content.map((b) => b.type).join(",");
  console.log(
    `[chat] ${installationId} model=${final.model} stop=${final.stop_reason} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens} blocks=${blocks}`,
  );
  for (const block of final.content) {
    if (block.type === "server_tool_use") {
      console.log(`[chat]   ${block.name} ${JSON.stringify(block.input)}`);
    } else if (block.type === "web_fetch_tool_result") {
      const c = block.content;
      console.log(`[chat]   fetch result: ${c.type === "web_fetch_result" ? `ok ${c.url}` : `error ${c.error_code}`}`);
    } else if (block.type === "web_search_tool_result") {
      const c = block.content;
      console.log(`[chat]   search result: ${Array.isArray(c) ? `${c.length} results` : `error ${c.error_code}`}`);
    }
  }
}

function validateMessages(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return "messages must be a non-empty array";
  if (messages.length > MAX_MESSAGES) return `Conversation too long (max ${MAX_MESSAGES} messages). Start a new chat.`;
  for (const [i, m] of messages.entries()) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim()) {
      return `messages[${i}] must be {role: "user" | "assistant", content: non-empty string}`;
    }
    if (m.content.length > MAX_MESSAGE_CHARS) return `messages[${i}] is too long (max ${MAX_MESSAGE_CHARS} characters)`;
  }
  if (messages[0].role !== "user" || messages.at(-1).role !== "user") {
    return "Conversation must start and end with a user message";
  }
  return null;
}

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The assistant isn't configured correctly (invalid API key).";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The assistant is busy right now. Please try again in a moment.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Something went wrong (error ${err.status ?? "unknown"}). Please try again.`;
  }
  return "Something went wrong. Please try again.";
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: corsHeaders });
}

import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { getInstallation, loadContent } from "@/lib/installations";
import { agentRequest } from "@/lib/agent";
import { buildContentBlock } from "@/lib/prompt";

// docs/PRODUCT.md section 4, restated each turn.
const REPLY_REMINDER =
  "Keep this reply under 60 words (under 120 only if they asked how to do a multi-step process): the direct answer, the key specifics, then at most one offer to go deeper. Leave out caveats, eligibility lists, and other options unless they asked.";

const MAX_MESSAGES = 30;
const MAX_CONTINUATIONS = 2;
const MAX_MESSAGE_CHARS = 4000;

type ChatRequest = {
  installationId: string;
  messages: { role: "user" | "assistant"; content: string }[];
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

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && !process.env.ANTHROPIC_PROFILE) {
    return jsonError("Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.", 500);
  }
  const client = new Anthropic();

  const content = await loadContent(installation.id);
  const shared = agentRequest(installation, content);

  // Saved site content goes first in the first user turn (cached), then the conversation.
  // A trailing system note carries today's date without breaking the cached prefix.
  const [first, ...rest] = body.messages;
  let messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: [buildContentBlock(installation, content), { type: "text", text: first.content }] },
    ...rest,
    // Per-turn note after the cached prefix: today's date, plus the length rule, which the
    // model follows far better when it's restated right before it answers.
    { role: "system", content: `Today is ${today()}. ${REPLY_REMINDER}` },
  ];

  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
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
      } catch (err) {
        if (request.signal.aborted) return;
        console.error("[chat] error", err);
        send(`\n\n${friendlyError(err)}`);
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

function today() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
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

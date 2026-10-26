import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { getInstallation, loadContent } from "@/lib/installations";
import { buildSystemPrompt } from "@/lib/prompt";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
// Chat answers are short lookups; low effort keeps them fast. Raise if answers to
// multi-step questions get thin.
const EFFORT = (process.env.CLAUDE_EFFORT || "low") as "low" | "medium" | "high" | "xhigh" | "max";

const MAX_MESSAGES = 30;
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
  const system = buildSystemPrompt(installation, content);

  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      // On a safety-classifier decline, the API re-runs the request on a recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      // Also cache the growing conversation, so follow-up turns are cheap.
      cache_control: { type: "ephemeral" },
      messages: body.messages,
    },
    { signal: request.signal },
  );

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send(event.delta.text);
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send("\n\nSorry, I can't help with that one. Please check the MCCS site or contact the office directly.");
        } else if (final.stop_reason === "max_tokens") {
          send("\n\n(Answer cut off. Try asking a narrower question.)");
        }
        const u = final.usage;
        console.log(
          `[chat] ${installation.id} model=${final.model} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
        );
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
      stream.abort();
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

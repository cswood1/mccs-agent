import { getCache } from "@vercel/functions";
import { corsHeaders } from "@/lib/cors";
import { VISITOR_COOKIE } from "@/lib/visitor";

// Per-visitor rate limits for the paid API routes. Fixed one-hour windows, counted in
// Vercel's Runtime Cache (shared by the functions in a region; in-memory when run locally).
// Increments aren't atomic, so a burst can slip a request or two past the limit; fine for a
// demo, not for billing.
//
// On by default only in production (local dev and evals aren't throttled). RATE_LIMIT=on
// turns it on anywhere, for testing.

const WINDOW_SECONDS = 3600;

export const LIMITS = {
  chat: 20, // messages per visitor per hour
  warm: 6, // the widget warms at most once per 50 minutes; this just caps abuse
} as const;

const enabled = () => process.env.RATE_LIMIT === "on" || (process.env.VERCEL_ENV === "production" && process.env.RATE_LIMIT !== "off");

/** The visitor cookie set by proxy.ts, or the client IP when there's no cookie (cross-site widget). */
function visitorKey(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  const id = cookie.match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([\\w-]{8,64})`))?.[1];
  if (id) return `v:${id}`;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

/**
 * Count this request. Returns a 429 response when the visitor is over the limit, otherwise null.
 */
export async function rateLimit(request: Request, route: keyof typeof LIMITS): Promise<Response | null> {
  if (!enabled()) return null;
  const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SECONDS) * WINDOW_SECONDS;
  const key = `rl:${route}:${visitorKey(request)}:${windowStart}`;
  const cache = getCache({ namespace: "mccs" });
  const count = Number((await cache.get(key)) ?? 0);
  if (count >= LIMITS[route]) {
    const retryAfter = windowStart + WINDOW_SECONDS - Math.floor(Date.now() / 1000);
    return Response.json(
      { error: "You've reached the demo's limit of questions for this hour. Please try again a little later." },
      { status: 429, headers: { ...corsHeaders, "Retry-After": String(Math.max(retryAfter, 1)) } },
    );
  }
  await cache.set(key, count + 1, { ttl: WINDOW_SECONDS, name: `rate-limit-${route}` });
  return null;
}

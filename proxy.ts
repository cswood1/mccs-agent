import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, ACCESS_HEADER, accessCode, accessToken, safeEqual } from "@/lib/access";
import { corsHeaders } from "@/lib/cors";
import { VISITOR_COOKIE } from "@/lib/visitor";
import registry from "@/site/installations.json";

// 1. Sends pre-multi-installation URLs (/lodging, /recreation-fitness/...) to /quantico/...
//    ("/" itself is the front door, app/(front)/page.tsx).
// 2. Gives every browser an anonymous visitor id (a random cookie) for per-visitor rate limits.
// 3. Access-code gate for the demo (see lib/access.ts). No-op when DEMO_ACCESS_CODE is unset.
export async function proxy(request: NextRequest) {
  const moved = legacyRedirect(request);
  if (moved) return withVisitorId(request, moved);
  return withVisitorId(request, await gate(request));
}

const INSTALLATION_SLUGS = new Set(registry.map((i) => i.slug));
// First path segments that belong to the app itself, not to an installation's pages.
// ("home" holds the front door's images.)
const APP_PATHS = new Set(["api", "access", "bookmarklet.html", "embed-test.html", "home"]);
// Slugs that changed (the app uses a shorter name than the site's subdomain).
const RENAMED: Record<string, string> = { lejeunenewriver: "lejeune" };

/** "/lodging/c-suites" -> "/quantico/lodging/c-suites" (308); "/lejeunenewriver/x" -> "/lejeune/x". */
function legacyRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname === "/") return null;
  const first = pathname.split("/")[1] ?? "";
  if (INSTALLATION_SLUGS.has(first) || APP_PATHS.has(first)) return null;
  const url = request.nextUrl.clone();
  if (RENAMED[first]) {
    url.pathname = `/${RENAMED[first]}${pathname.slice(first.length + 1)}`;
    return NextResponse.redirect(url, 308);
  }
  url.pathname = `/quantico${pathname}`;
  return NextResponse.redirect(url, 308);
}

async function gate(request: NextRequest): Promise<NextResponse> {
  const code = accessCode();
  if (!code) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/access" || pathname === "/api/access") return NextResponse.next();
  // CORS preflights never carry cookies or custom header values.
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
  const header = request.headers.get(ACCESS_HEADER) ?? "";
  if (safeEqual(cookie, await accessToken(code)) || (header && safeEqual(header, code))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Access code required" }, { status: 401, headers: corsHeaders });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/access";
  url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

function withVisitorId(request: NextRequest, response: NextResponse): NextResponse {
  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  // Everything except framework assets and the theme's static files (CSS, fonts, logo).
  // widget.js is static code with no data; the bookmarklet loads it cross-site, where the cookie is not sent.
  // The tab and home-screen icons load without the code, so they show on the access page too.
  matcher: ["/((?!_next/static|_next/image|theme/|icon.svg|apple-icon.png|robots.txt|widget.js).*)"],
};

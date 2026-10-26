import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, ACCESS_HEADER, accessCode, accessToken, safeEqual } from "@/lib/access";
import { corsHeaders } from "@/lib/cors";

// Access-code gate for the demo (see lib/access.ts). No-op when DEMO_ACCESS_CODE is unset.
export async function proxy(request: NextRequest) {
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

export const config = {
  // Everything except framework assets and the theme's static files (CSS, fonts, logo).
  // widget.js is static code with no data; the bookmarklet loads it cross-site, where the cookie is not sent.
  matcher: ["/((?!_next/static|_next/image|theme/|favicon.ico|robots.txt|widget.js).*)"],
};

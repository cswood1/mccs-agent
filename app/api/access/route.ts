import {
  ACCESS_COOKIE,
  accessCode,
  accessToken,
  PRESENTER_COOKIE,
  PRESENTER_MAX_AGE,
  presenterCode,
  presenterToken,
  safeEqual,
} from "@/lib/access";

/**
 * POST {code}: sets the access cookie if the code matches DEMO_ACCESS_CODE. PRESENTER_CODE (if set)
 * also grants access, and adds the presenter cookie that skips the rate limits. Codes are never
 * logged.
 */
export async function POST(request: Request) {
  const access = accessCode();
  const presenter = presenterCode();
  if (!access && !presenter) return Response.json({ ok: true });

  let code = "";
  try {
    code = String((await request.json())?.code ?? "").trim();
  } catch {
    // fall through to the mismatch response
  }
  const matches = (expected: string | undefined) => !!expected && safeEqual(code.toLowerCase(), expected.toLowerCase());
  const isPresenter = matches(presenter);
  const isAccess = matches(access);
  if (!isPresenter && !isAccess) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "That code isn't right." }, { status: 401 });
  }

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const headers = new Headers();
  if (access) headers.append("Set-Cookie", `${ACCESS_COOKIE}=${await accessToken(access)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`);
  if (isPresenter && presenter) {
    headers.append("Set-Cookie", `${PRESENTER_COOKIE}=${await presenterToken(presenter)}; Path=/; Max-Age=${PRESENTER_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`);
  }
  return Response.json({ ok: true }, { headers });
}

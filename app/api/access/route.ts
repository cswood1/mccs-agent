import { ACCESS_COOKIE, accessCode, accessToken, safeEqual } from "@/lib/access";

/** POST {code} — sets the access cookie if the code matches DEMO_ACCESS_CODE. */
export async function POST(request: Request) {
  const expected = accessCode();
  if (!expected) return Response.json({ ok: true });

  let code = "";
  try {
    code = String((await request.json())?.code ?? "").trim();
  } catch {
    // fall through to the mismatch response
  }
  if (!safeEqual(code.toLowerCase(), expected.toLowerCase())) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "That code isn't right." }, { status: 401 });
  }

  const secure = new URL(request.url).protocol === "https:";
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${ACCESS_COOKIE}=${await accessToken(expected)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
      },
    },
  );
}

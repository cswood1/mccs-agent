// Demo access code. When DEMO_ACCESS_CODE is set, every page and API route needs it;
// when it's unset, the site is public. The browser keeps a hash of the code in a cookie
// so people enter it once.

export const ACCESS_COOKIE = "mccs_demo_access";
/** Header the widget sends when it runs on another site (the bookmarklet), where our cookie isn't sent. */
export const ACCESS_HEADER = "x-demo-access";

export function accessCode(): string | undefined {
  return process.env.DEMO_ACCESS_CODE?.trim() || undefined;
}

/** Cookie value: a hash of the code, so the code itself isn't stored in the browser. */
export async function accessToken(code: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mccs-demo-access:${code}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Rate limits and presenter mode, checked against the real modules with stubbed requests: no
 * server, no Claude calls. Uses test-only codes (never the real ones).
 *
 *   node --import ./tests/unit/alias-hooks.mjs tests/unit/limits-check.mjs
 */
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

// Test settings. RATE_LIMIT=on turns limiting on outside production; the counter is the in-memory
// Runtime Cache fallback.
process.env.RATE_LIMIT = "on";
process.env.DEMO_ACCESS_CODE = "test-access-code";
process.env.PRESENTER_CODE = "test-presenter-code";

const { rateLimit, limitFor, LIMIT_MESSAGE } = await import("../../lib/ratelimit.ts");
const access = await import("../../lib/access.ts");
const { POST: postAccess } = await import("../../app/api/access/route.ts");

let visitor = 0;
const request = (cookie = "") => new Request("https://demo.test/api/chat", { method: "POST", headers: { cookie: `mccs_visitor=visitor-${++visitor}-abcdef; ${cookie}` } });
// Several requests from one visitor: returns how many got through before a 429, and the 429.
async function burst(route, cookie, n) {
  const id = ++visitor;
  let passed = 0;
  let blocked = null;
  for (let i = 0; i < n; i++) {
    const r = await rateLimit(new Request("https://demo.test/api/x", { headers: { cookie: `mccs_visitor=visitor-${id}-abcdef; ${cookie}` } }), route);
    if (r) {
      blocked = r;
      break;
    }
    passed++;
  }
  return { passed, blocked };
}
const login = (code) => postAccess(new Request("https://demo.test/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }));
const cookiesFrom = (res) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

// 1. Defaults and env limits.
delete process.env.RATE_LIMIT_CHAT_PER_HOUR;
delete process.env.RATE_LIMIT_WARM_PER_HOUR;
check("Default limits: 150 chat, 30 warm per hour", limitFor("chat") === 150 && limitFor("warm") === 30);
process.env.RATE_LIMIT_CHAT_PER_HOUR = "nonsense";
check("A bad env value falls back to the default", limitFor("chat") === 150);
process.env.RATE_LIMIT_CHAT_PER_HOUR = "3";
process.env.RATE_LIMIT_WARM_PER_HOUR = "2";
const chat = await burst("chat", "", 10);
const warm = await burst("warm", "", 10);
check("RATE_LIMIT_CHAT_PER_HOUR applies (3 then 429)", chat.passed === 3 && chat.blocked?.status === 429, JSON.stringify({ passed: chat.passed }));
check("RATE_LIMIT_WARM_PER_HOUR applies (2 then 429)", warm.passed === 2 && warm.blocked?.status === 429, JSON.stringify({ passed: warm.passed }));
const body = await chat.blocked.json();
check("Friendly limit message", body.error === "You’ve asked a lot of questions this hour. Try again in a few minutes." && body.error === LIMIT_MESSAGE, body.error);
check("429 says when to retry", Number(chat.blocked.headers.get("retry-after")) > 0);

// 2. The regular access code: access, normal limits.
const regular = await login("test-access-code");
const regularCookies = cookiesFrom(regular);
check("Regular code is accepted (access cookie only)", regular.status === 200 && /mccs_demo_access=/.test(regularCookies) && !/mccs_presenter=/.test(regularCookies), regularCookies.replace(/=[0-9a-f]+/g, "=…"));
const regularChat = await burst("chat", regularCookies, 10);
check("Regular code is still rate limited", regularChat.passed === 3 && regularChat.blocked?.status === 429);

// 3. The presenter code: access plus a presenter cookie that skips both limits.
const pres = await login("test-presenter-code");
const setCookies = pres.headers.getSetCookie();
const presCookie = setCookies.find((c) => c.startsWith("mccs_presenter="));
check("Presenter code grants access and sets the presenter cookie", pres.status === 200 && setCookies.some((c) => c.startsWith("mccs_demo_access=")) && !!presCookie);
check("Presenter cookie: httpOnly, about 30 days, a hash (not the code)", /HttpOnly/.test(presCookie) && /Max-Age=2592000/.test(presCookie) && !/test-presenter-code/.test(presCookie) && /^mccs_presenter=[0-9a-f]{64};/.test(presCookie));
check("Presenter cookie value is the salted hash", presCookie.split(";")[0].split("=")[1] === (await access.presenterToken("test-presenter-code")) && (await access.presenterToken("x")) !== (await access.accessToken("x")));
const presChat = await burst("chat", cookiesFrom(pres), 25);
const presWarm = await burst("warm", cookiesFrom(pres), 25);
check("Presenter cookie skips the chat limit", presChat.passed === 25 && !presChat.blocked);
check("Presenter cookie skips the warm limit", presWarm.passed === 25 && !presWarm.blocked);

// 4. Wrong codes.
const wrong = await login("not-the-code");
check("A wrong code is rejected, no cookies", wrong.status === 401 && wrong.headers.getSetCookie().length === 0);
const forged = await burst("chat", `mccs_presenter=${"0".repeat(64)}`, 10);
check("A forged presenter cookie doesn't skip the limit", forged.passed === 3 && forged.blocked?.status === 429);

// 5. No PRESENTER_CODE: no presenter mode.
delete process.env.PRESENTER_CODE;
const noPres = await login("test-presenter-code");
check("PRESENTER_CODE unset: the presenter code is rejected", noPres.status === 401);
const stale = await burst("chat", cookiesFrom(pres), 10);
check("PRESENTER_CODE unset: an old presenter cookie is ignored", stale.passed === 3 && stale.blocked?.status === 429);

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

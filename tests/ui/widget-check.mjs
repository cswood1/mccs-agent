/**
 * Widget behavior checks with stubbed API responses (no Claude calls).
 *
 *   node --env-file=.env.local tests/ui/widget-check.mjs [baseUrl]
 *
 * Uses the locally installed Google Chrome. Every request to *.usmc-mccs.org is blocked, and
 * /api/chat and /api/warm are stubbed, per the API budget rules in CLAUDE.md.
 */
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const code = process.env.DEMO_ACCESS_CODE?.trim();
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

const ANSWER =
  "Leatherneck Lanes opens at **1:00 pm** on Saturday. Call 703-784-2210, or stop by 2034 Barnett Ave, Quantico, VA 22134. " +
  "For a place to stay, see [Lodging](https://quantico.usmc-mccs.org/lodging).";
const FOLLOWUPS = ["Lane prices?", "Party packages?"];

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
if (code) {
  const token = createHash("sha256").update(`mccs-demo-access:${code}`).digest("hex");
  await ctx.addCookies([{ name: "mccs_demo_access", value: token, url: base }]);
}
await ctx.route(/usmc-mccs\.org/, (r) => r.abort());
const chatBodies = [];
await ctx.route("**/api/chat", async (r) => {
  chatBodies.push(r.request().postDataJSON());
  await r.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: ANSWER + "\u001e" + JSON.stringify({ followups: FOLLOWUPS }) });
});
await ctx.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"warmed":true}' }));

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const w = page.locator("#mccs-assistant");

// 1. Bowling page: context line, page welcome, page chips.
await page.goto(base + "/recreation-fitness/recreation/indoor-recreation/bowling", { waitUntil: "networkidle" });
await w.locator("button.launcher").click();
await page.waitForTimeout(400);
const subtitle = await w.locator(".subtitle").textContent();
check("Viewing line on bowling page", /^Viewing: .*Bowling/i.test(subtitle), subtitle);
const welcome = await w.locator(".msg.assistant").first().textContent();
check("Page-specific welcome", /Questions about .*Bowling.*\? I can help\./i.test(welcome), welcome);
const pageChips = await w.locator(".chips .chip").allTextContents();
check("3–4 of the page's own chips shown", pageChips.length >= 3 && pageChips.length <= 4 && !pageChips.includes("Just PCS’d here, where do I start?"), JSON.stringify(pageChips));

// 2. Ask via a chip: page context sent, follow-ups replace page chips, links rendered.
await w.locator(".chips .chip").first().click();
await w.locator(".msg.assistant a").first().waitFor();
await page.waitForTimeout(300);
const body1 = chatBodies[0] ?? {};
check("Sends current page path", body1.page?.path === "/recreation-fitness/recreation/indoor-recreation/bowling", JSON.stringify(body1.page));
check("Sends title and URL", !!body1.page?.title && /bowling/.test(body1.page?.url ?? ""), body1.page?.title);
const followChips = await w.locator(".chips .chip").allTextContents();
check("Two follow-up chips after answer", JSON.stringify(followChips) === JSON.stringify(FOLLOWUPS), JSON.stringify(followChips));
const answerText = await w.locator(".msg.assistant").last().textContent();
check("Follow-up frame not shown as text", !answerText.includes("\u001e") && !answerText.includes("followups"), answerText.slice(-60));
const links = await w.locator(".msg.assistant").last().locator("a").evaluateAll((as) => as.map((a) => ({ text: a.textContent, href: a.getAttribute("href"), target: a.getAttribute("target") })));
check("Tap-to-call link", links.some((l) => l.href === "tel:7037842210"), JSON.stringify(links));
check("Map link for address", links.some((l) => /google\.com\/maps\/search/.test(l.href) && /2034%20Barnett/.test(l.href)), JSON.stringify(links.map((l) => l.href)));
check("Site link stays in tab", links.some((l) => l.href === "/lodging" && !l.target), JSON.stringify(links));

// 3. Follow the answer's site link: same tab, chat stays open with history, chips update to the new page.
await w.locator(".msg.assistant a", { hasText: "Lodging" }).click();
await page.waitForURL(/\/lodging$/);
await page.waitForTimeout(800);
check("Panel still open after navigation", await w.locator(".panel").isVisible());
check("History kept", (await w.locator(".msg").count()) === 2, String(await w.locator(".msg").count()));
const sub2 = await w.locator(".subtitle").textContent();
check("Viewing line updates", /^Viewing: Lodging/i.test(sub2), sub2);
const chips2 = await w.locator(".chips .chip").allTextContents();
check("Chips switch to the new page", chips2.length >= 3 && JSON.stringify(chips2) !== JSON.stringify(FOLLOWUPS), JSON.stringify(chips2));

// 4. Second question carries the trail (bowling), never the current page.
await w.locator("textarea").fill("Do you allow pets?");
await w.locator("textarea").press("Enter");
await w.locator(".msg.assistant").nth(1).locator("a").first().waitFor();
const body2 = chatBodies[1] ?? {};
check("Trail includes the previous page", (body2.trail ?? []).some((t) => /bowling/.test(t.path)), JSON.stringify(body2.trail));
check("Trail excludes current page", !(body2.trail ?? []).some((t) => t.path === "/lodging"), JSON.stringify(body2.trail));

// 5. Nudge: fresh session, 20 s on a non-home page with the panel closed.
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
try {
await ctx2.addCookies(await ctx.cookies());
await ctx2.route(/usmc-mccs\.org/, (r) => r.abort());
await ctx2.route("**/api/chat", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "Stub answer." }));
await ctx2.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const p2 = await ctx2.newPage();
await p2.clock.install();
await p2.goto(base + "/recreation-fitness/recreation/indoor-recreation/bowling", { waitUntil: "networkidle" });
const w2 = p2.locator("#mccs-assistant");
// Let the widget finish loading its config and page info before moving the fake clock.
await p2.waitForFunction(() => !!document.querySelector("#mccs-assistant")?.shadowRoot?.querySelector(".subtitle")?.textContent?.startsWith("Viewing"));
check("No nudge before 20 s", !(await w2.locator(".nudge").isVisible()));
await p2.clock.runFor(21000);
await p2.waitForTimeout(200);
const nudgeText = (await w2.locator(".nudge-text").textContent()) ?? "";
check("Nudge after 20 s with the page's first chip", (await w2.locator(".nudge").isVisible()) && nudgeText.length > 0, nudgeText);
await w2.locator(".nudge-text").click();
await w2.locator(".msg.user").first().waitFor();
check("Clicking the nudge opens the chat and asks it", (await w2.locator(".msg.user").first().textContent()) === nudgeText);
await p2.goto(base + "/lodging", { waitUntil: "networkidle" });
await p2.clock.runFor(21000);
check("Nudge only once per session", !(await w2.locator(".nudge").isVisible()));
} catch (err) {
  check("Nudge flow", false, err.message.split("\n")[0]);
}

// 6. Home page: default chips, no nudge.
const p3 = await ctx2.newPage();
await p3.goto(base + "/", { waitUntil: "networkidle" });
await p3.locator("#mccs-assistant button.launcher").click().catch(() => {});
const homeChips = await p3.locator("#mccs-assistant .chips .chip").allTextContents();
check("Home shows the default chips", homeChips[0] === "Just PCS’d here, where do I start?" && homeChips.length === 4, JSON.stringify(homeChips));

check("No page errors", errors.length === 0, errors.join(" | "));
await browser.close();

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

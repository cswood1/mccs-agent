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
  "For a place to stay, see [Lodging](https://quantico.usmc-mccs.org/lodging), or compare [Pendleton lodging](https://pendleton.usmc-mccs.org/lodging).";
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
await page.goto(base + "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", { waitUntil: "networkidle" });
await w.locator("button.launcher").click();
await page.waitForTimeout(400);
const viewing = await w.locator(".context-line").textContent();
check("Viewing line on bowling page", /^Viewing: .*Bowling/i.test(viewing), viewing);
// docs/PRODUCT.md §13: name and AI signal.
check("Panel title is Ask MCCS", (await w.locator("#title").textContent())?.trim() === "Ask MCCS", await w.locator("#title").textContent());
check("Subtitle is the installation's short name", (await w.locator(".subtitle").textContent()) === "MCB Quantico", await w.locator(".subtitle").textContent());
check("Sparkle next to the title", (await w.locator("#title svg.sparkle").count()) === 1);
check("Composer placeholder", (await w.locator("textarea").getAttribute("placeholder")) === "Ask me anything…");
const welcome = await w.locator(".msg.assistant").first().textContent();
check("Page-specific welcome", /Questions about .*Bowling.*\? I can help\./i.test(welcome), welcome);
const pageChips = await w.locator(".chips .chip").allTextContents();
check("3–4 of the page's own chips shown", pageChips.length >= 3 && pageChips.length <= 4 && !pageChips.includes("Just PCS’d here, where do I start?"), JSON.stringify(pageChips));

// Launcher (§13): label, sparkle, gradient border that shimmers once.
const launcherCheck = page.locator("#mccs-assistant button.launcher");
check("Launcher label is Ask MCCS", (await launcherCheck.textContent())?.trim() === "Ask MCCS", await launcherCheck.textContent());
check("Launcher has the sparkle", (await launcherCheck.locator("svg.sparkle").count()) === 1);
const shimmer = await launcherCheck.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { name: cs.animationName, count: cs.animationIterationCount, image: cs.backgroundImage };
});
check("Launcher shimmers once on load", shimmer.name === "launcher-shimmer" && shimmer.count === "1", JSON.stringify(shimmer));
check("Launcher has a gradient border", (shimmer.image.match(/linear-gradient/g) || []).length === 2, shimmer.image.slice(0, 80));

// 2. Ask via a chip: page context sent, follow-ups replace page chips, links rendered.
await w.locator(".chips .chip").first().click();
await w.locator(".msg.assistant a").first().waitFor();
await page.waitForTimeout(300);
const body1 = chatBodies[0] ?? {};
check("Sends current page path", body1.page?.path === "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", JSON.stringify(body1.page));
check("Sends title and URL", !!body1.page?.title && /bowling/.test(body1.page?.url ?? ""), body1.page?.title);
const followChips = await w.locator(".chips .chip").allTextContents();
check("Two follow-up chips after answer", JSON.stringify(followChips) === JSON.stringify(FOLLOWUPS), JSON.stringify(followChips));
const answerText = await w.locator(".msg.assistant").last().textContent();
check("Follow-up frame not shown as text", !answerText.includes("\u001e") && !answerText.includes("followups"), answerText.slice(-60));
const links = await w.locator(".msg.assistant").last().locator("a").evaluateAll((as) => as.map((a) => ({ text: a.textContent, href: a.getAttribute("href"), target: a.getAttribute("target") })));
check("Tap-to-call link", links.some((l) => l.href === "tel:7037842210"), JSON.stringify(links));
check("Map link for address", links.some((l) => /google\.com\/maps\/search/.test(l.href) && /2034%20Barnett/.test(l.href)), JSON.stringify(links.map((l) => l.href)));
check("Site link stays in tab, under /quantico", links.some((l) => l.href === "/quantico/lodging" && !l.target), JSON.stringify(links));
check("Other installation's link goes to its local path", links.some((l) => l.href === "/pendleton/lodging" && !l.target), JSON.stringify(links));

// 3. Follow the answer's site link: same tab, chat stays open with history, chips update to the new page.
await w.locator(".msg.assistant a", { hasText: /^Lodging$/ }).click();
await page.waitForURL(/\/quantico\/lodging$/);
await page.waitForTimeout(800);
check("Panel still open after navigation", await w.locator(".panel").isVisible());
check("History kept", (await w.locator(".msg").count()) === 2, String(await w.locator(".msg").count()));
const sub2 = await w.locator(".context-line").textContent();
check("Viewing line updates", /^Viewing: Lodging/i.test(sub2), sub2);
const chips2 = await w.locator(".chips .chip").allTextContents();
check("Chips switch to the new page", chips2.length >= 3 && JSON.stringify(chips2) !== JSON.stringify(FOLLOWUPS), JSON.stringify(chips2));

// 4. Second question carries the trail (bowling), never the current page.
await w.locator("textarea").fill("Do you allow pets?");
await w.locator("textarea").press("Enter");
await w.locator(".msg.assistant").nth(1).locator("a").first().waitFor();
const body2 = chatBodies[1] ?? {};
check("Trail includes the previous page", (body2.trail ?? []).some((t) => /bowling/.test(t.path)), JSON.stringify(body2.trail));
check("Trail excludes current page", !(body2.trail ?? []).some((t) => t.path === "/quantico/lodging"), JSON.stringify(body2.trail));

// 5. Nudge: fresh session, 20 s on a non-home page with the panel closed.
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
try {
await ctx2.addCookies(await ctx.cookies());
await ctx2.route(/usmc-mccs\.org/, (r) => r.abort());
await ctx2.route("**/api/chat", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "Stub answer." }));
await ctx2.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const p2 = await ctx2.newPage();
await p2.clock.install();
await p2.goto(base + "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", { waitUntil: "networkidle" });
const w2 = p2.locator("#mccs-assistant");
// Let the widget finish loading its config and page info before moving the fake clock.
await p2.waitForFunction(() => !!document.querySelector("#mccs-assistant")?.shadowRoot?.querySelector(".context-line")?.textContent?.startsWith("Viewing"));
check("No nudge before 20 s", !(await w2.locator(".nudge").isVisible()));
await p2.clock.runFor(21000);
await p2.waitForTimeout(200);
const nudgeText = (await w2.locator(".nudge-text").textContent()) ?? "";
check("Nudge after 20 s with the page's first chip", (await w2.locator(".nudge").isVisible()) && nudgeText.length > 0, nudgeText);
await w2.locator(".nudge-text").click();
await w2.locator(".msg.user").first().waitFor();
check("Clicking the nudge opens the chat and asks it", (await w2.locator(".msg.user").first().textContent()) === nudgeText);
await p2.goto(base + "/quantico/lodging", { waitUntil: "networkidle" });
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

// 7. Multiple installations (docs/PRODUCT.md §12).
const p4 = await ctx2.newPage();
p4.on("pageerror", (e) => errors.push(e.message));
const res = await p4.goto(base + "/recreation-fitness/fitness", { waitUntil: "networkidle" });
check("Old path redirects to /quantico/...", p4.url().endsWith("/quantico/recreation-fitness/fitness") && res.ok(), p4.url());
await p4.goto(base + "/", { waitUntil: "networkidle" });
check("Root goes to the Quantico home", p4.url().endsWith("/quantico"), p4.url());
const pickerHref = await p4.locator("#modal-block-views-block-change-location-change-location a", { hasText: "Camp Pendleton" }).first().getAttribute("href");
check("Location picker links to /pendleton", pickerHref === "/pendleton", pickerHref);
const menuHref = await p4.locator("#offcanvasSidebar a", { hasText: "Recreation & Fitness" }).first().getAttribute("href");
check("Menu links carry the installation prefix", menuHref === "/quantico/recreation-fitness", menuHref);
await p4.locator("button.btn-modal").last().click();
await p4.locator("#modal-block-views-block-change-location-change-location a", { hasText: "Camp Pendleton" }).first().click();
await p4.waitForURL(/\/pendleton$/);
await p4.waitForLoadState("networkidle");
const body = (await p4.locator("main").textContent()) ?? "";
check("Pendleton shows the coming-soon page", /Camp Pendleton is coming soon in this demo/.test(body), body.slice(0, 120));
const pickerLabel = (await p4.locator("button.btn-modal span.text-uppercase").last().textContent())?.trim();
check("Picker button shows the current installation", pickerLabel === "Camp Pendleton", pickerLabel);
check("Demo banner on every installation, no link", (await p4.locator(".demo-banner .demo-banner-full").textContent()) === "NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo" && (await p4.locator(".demo-banner a").count()) === 0);
await p4.locator("#mccs-assistant button.launcher").click();
await p4.waitForTimeout(500);
const pSub = await p4.locator("#mccs-assistant .subtitle").textContent();
check("Widget on Pendleton uses the Pendleton config", pSub === "MCB Camp Pendleton", pSub);
check("Pendleton panel is also Ask MCCS", (await p4.locator("#mccs-assistant #title").textContent())?.trim() === "Ask MCCS");
const deepComing = await p4.goto(base + "/pendleton/lodging", { waitUntil: "networkidle" });
check("Deep Pendleton paths show coming soon too", deepComing.ok() && /coming soon in this demo/.test((await p4.locator("main").textContent()) ?? ""));
await p4.goto(base + "/albany", { waitUntil: "networkidle" });
check("Installations without a config: coming soon, no widget", /Albany is coming soon/.test((await p4.locator("main").textContent()) ?? "") && (await p4.locator("#mccs-assistant").count()) === 0);

// 9. Header search bar becomes Ask MCCS (docs/PRODUCT.md §13).
const sCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await sCtx.addCookies(await ctx.cookies());
await sCtx.route(/usmc-mccs\.org/, (r) => r.abort());
await sCtx.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const searchBodies = [];
await sCtx.route("**/api/chat", async (r) => {
  searchBodies.push(r.request().postDataJSON());
  await r.fulfill({ status: 200, contentType: "text/plain", body: "Stub answer." });
});
const sp = await sCtx.newPage();
sp.on("pageerror", (e) => errors.push(e.message));
await sp.goto(base + "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", { waitUntil: "networkidle" });
await sp.waitForFunction(() => document.querySelector("#mccs-assistant")?.shadowRoot?.querySelector(".context-line")?.textContent?.startsWith("Viewing"));
const sInput = sp.locator("#main-search-input");
const attrs = await sInput.evaluate((el) => ({
  readonly: el.hasAttribute("readonly"), role: el.getAttribute("role"), controls: el.getAttribute("aria-controls"),
  expanded: el.getAttribute("aria-expanded"), placeholder: el.getAttribute("placeholder"),
}));
check("Search box is an editable combobox", !attrs.readonly && attrs.role === "combobox" && attrs.controls === "mccs-ask-listbox" && attrs.expanded === "false", JSON.stringify(attrs));
check("Sparkle replaces the magnifier", (await sp.locator("#desktop-search-container svg.mccs-ask-icon").count()) === 1 && (await sp.locator("#desktop-search-container svg.bi-search").count()) === 0);
check("Placeholder starts with the invitation", attrs.placeholder === "Ask MCCS anything…", attrs.placeholder);
await sInput.focus();
const lb = sp.locator("#mccs-ask-listbox");
await lb.waitFor({ state: "visible" });
const focusOpts = await lb.locator("[role=option]").allTextContents();
const bowlingChips = (await (await sp.request.get(base + "/api/installations/quantico/page?path=/recreation-fitness/recreation/indoor-recreation/bowling")).json()).chips;
check("On focus: this page's chips", JSON.stringify(focusOpts) === JSON.stringify(bowlingChips), JSON.stringify(focusOpts));
check("Combobox expanded on focus", (await sInput.getAttribute("aria-expanded")) === "true");
await sInput.fill("bowling");
await sp.waitForTimeout(200);
const typed = await lb.locator("[role=option]").allTextContents();
check("Typing: first row is the Ask row", typed[0] === "Ask MCCS: ‘bowling’", typed[0]);
check("Typing: up to 5 page matches after it", typed.length >= 2 && typed.length <= 6 && /^Bowling/.test(typed[1] ?? ""), JSON.stringify(typed));
check("Ask row selected by default", (await sInput.getAttribute("aria-activedescendant")) === "mccs-ask-opt-0");
await sInput.press("ArrowDown");
check("Arrow keys move the selection", (await sInput.getAttribute("aria-activedescendant")) === "mccs-ask-opt-1" && (await lb.locator("#mccs-ask-opt-1").getAttribute("aria-selected")) === "true");
await sInput.press("Escape");
check("Escape closes the dropdown", !(await lb.isVisible()) && (await sInput.getAttribute("aria-expanded")) === "false");
// Page row navigates in the same tab.
await sp.goto(base + "/quantico", { waitUntil: "networkidle" });
await sp.locator("#main-search-input").fill("bowling");
await sp.locator("#mccs-ask-listbox [role=option]", { hasText: /^Bowling/ }).first().click();
await sp.waitForURL(/\/quantico\/recreation-fitness\/recreation\/indoor-recreation\/bowling$/);
check("Page row navigates in the same tab", true);
// Enter asks: same panel and conversation, question already sent.
await sp.locator("#main-search-input").fill("Is the lane open late on Friday?");
await sp.locator("#main-search-input").press("Enter");
await sp.locator("#mccs-assistant .msg.assistant").filter({ hasText: "Stub answer." }).waitFor();
check("Enter opens the panel with the question sent", (await sp.locator("#mccs-assistant .panel").isVisible()) && (await sp.locator("#mccs-assistant .msg.user").last().textContent()) === "Is the lane open late on Friday?");
check("Asked with this page as context", searchBodies.at(-1)?.page?.path === "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", JSON.stringify(searchBodies.at(-1)?.page));
check("Search box cleared after asking", (await sp.locator("#main-search-input").inputValue()) === "");
check("Old search modal never opens", (await sp.locator("#searchModal.show").count()) === 0);
await sp.locator("#mccs-assistant .close").click();
await sp.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
check("Cmd/Ctrl+K focuses the search box", await sp.locator("#main-search-input").evaluate((el) => document.activeElement === el));
// The floating button shows the same conversation.
await sp.locator("#mccs-assistant button.launcher").click();
check("Floating button opens the same conversation", (await sp.locator("#mccs-assistant .msg.user").count()) >= 1);

// Phones: the header search icon becomes the sparkle and opens the same experience.
const phCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await phCtx.addCookies(await ctx.cookies());
await phCtx.route(/usmc-mccs\.org/, (r) => r.abort());
await phCtx.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await phCtx.route("**/api/chat", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "Stub answer." }));
const ph = await phCtx.newPage();
ph.on("pageerror", (e) => errors.push(e.message));
await ph.goto(base + "/quantico", { waitUntil: "networkidle" });
const trigger = ph.locator("button.mobile-search-trigger");
check("Phone: search icon is the sparkle", (await trigger.locator("svg.mccs-ask-icon").count()) === 1 && (await trigger.getAttribute("aria-label")) === "Ask MCCS");
await trigger.click();
const sheetInput = ph.locator("#mccs-ask-sheet-input");
check("Phone: opens the Ask MCCS search", (await ph.locator("#mccs-ask-sheet").isVisible()) && (await sheetInput.evaluate((el) => document.activeElement === el)));
await sheetInput.fill("bowling");
await ph.waitForTimeout(200);
const phoneOpts = await ph.locator("#mccs-ask-listbox [role=option]").allTextContents();
check("Phone: Ask row and page matches", phoneOpts[0] === "Ask MCCS: ‘bowling’" && phoneOpts.length >= 2, JSON.stringify(phoneOpts));
await sheetInput.press("Enter");
await ph.locator("#mccs-assistant .msg.assistant").filter({ hasText: "Stub answer." }).waitFor();
check("Phone: Enter asks in the panel", (await ph.locator("#mccs-assistant .panel").isVisible()) && !(await ph.locator("#mccs-ask-sheet").isVisible()));
check("Phone: old search modal never opens", (await ph.locator("#searchModal.show").count()) === 0);

// Placeholder rotation: invitation first, then the example questions every 4 s, paused on focus.
const PLACEHOLDERS = ["Ask MCCS anything…", "Is the gym open now?", "What’s on this weekend?", "Where can I eat lunch?", "Find child care on base", "Book a room for my PCS", "Am I eligible for TA?"];
const rotCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await rotCtx.addCookies(await ctx.cookies());
await rotCtx.route(/usmc-mccs\.org/, (r) => r.abort());
await rotCtx.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const rp = await rotCtx.newPage();
await rp.clock.install();
await rp.goto(base + "/quantico", { waitUntil: "networkidle" });
const seen = [await rp.locator("#main-search-input").getAttribute("placeholder")];
for (let i = 1; i < PLACEHOLDERS.length + 1; i++) {
  await rp.clock.runFor(4000);
  seen.push(await rp.locator("#main-search-input").getAttribute("placeholder"));
}
check("Rotates through the questions in order, then repeats", JSON.stringify(seen) === JSON.stringify([...PLACEHOLDERS, PLACEHOLDERS[0]]), JSON.stringify(seen));
await rp.locator("#main-search-input").focus();
const before = await rp.locator("#main-search-input").getAttribute("placeholder");
await rp.clock.runFor(12000);
check("Rotation pauses while focused", (await rp.locator("#main-search-input").getAttribute("placeholder")) === before);
const rmp = await (await (async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await c.addCookies(await ctx.cookies());
  await c.route(/usmc-mccs\.org/, (r) => r.abort());
  await c.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  return c;
})()).newPage();
await rmp.clock.install();
await rmp.goto(base + "/quantico", { waitUntil: "networkidle" });
await rmp.clock.runFor(12000);
check("Reduced motion: placeholder stays on the invitation", (await rmp.locator("#main-search-input").getAttribute("placeholder")) === "Ask MCCS anything…");

// Reduced motion: no shimmer.
const rmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
await rmCtx.addCookies(await ctx.cookies());
await rmCtx.route(/usmc-mccs\.org/, (r) => r.abort());
await rmCtx.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const rm = await rmCtx.newPage();
await rm.goto(base + "/quantico", { waitUntil: "networkidle" });
const rmAnim = await rm.locator("#mccs-assistant button.launcher").evaluate((el) => getComputedStyle(el).animationName);
check("Reduced motion: no shimmer", rmAnim === "none", rmAnim);

check("No page errors", errors.length === 0, errors.join(" | "));
await browser.close();

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

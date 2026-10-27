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
check("Pendleton home: its own blocks, tiles and stories", (await p4.locator("main .hero4section-link").count()) > 0 && (await p4.locator("main a[href='/pendleton/recreation-fitness/recreation/indoor-recreation/bowling'], main a[href^='/pendleton/']").count()) > 5 && !/coming soon/.test((await p4.locator("main").textContent()) ?? ""));
check("Pendleton menu links carry its prefix", (await p4.locator("#offcanvasSidebar a", { hasText: "Recreation & Fitness" }).first().getAttribute("href")) === "/pendleton/recreation-fitness");
const pickerLabel = (await p4.locator("button.btn-modal span.text-uppercase").last().textContent())?.trim();
check("Picker button shows the current installation", pickerLabel === "Camp Pendleton", pickerLabel);
check("Demo banner on every installation, no link", (await p4.locator(".demo-banner .demo-banner-full").textContent()) === "NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo" && (await p4.locator(".demo-banner a").count()) === 0);
await p4.locator("#mccs-assistant button.launcher").click();
await p4.waitForTimeout(500);
const pSub = await p4.locator("#mccs-assistant .subtitle").textContent();
check("Widget on Pendleton uses the Pendleton config", pSub === "MCB Camp Pendleton", pSub);
check("Pendleton panel is also Ask MCCS", (await p4.locator("#mccs-assistant #title").textContent())?.trim() === "Ask MCCS");
const pFit = await p4.goto(base + "/pendleton/recreation-fitness", { waitUntil: "networkidle" });
check("Pendleton pages render from its own capture", pFit.ok() && /Recreation & Fitness/.test((await p4.locator("h1").first().textContent()) ?? "") && (await p4.locator("main a[href^='/pendleton/recreation-fitness/']").count()) > 0);
// Camp Lejeune–New River: /lejeune, with the old subdomain slug redirecting.
await p4.goto(base + "/quantico", { waitUntil: "networkidle" });
check("Location picker links to /lejeune", (await p4.locator("#modal-block-views-block-change-location-change-location a", { hasText: "Camp Lejeune" }).first().getAttribute("href")) === "/lejeune");
await p4.goto(base + "/lejeune", { waitUntil: "networkidle" });
check("Lejeune home renders with its own menu", (await p4.locator("#offcanvasSidebar a", { hasText: "Recreation & Fitness" }).first().getAttribute("href")) === "/lejeune/recreation-fitness" && !/coming soon/.test((await p4.locator("main").textContent()) ?? ""));
check("Lejeune picker label", (await p4.locator("button.btn-modal span.text-uppercase").last().textContent())?.trim() === "Camp Lejeune–New River");
await p4.locator("#mccs-assistant button.launcher").click();
await p4.waitForTimeout(500);
check("Widget on Lejeune uses the Lejeune config", (await p4.locator("#mccs-assistant .subtitle").textContent()) === "MCB Camp Lejeune");
await p4.goto(base + "/lejeunenewriver/dining-entertainment", { waitUntil: "networkidle" });
check("Old /lejeunenewriver paths redirect to /lejeune", p4.url().endsWith("/lejeune/dining-entertainment"), p4.url());
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
await sp.locator("#mccs-assistant .minimize").click();
await sp.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
check("Cmd/Ctrl+K focuses the search box", await sp.locator("#main-search-input").evaluate((el) => document.activeElement === el));
// The edge tab shows the same conversation.
await sp.locator("#mccs-assistant button.edge-tab").click();
check("Edge tab opens the same conversation", (await sp.locator("#mccs-assistant .msg.user").count()) >= 1);

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
check("Phone: sheet input has the fixed accessible name", (await sheetInput.getAttribute("aria-label")) === "Ask MCCS" && (await sheetInput.getAttribute("placeholder"))?.startsWith("Ask MCCS"));
await sheetInput.fill("bowling");
await ph.waitForTimeout(200);
const phoneOpts = await ph.locator("#mccs-ask-listbox [role=option]").allTextContents();
check("Phone: Ask row and page matches", phoneOpts[0] === "Ask MCCS: ‘bowling’" && phoneOpts.length >= 2, JSON.stringify(phoneOpts));
await sheetInput.press("Enter");
await ph.locator("#mccs-assistant .msg.assistant").filter({ hasText: "Stub answer." }).waitFor();
check("Phone: Enter asks in the panel", (await ph.locator("#mccs-assistant .panel").isVisible()) && !(await ph.locator("#mccs-ask-sheet").isVisible()));
check("Phone: old search modal never opens", (await ph.locator("#searchModal.show").count()) === 0);

// Placeholder: "Ask MCCS" stays; the rest of each suggestion types out (~35 ms/char), holds ~2 s,
// erases in ~0.3 s, then the next types. Paused while focused.
const PLACEHOLDERS = ["Ask MCCS anything…", "Ask MCCS… Gym hours today", "Ask MCCS… Events this weekend", "Ask MCCS… Child care on base", "Ask MCCS… Where to eat lunch", "Ask MCCS… Things to do on base", "Ask MCCS… Lodging on base"];
const rotCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await rotCtx.addCookies(await ctx.cookies());
await rotCtx.route(/usmc-mccs\.org/, (r) => r.abort());
await rotCtx.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const rp = await rotCtx.newPage();
await rp.clock.install();
await rp.goto(base + "/quantico", { waitUntil: "networkidle" });
check("Search box has a fixed accessible name", (await rp.locator("#main-search-input").getAttribute("aria-label")) === "Ask MCCS");
// Record every placeholder value with its (fake-clock) time.
await rp.locator("#main-search-input").evaluate((el) => {
  window.__ph = [{ t: Date.now(), v: el.placeholder }];
  new MutationObserver(() => window.__ph.push({ t: Date.now(), v: el.placeholder })).observe(el, { attributes: true, attributeFilter: ["placeholder"] });
});
await rp.clock.runFor(PLACEHOLDERS.length * 3400);
const frames = await rp.evaluate(() => window.__ph);
const vals = frames.map((p) => p.v);
check("Placeholder starts on the invitation", vals[0] === "Ask MCCS anything…", vals[0]);
check("“Ask MCCS” never disappears", vals.every((v) => v.startsWith("Ask MCCS")), vals.find((v) => !v.startsWith("Ask MCCS")));
// Full suggestions in the order they were completed.
const completed = vals.filter((v, k) => PLACEHOLDERS.includes(v) && vals[k + 1] !== undefined && vals[k + 1].length < v.length);
check("Types the suggestions in order, then repeats", JSON.stringify(completed.slice(0, PLACEHOLDERS.length + 1)) === JSON.stringify([...PLACEHOLDERS, PLACEHOLDERS[0]]), JSON.stringify(completed));
const gymFrames = vals.slice(vals.indexOf("Ask MCCS") + 1, vals.indexOf("Ask MCCS… Gym hours today") + 1);
check("Types letter by letter", gymFrames.length === "… Gym hours today".length && gymFrames.every((v, k) => v === "Ask MCCS… Gym hours today".slice(0, "Ask MCCS".length + k + 1)), JSON.stringify(gymFrames.slice(0, 4)));
// Timing for one suggestion: type, hold, erase.
const at = (v, from = 0) => frames.findIndex((p, k) => k >= from && p.v === v);
const gStart = at("Ask MCCS…", 1), gFull = at("Ask MCCS… Gym hours today"), gNext = gFull + 1, gEmpty = at("Ask MCCS", gFull);
const typePerChar = (frames[gFull].t - frames[gStart].t) / ("… Gym hours today".length - 1);
const hold = frames[gNext].t - frames[gFull].t;
const erase = frames[gEmpty].t - frames[gFull].t - hold;
check("~35 ms per character typed", typePerChar >= 30 && typePerChar <= 45, typePerChar.toFixed(1));
check("Holds ~2 s", hold >= 1950 && hold <= 2100, String(hold));
check("Erases in ~0.3 s", erase >= 200 && erase <= 380, String(erase));
const cycle = frames[at("Ask MCCS… E", gFull)].t - frames[gStart].t;
check("Full cycle about 3 s", cycle >= 2500 && cycle <= 3400, String(cycle));
await rp.locator("#main-search-input").focus();
await rp.clock.runFor(300);
const before = await rp.locator("#main-search-input").getAttribute("placeholder");
await rp.clock.runFor(8000);
check("Typing pauses while focused, on a full suggestion", (await rp.locator("#main-search-input").getAttribute("placeholder")) === before && PLACEHOLDERS.includes(before), before);
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
await rmp.locator("#main-search-input").evaluate((el) => {
  window.__rmph = 0;
  new MutationObserver(() => window.__rmph++).observe(el, { attributes: true, attributeFilter: ["placeholder"] });
});
await rmp.clock.runFor(6000);
check("Reduced motion: no typing animation", (await rmp.evaluate(() => window.__rmph)) === 0);

// Floating button and panel: full button → minimize → edge tab → reopen → navigation keeps the tab → reload shows the full button.
async function edgeFlow(label, viewport, mobile) {
  const c = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await c.addCookies(await ctx.cookies());
  await c.route(/usmc-mccs\.org/, (r) => r.abort());
  await c.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await c.route("**/api/chat", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "Stub answer." }));
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  const wx = p.locator("#mccs-assistant");
  const full = wx.locator("button.launcher");
  const tab = wx.locator("button.edge-tab");
  await p.goto(base + "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", { waitUntil: "networkidle" });
  check(`${label}: full button on first visit`, (await full.isVisible()) && !(await tab.isVisible()));
  const fullBox = await full.boundingBox();
  await full.click();
  const min = wx.locator("button.minimize");
  check(`${label}: header has a minimize button, no close X`, (await min.getAttribute("aria-label")) === "Minimize Ask MCCS" && (await wx.locator(".panel button.close").count()) === 0);
  const disc = wx.locator(".disclaimer");
  const discStyle = await disc.evaluate((el) => ({ size: getComputedStyle(el).fontSize, wrap: getComputedStyle(el).textWrap || getComputedStyle(el).textWrapStyle }));
  check(`${label}: disclaimer text, smaller, balanced`, (await disc.textContent()) === "SI answers can be wrong. Check the linked MCCS page before you go." && discStyle.size === "11px" && /balance/.test(discStyle.wrap), JSON.stringify(discStyle));
  await wx.locator("textarea").fill("Is it open late?");
  await wx.locator("textarea").press("Enter");
  await wx.locator(".msg.assistant").filter({ hasText: "Stub answer." }).waitFor();
  await min.click();
  check(`${label}: minimize hides the panel and shows the edge tab`, !(await wx.locator(".panel").isVisible()) && !(await full.isVisible()) && (await tab.isVisible()));
  check(`${label}: edge tab label and focus`, (await tab.getAttribute("aria-label")) === "Open Ask MCCS" && (await tab.evaluate((el) => el.getRootNode().activeElement === el)));
  const tabBox = await tab.boundingBox();
  check(`${label}: edge tab flush right, at the full button's height`, Math.abs(tabBox.x + tabBox.width - viewport.width) < 1 && Math.abs(tabBox.y + tabBox.height - (fullBox.y + fullBox.height)) <= 4 && tabBox.width <= 44, JSON.stringify({ tabBox, fullBox }));
  check(`${label}: edge tab pulses`, (await tab.evaluate((el) => getComputedStyle(el).animationName)) === "edge-glow");
  await tab.click();
  check(`${label}: edge tab reopens the panel with the chat`, (await wx.locator(".panel").isVisible()) && (await wx.locator(".msg.user").count()) === 1 && !(await tab.isVisible()));
  await wx.locator("textarea").press("Escape");
  check(`${label}: Escape minimizes to the edge tab`, !(await wx.locator(".panel").isVisible()) && (await tab.isVisible()));
  await p.goto(base + "/quantico/lodging", { waitUntil: "networkidle" });
  check(`${label}: navigation keeps the edge tab`, (await tab.isVisible()) && !(await full.isVisible()) && !(await wx.locator(".panel").isVisible()));
  await tab.click();
  await p.waitForTimeout(400);
  check(`${label}: chat history and page awareness after navigation`, (await wx.locator(".msg.user").count()) === 1 && /^Viewing: Lodging/i.test((await wx.locator(".context-line").textContent()) ?? ""));
  await p.reload({ waitUntil: "networkidle" });
  check(`${label}: reload shows the full button, panel closed`, (await full.isVisible()) && !(await tab.isVisible()) && !(await wx.locator(".panel").isVisible()));
  await full.click();
  check(`${label}: chat kept after reload`, (await wx.locator(".msg.user").count()) === 1);
  await min.click();
  check(`${label}: minimizing after reload shows the edge tab again`, await tab.isVisible());
  return c;
}
await edgeFlow("Desktop", { width: 1280, height: 800 }, false);
await edgeFlow("Phone", { width: 390, height: 844 }, true);

// Edge tab hover/focus expansion (desktop) and tap-to-open (touch).
async function tabPage(viewport, mobile, extra = {}) {
  const c = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, ...extra });
  await c.addCookies(await ctx.cookies());
  await c.route(/usmc-mccs\.org/, (r) => r.abort());
  await c.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/quantico/lodging", { waitUntil: "networkidle" });
  const wx = p.locator("#mccs-assistant");
  await wx.locator("button.launcher").click();
  await wx.locator("button.minimize").click();
  return { p, wx, tab: wx.locator("button.edge-tab"), label: wx.locator(".edge-label") };
}
const tabState = (tab) => tab.evaluate((el) => {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el), lab = el.querySelector(".edge-label"), ls = getComputedStyle(lab);
  return { width: r.width, right: r.right, vw: innerWidth, labelOpacity: ls.opacity, labelWidth: lab.getBoundingClientRect().width,
    radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius], glow: cs.animationName,
    transition: ls.transitionDuration + " " + ls.transitionTimingFunction };
});
{
  const { p, wx, tab, label } = await tabPage({ width: 1280, height: 800 }, false);
  await p.mouse.move(400, 400);
  await p.waitForTimeout(300);
  const collapsed = await tabState(tab);
  check("Edge tab collapsed: compact sparkle only", collapsed.width <= 44 && collapsed.labelOpacity === "0" && collapsed.labelWidth === 0, JSON.stringify(collapsed));
  check("Edge tab label slides with ~200ms ease-out", /^0\.2s/.test(collapsed.transition) && /ease-out/.test(collapsed.transition), collapsed.transition);
  await tab.hover();
  await p.waitForTimeout(350);
  const hovered = await tabState(tab);
  check("Hover expands the tab to show “Ask MCCS”", hovered.width > 100 && hovered.labelOpacity === "1" && (await label.textContent()) === "Ask MCCS" && (await label.isVisible()), JSON.stringify(hovered));
  check("Expanded tab stays flush with the right edge, rounded on the left only", Math.abs(hovered.right - hovered.vw) < 1 && hovered.radius[1] === "0px" && hovered.radius[2] === "0px" && hovered.radius[0] !== "0px" && hovered.radius[3] !== "0px", JSON.stringify(hovered));
  check("Expanded tab keeps the glow", hovered.glow === "edge-glow", hovered.glow);
  check("Expanded tab keeps its accessible name", (await tab.getAttribute("aria-label")) === "Open Ask MCCS");
  await p.mouse.move(400, 400);
  await p.waitForTimeout(350);
  check("Mouse leave tucks it back", (await tabState(tab)).width <= 44);
  // Keyboard: Escape from the panel puts keyboard focus on the tab, which expands it.
  await tab.click();
  await p.mouse.move(400, 400); // not hovering the tab, so only focus can expand it
  await wx.locator("textarea").press("Escape");
  await p.waitForTimeout(350);
  const focused = await tabState(tab);
  check("Keyboard focus expands the tab", focused.width > 100 && focused.labelOpacity === "1" && (await tab.evaluate((el) => el.matches(":focus-visible"))), JSON.stringify(focused));
  await p.keyboard.press("Shift+Tab");
  await p.waitForTimeout(350);
  check("Blur tucks it back", (await tabState(tab)).width <= 44);
  await p.context().close();
}
{
  const { p, wx, tab } = await tabPage({ width: 390, height: 844 }, true);
  check("Touch: no hover state", await p.evaluate(() => !matchMedia("(hover: hover)").matches));
  const before = await tabState(tab);
  await tab.tap();
  await p.waitForTimeout(300);
  check("Touch: a tap opens the panel directly", before.width <= 44 && (await wx.locator(".panel").isVisible()) && !(await tab.isVisible()), JSON.stringify(before));
  await p.context().close();
}
{
  const { p, tab } = await tabPage({ width: 1280, height: 800 }, false, { reducedMotion: "reduce" });
  await tab.hover();
  const instant = await tabState(tab);
  check("Reduced motion: tab expands instantly, no slide", instant.width > 100 && /^0s/.test(instant.transition), JSON.stringify(instant));
  await p.context().close();
}

// Reduced motion: no shimmer.
const rmCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
await rmCtx.addCookies(await ctx.cookies());
await rmCtx.route(/usmc-mccs\.org/, (r) => r.abort());
await rmCtx.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const rm = await rmCtx.newPage();
await rm.goto(base + "/quantico", { waitUntil: "networkidle" });
const rmAnim = await rm.locator("#mccs-assistant button.launcher").evaluate((el) => getComputedStyle(el).animationName);
check("Reduced motion: no shimmer", rmAnim === "none", rmAnim);
await rm.locator("#mccs-assistant button.launcher").click();
await rm.locator("#mccs-assistant button.minimize").click();
const rmGlow = await rm.locator("#mccs-assistant button.edge-tab").evaluate((el) => getComputedStyle(el).animationName);
check("Reduced motion: edge tab glow is static", rmGlow === "none", rmGlow);

check("No page errors", errors.length === 0, errors.join(" | "));
await browser.close();

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

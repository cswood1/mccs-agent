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
  "For a place to stay, see [Lodging](https://quantico.usmc-mccs.org/lodging), or compare [Pendleton lodging](https://pendleton.usmc-mccs.org/lodging) and [Lejeune lodging](https://lejeunenewriver.usmc-mccs.org/lodging).";
const FOLLOWUPS = ["Lane prices?", "Party packages?"];

// Waits until the widget's open/minimize animations (Web Animations, not the looping CSS ones) end.
async function settle(pg) {
  await pg.waitForFunction(() => {
    const r = document.querySelector("#mccs-assistant")?.shadowRoot;
    return !r || r.getAnimations().every((a) => a instanceof CSSAnimation || a.playState !== "running");
  }, null, { timeout: 4000 });
}

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
await settle(page);
await page.waitForTimeout(400);
const viewing = await w.locator(".context-line").textContent();
check("Viewing line on bowling page", /^Viewing: .*Bowling/i.test(viewing), viewing);
// docs/PRODUCT.md §13: name and AI signal.
check("Panel title is Ask MCCS", (await w.locator("#title").textContent())?.trim() === "Ask MCCS", await w.locator("#title").textContent());
check("Subtitle is the installation's short name", (await w.locator(".subtitle").textContent()) === "MCB Quantico", await w.locator(".subtitle").textContent());
check("Sparkle next to the title", (await w.locator("#title svg.sparkle").count()) === 1);
check("Composer placeholder before the first message", (await w.locator("textarea").getAttribute("placeholder")) === "Ask MCCS anything…", await w.locator("textarea").getAttribute("placeholder"));
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
const lstyle = await launcherCheck.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { font: cs.fontSize, pad: cs.paddingTop, color: cs.color, image: cs.backgroundImage, shadow: cs.boxShadow, sparkle: parseFloat(getComputedStyle(el.querySelector(".sparkle")).width) };
});
check("Launcher is larger (font, padding, sparkle)", lstyle.font === "17px" && lstyle.pad === "13px" && lstyle.sparkle >= 25, JSON.stringify(lstyle));
check("Launcher: solid MCCS red with white text (contrast > 7:1)", lstyle.image.startsWith("linear-gradient(rgb(158, 27, 50), rgb(158, 27, 50))") && lstyle.color === "rgb(255, 255, 255)", lstyle.image.slice(0, 60));
check("Launcher: 1px light ring and a crisp soft shadow", /rgba\(255, 255, 255, 0\.55\) 0px 0px 0px 1px/.test(lstyle.shadow) && /0px 10px 24px/.test(lstyle.shadow), lstyle.shadow);
const pstyle = await w.locator(".panel").evaluate((el) => { const cs = getComputedStyle(el); return { border: `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`, shadow: cs.boxShadow }; });
check("Panel: hairline border on the page side", pstyle.border === "1px solid rgba(17, 24, 39, 0.12)", pstyle.border);
check("Panel: floating shadow and a faint warm edge glow", /rgba\(15, 23, 42, 0\.3\) -20px 8px 56px -6px/.test(pstyle.shadow) && /rgba\(255, 199, 44, 0\.1\)/.test(pstyle.shadow), pstyle.shadow);

// Floating window (≥ 768px): flush right, below the demo banner, page visible above and below.
const win = await w.locator(".panel").evaluate((el) => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const banner = document.querySelector(".demo-banner").getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, right: r.right, width: r.width, height: r.height, bannerBottom: banner.bottom, vh: innerHeight, vw: innerWidth,
    radii: [cs.borderTopLeftRadius, cs.borderBottomLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius], overflow: cs.overflow };
});
check("Window: flush with the right edge, current width", Math.abs(win.right - win.vw) < 1 && win.width === 420, JSON.stringify(win));
check("Window: starts below the demo banner, page visible above and below", win.top >= win.bannerBottom + 20 && win.vh - win.bottom >= 20 && win.height <= 960, JSON.stringify(win));
check("Window: left corners rounded 18px, right side square, content clipped", JSON.stringify(win.radii) === JSON.stringify(["18px", "18px", "0px", "0px"]) && win.overflow === "hidden", JSON.stringify(win));
// Starter chips sit in the conversation under the welcome, with the "Suggested" label.
const starter = await w.locator(".chips").evaluate((el) => {
  const label = el.querySelector(".chips-label");
  const ls = getComputedStyle(label);
  return { inLog: el.parentElement.classList.contains("log"), afterThread: el.previousElementSibling?.classList.contains("thread"), label: label.textContent, size: ls.fontSize, transform: ls.textTransform, spacing: parseFloat(ls.letterSpacing) };
});
check("Starter chips in the conversation, under a small Suggested label", starter.inLog && starter.afterThread && starter.label === "Suggested" && starter.size === "11px" && starter.transform === "uppercase" && starter.spacing > 0, JSON.stringify(starter));
// Composer: the send button sits inside the field; the field shows a 2px navy ring on focus.
const comp = await w.locator(".composer").evaluate((form) => {
  const field = form.querySelector(".field").getBoundingClientRect();
  const send = form.querySelector(".send").getBoundingClientRect();
  const ta = form.querySelector("textarea");
  ta.focus();
  const fs = getComputedStyle(form.querySelector(".field"));
  return { inside: send.left >= field.left && send.right <= field.right + 0.5 && send.top >= field.top && send.bottom <= field.bottom + 0.5, sendRightOfInput: send.left >= ta.getBoundingClientRect().right - 0.5,
    sendSize: send.width, inputFont: getComputedStyle(ta).fontSize, taOutline: getComputedStyle(ta).outlineStyle, border: fs.borderColor, ring: fs.boxShadow, fieldHeight: field.height };
});
check("Composer: send button inside the field, on the right", comp.inside && comp.sendRightOfInput && comp.sendSize >= 44, JSON.stringify(comp));
check("Composer: slim single line, 16px text", comp.fieldHeight <= 48 && comp.inputFont === "16px", JSON.stringify(comp));
check("Composer: 2px navy focus ring, no gold outline", comp.border === "rgb(29, 57, 84)" && /rgb\(29, 57, 84\) 0px 0px 0px 1px/.test(comp.ring) && comp.taOutline === "none", JSON.stringify(comp));
// Bottom zone: faint tint, hairline divider, small one-line disclaimer.
const zone = await w.locator(".bottom").evaluate((el) => {
  const cs = getComputedStyle(el);
  const d = el.querySelector(".disclaimer");
  return { bg: cs.backgroundColor, border: `${cs.borderTopWidth} ${cs.borderTopStyle}`, disc: getComputedStyle(d).fontSize, discHeight: d.getBoundingClientRect().height, logBg: getComputedStyle(el.previousElementSibling).backgroundColor };
});
check("Bottom zone: faint tint and a hairline above it", zone.bg === "rgb(250, 250, 251)" && zone.border === "1px solid", JSON.stringify(zone));
check("Disclaimer: 11px, one line at this width", zone.disc === "11px" && zone.discHeight < 30, JSON.stringify(zone));

// 2. Ask via a chip: page context sent, follow-ups replace page chips, links rendered.
await w.locator(".chips .chip").first().click();
await w.locator(".msg.assistant a").first().waitFor();
await page.waitForTimeout(300);
const body1 = chatBodies[0] ?? {};
check("Sends current page path", body1.page?.path === "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", JSON.stringify(body1.page));
check("Sends title and URL", !!body1.page?.title && /bowling/.test(body1.page?.url ?? ""), body1.page?.title);
const followChips = await w.locator(".chips .chip").allTextContents();
check("Two follow-up chips after answer", JSON.stringify(followChips) === JSON.stringify(FOLLOWUPS), JSON.stringify(followChips));
check("Composer placeholder after the first message", (await w.locator("textarea").getAttribute("placeholder")) === "Ask a follow-up…", await w.locator("textarea").getAttribute("placeholder"));
// Follow-ups: inline, right under the latest answer, wrapping side by side, smaller than the answer.
const inline = await w.locator(".log").evaluate((log) => {
  const chips = log.querySelector(".chips");
  const last = log.querySelector(".thread").lastElementChild;
  const boxes = [...chips.querySelectorAll(".chip")].map((c) => c.getBoundingClientRect());
  const chip = getComputedStyle(chips.querySelector(".chip"));
  return { groups: log.getRootNode().querySelectorAll(".chips").length, lastIsAnswer: last.classList.contains("assistant"), gap: boxes[0].top - last.getBoundingClientRect().bottom,
    sameRow: boxes.length === 2 && Math.abs(boxes[0].top - boxes[1].top) < 1, chipFont: parseFloat(chip.fontSize), answerFont: parseFloat(getComputedStyle(last).fontSize),
    minHeight: boxes[0].height, pad: chip.padding, radius: chip.borderRadius, border: chip.borderTopStyle };
});
check("Follow-ups directly under the latest answer (one group in the panel)", inline.groups === 1 && inline.lastIsAnswer && inline.gap >= 0 && inline.gap <= 40, JSON.stringify(inline));
check("Follow-ups wrap side by side", inline.sameRow, JSON.stringify(inline));
check("Chip: 14px (smaller than the 15px answer), 6×12 padding, rounded, no border, 36px+", inline.chipFont === 14 && inline.chipFont < inline.answerFont && inline.pad === "6px 12px" && inline.radius === "18px" && inline.border === "none" && inline.minHeight >= 36, JSON.stringify(inline));
// AA contrast: chip text on its tint (rest and hover), the label and the disclaimer on their backgrounds.
const pairs = await w.locator(".panel").evaluate((panel) => {
  const chip = panel.querySelector(".chip");
  const label = panel.querySelector(".chips-label");
  const disc = panel.querySelector(".disclaimer");
  return [
    ["chip", getComputedStyle(chip).color, getComputedStyle(chip).backgroundColor],
    ["chip hover", getComputedStyle(chip).color, "rgb(239, 214, 219)"],
    ["label", getComputedStyle(label).color, getComputedStyle(panel.querySelector(".log")).backgroundColor],
    ["disclaimer", getComputedStyle(disc).color, getComputedStyle(panel.querySelector(".bottom")).backgroundColor],
  ];
});
const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const ratios = pairs.map(([name, fg, bg]) => [name, Math.round(ratio(fg, bg) * 10) / 10]);
check("AA contrast: chips, Suggested label and disclaimer", ratios.every(([, r]) => r >= 4.5), JSON.stringify(ratios));
const answerText = await w.locator(".msg.assistant").last().textContent();
check("Follow-up frame not shown as text", !answerText.includes("\u001e") && !answerText.includes("followups"), answerText.slice(-60));
const links = await w.locator(".msg.assistant").last().locator("a").evaluateAll((as) => as.map((a) => ({ text: a.textContent, href: a.getAttribute("href"), target: a.getAttribute("target") })));
check("Tap-to-call link", links.some((l) => l.href === "tel:7037842210"), JSON.stringify(links));
check("Map link for address", links.some((l) => /google\.com\/maps\/search/.test(l.href) && /2034%20Barnett/.test(l.href)), JSON.stringify(links.map((l) => l.href)));
check("Site link stays in tab, under /quantico", links.some((l) => l.href === "/quantico/lodging" && !l.target), JSON.stringify(links));
check("Other installation's link goes to its local path", links.some((l) => l.href === "/pendleton/lodging" && !l.target), JSON.stringify(links));
check("Lejeune site links go to /lejeune (not the subdomain slug)", links.some((l) => l.href === "/lejeune/lodging" && !l.target), JSON.stringify(links));

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
await p3.goto(base + "/quantico", { waitUntil: "networkidle" });
await p3.locator("#mccs-assistant button.launcher").click().catch(() => {});
const homeChips = await p3.locator("#mccs-assistant .chips .chip").allTextContents();
check("Home shows the default chips", homeChips[0] === "Just PCS’d here, where do I start?" && homeChips.length === 4, JSON.stringify(homeChips));

// 7. Multiple installations (docs/PRODUCT.md §12).
const p4 = await ctx2.newPage();
p4.on("pageerror", (e) => errors.push(e.message));
const res = await p4.goto(base + "/recreation-fitness/fitness", { waitUntil: "networkidle" });
check("Old path redirects to /quantico/...", p4.url().endsWith("/quantico/recreation-fitness/fitness") && res.ok(), p4.url());
await p4.goto(base + "/", { waitUntil: "networkidle" });
check("Root is Explore your MCCS (tests/ui/front-door-check.mjs)", new URL(p4.url()).pathname === "/" && (await p4.locator(".fd h1").textContent()) === "Explore your MCCS.", p4.url());
await p4.goto(base + "/quantico", { waitUntil: "networkidle" });
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
// Each base's pages show their own generated chips, not the home set.
const HAND_SET = {
  "pendleton/recreation-fitness/fitness/fitness-centers": ["Which gyms are open now?", "Paige Field House hours", "Weekend gym hours", "Can family members use the gym?"],
  "lejeune/marine-family-support/prevention-and-counseling": ["I need someone to talk to", "Is counseling confidential?", "Help with stress or anger", "How do I reach a victim advocate?"],
};
for (const [inst, path] of [["pendleton", "/recreation-fitness/fitness/fitness-centers"], ["lejeune", "/marine-family-support/child-and-youth/child-development-centers"], ["lejeune", "/marine-family-support/prevention-and-counseling"]]) {
  const info = await (await p4.request.get(`${base}/api/installations/${inst}/page?path=${path}`)).json();
  const home = await (await p4.request.get(`${base}/api/installations/${inst}/page?path=/`)).json();
  await p4.goto(`${base}/${inst}${path}`, { waitUntil: "networkidle" });
  if (!(await p4.locator("#mccs-assistant .panel").isVisible())) await p4.locator("#mccs-assistant button.launcher, #mccs-assistant button.edge-tab").first().click();
  await p4.locator("#mccs-assistant .chips .chip").first().waitFor();
  const shown = await p4.locator("#mccs-assistant .chips .chip").allTextContents();
  const manual = HAND_SET[inst + path];
  if (manual) check(`${inst}${path}: hand-set chips shown`, JSON.stringify(shown) === JSON.stringify(manual), JSON.stringify(shown));
  check(`${inst}: page shows its own chips`, info.chipsFrom === "page" && shown.length >= 2 && JSON.stringify(shown) === JSON.stringify(info.chips.slice(0, shown.length)) && !shown.some((c) => home.chips.includes(c)), JSON.stringify({ chipsFrom: info.chipsFrom, shown }));
}
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
// Page matches appear once the page index has loaded (slow right after a dev-server restart).
await lb.locator("[role=option]").nth(1).waitFor({ timeout: 10000 }).catch(() => {});
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
await settle(sp);
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
  const fb = await full.boundingBox();
  check(`${label}: full button is a 44px+ tap target and stays in the corner`, fb.height >= 52 && fb.width <= 200 && fb.x + fb.width <= viewport.width && fb.y + fb.height <= viewport.height, JSON.stringify(fb));
  // At the very end of the page the footer's last line sits above the launcher on phones only.
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(150);
  const clear = await p.evaluate(() => {
    const items = [...document.querySelectorAll("footer > .h-100 > :last-child li")].filter((li) => li.getBoundingClientRect().height > 0);
    const last = Math.max(...items.map((li) => li.getBoundingClientRect().bottom));
    const bar = document.querySelector("footer > .h-100 > :last-child");
    return { last, pad: parseFloat(getComputedStyle(bar).paddingBottom) };
  });
  const endBox = await full.boundingBox();
  if (mobile) check(`${label}: end of the page clears the launcher`, clear.last <= endBox.y, JSON.stringify({ footerEnd: clear.last, launcherTop: endBox.y }));
  else check(`${label}: no extra bottom padding`, clear.pad < 40, JSON.stringify(clear));
  await p.evaluate(() => window.scrollTo(0, 0));
  const fullBox = await full.boundingBox();
  await full.click();
  await settle(p);
  await p.waitForTimeout(300);
  const sheet = await wx.locator(".panel").evaluate((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: r.x, top: r.top, width: r.width, bottom: r.bottom, radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomLeftRadius], vh: innerHeight }; });
  if (mobile) check(`${label}: near-full-screen sheet, rounded top corners, small top gap`, sheet.x === 0 && sheet.width === viewport.width && sheet.top >= 6 && sheet.top <= 20 && Math.abs(sheet.bottom - sheet.vh) < 1 && JSON.stringify(sheet.radii) === JSON.stringify(["18px", "18px", "0px"]), JSON.stringify(sheet));
  else check(`${label}: floating window inset from top and bottom`, sheet.top > 40 && sheet.vh - sheet.bottom >= 20, JSON.stringify(sheet));
  const min = wx.locator("button.minimize");
  check(`${label}: header has a minimize button, no close X`, (await min.getAttribute("aria-label")) === "Minimize Ask MCCS" && (await wx.locator(".panel button.close").count()) === 0);
  const disc = wx.locator(".disclaimer");
  const discStyle = await disc.evaluate((el) => ({ size: getComputedStyle(el).fontSize, wrap: getComputedStyle(el).textWrap || getComputedStyle(el).textWrapStyle }));
  check(`${label}: disclaimer text, smaller, balanced`, (await disc.textContent()) === "SI answers can be wrong. Check the linked MCCS page before you go." && discStyle.size === "11px" && /balance/.test(discStyle.wrap), JSON.stringify(discStyle));
  await wx.locator("textarea").fill("Is it open late?");
  await wx.locator("textarea").press("Enter");
  await wx.locator(".msg.assistant").filter({ hasText: "Stub answer." }).waitFor();
  await min.click();
  await settle(p);
  check(`${label}: minimize hides the panel and shows the edge tab`, !(await wx.locator(".panel").isVisible()) && !(await full.isVisible()) && (await tab.isVisible()));
  check(`${label}: edge tab label and focus`, (await tab.getAttribute("aria-label")) === "Open Ask MCCS" && (await tab.evaluate((el) => el.getRootNode().activeElement === el)));
  const tabBox = await tab.boundingBox();
  check(`${label}: edge tab flush right, at the full button's height`, Math.abs(tabBox.x + tabBox.width - viewport.width) < 1 && Math.abs(tabBox.y + tabBox.height - (fullBox.y + fullBox.height)) <= 4 && tabBox.width >= 44 && tabBox.width <= 50 && tabBox.height >= 54, JSON.stringify({ tabBox, fullBox }));
  check(`${label}: edge tab pulses`, (await tab.evaluate((el) => getComputedStyle(el).animationName)) === "edge-glow");
  await tab.click();
  await settle(p);
  check(`${label}: edge tab reopens the panel with the chat`, (await wx.locator(".panel").isVisible()) && (await wx.locator(".msg.user").count()) === 1 && !(await tab.isVisible()));
  await wx.locator("textarea").press("Escape");
  await settle(p);
  check(`${label}: Escape minimizes to the edge tab`, !(await wx.locator(".panel").isVisible()) && (await tab.isVisible()));
  await p.goto(base + "/quantico/lodging", { waitUntil: "networkidle" });
  check(`${label}: navigation keeps the edge tab`, (await tab.isVisible()) && !(await full.isVisible()) && !(await wx.locator(".panel").isVisible()));
  await tab.click();
  await settle(p);
  await p.waitForTimeout(400);
  check(`${label}: chat history and page awareness after navigation`, (await wx.locator(".msg.user").count()) === 1 && /^Viewing: Lodging/i.test((await wx.locator(".context-line").textContent()) ?? ""));
  await p.reload({ waitUntil: "networkidle" });
  check(`${label}: reload shows the full button, panel closed`, (await full.isVisible()) && !(await tab.isVisible()) && !(await wx.locator(".panel").isVisible()));
  await full.click();
  await settle(p);
  check(`${label}: chat kept after reload`, (await wx.locator(".msg.user").count()) === 1);
  await min.click();
  await settle(p);
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
  await settle(p);
  await wx.locator("button.minimize").click();
  await settle(p);
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
  check("Edge tab collapsed: compact sparkle only", collapsed.width <= 50 && collapsed.labelOpacity === "0" && collapsed.labelWidth === 0, JSON.stringify(collapsed));
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
  check("Mouse leave tucks it back", (await tabState(tab)).width <= 50);
  // Keyboard: Escape from the panel puts keyboard focus on the tab, which expands it.
  await tab.click();
  await settle(p);
  await p.mouse.move(400, 400); // not hovering the tab, so only focus can expand it
  await wx.locator("textarea").press("Escape");
  await settle(p);
  await p.waitForTimeout(350);
  const focused = await tabState(tab);
  check("Keyboard focus expands the tab", focused.width > 100 && focused.labelOpacity === "1" && (await tab.evaluate((el) => el.matches(":focus-visible"))), JSON.stringify(focused));
  await p.keyboard.press("Shift+Tab");
  await p.waitForTimeout(350);
  check("Blur tucks it back", (await tabState(tab)).width <= 50);
  await p.context().close();
}
{
  const { p, wx, tab } = await tabPage({ width: 390, height: 844 }, true);
  check("Touch: no hover state", await p.evaluate(() => !matchMedia("(hover: hover)").matches));
  const before = await tabState(tab);
  await tab.tap();
  await settle(p);
  await p.waitForTimeout(300);
  check("Touch: a tap opens the panel directly", before.width <= 50 && (await wx.locator(".panel").isVisible()) && !(await tab.isVisible()), JSON.stringify(before));
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
await settle(rm);
await rm.locator("#mccs-assistant button.minimize").click();
await settle(rm);
const rmGlow = await rm.locator("#mccs-assistant button.edge-tab").evaluate((el) => getComputedStyle(el).animationName);
check("Reduced motion: edge tab glow is static", rmGlow === "none", rmGlow);

// Tool status line: shown in place of the typing dots while a tool runs, gone once text arrives,
// never saved. /api/chat is stubbed in the page with a stream that waits until the test releases it.
async function statusPage(extra = {}) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...extra });
  await c.addCookies(await ctx.cookies());
  await c.route(/usmc-mccs\.org/, (r) => r.abort());
  await c.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await c.addInitScript(() => {
    const realFetch = window.fetch;
    window.fetch = (url, opts) => {
      if (!String(url).includes("/api/chat")) return realFetch(url, opts);
      const enc = new TextEncoder();
      const body = new ReadableStream({
        async start(ctl) {
          ctl.enqueue(enc.encode(window.__before ?? ""));
          if (!window.__noStatus) ctl.enqueue(enc.encode("\u001dChecking Camp Pendleton…\u001d"));
          while (!window.__release) await new Promise((r) => setTimeout(r, 50));
          ctl.enqueue(enc.encode("Pendleton's relocation office handles sponsors."));
          ctl.enqueue(enc.encode("\u001e" + JSON.stringify({ followups: ["Pendleton lodging?"] })));
          ctl.close();
        },
      });
      return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } }));
    };
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/quantico", { waitUntil: "networkidle" });
  await p.locator("#mccs-assistant button.launcher").click();
  return { c, p, last: p.locator("#mccs-assistant .msg.assistant").last() };
}
{
  const { c, p, last } = await statusPage();
  await p.locator("#mccs-assistant textarea").fill("I'm PCSing to Pendleton next month, what should I set up?");
  await p.locator("#mccs-assistant textarea").press("Enter");
  await last.locator(".status").waitFor();
  check("Tool status shown while waiting (new wording)", (await last.locator(".status").textContent()) === "Checking Camp Pendleton…" && (await last.locator(".status").getAttribute("role")) === "status");
  check("Tool status replaces the thinking phrase", (await last.locator(".thinking").count()) === 0 && (await last.locator(".typing").count()) === 0);
  await p.evaluate(() => { window.__release = true; });
  await last.filter({ hasText: "relocation office" }).waitFor();
  await p.waitForTimeout(300);
  check("Status disappears when the answer arrives", (await last.locator(".status").count()) === 0 && !/Checking/.test((await last.textContent()) ?? ""));
  const saved = await p.evaluate(() => sessionStorage.getItem("mccs-assistant:quantico") ?? "");
  check("Status never saved in the chat history", saved.includes("relocation office") && !saved.includes("Checking") && !saved.includes("\u001d") && !saved.includes('"status"'), saved.slice(0, 160));
  check("Follow-ups still parsed after a status", (await p.locator("#mccs-assistant .chips .chip").allTextContents()).includes("Pendleton lodging?"));
  await c.close();
}
{
  // Text before the tool call: the status shows under it, then goes when more text comes.
  const { c, p, last } = await statusPage();
  await p.evaluate(() => { window.__before = "Sure. "; });
  await p.locator("#mccs-assistant textarea").fill("PCS to Pendleton?");
  await p.locator("#mccs-assistant textarea").press("Enter");
  await last.locator(".status").waitFor();
  check("Status shows under text written before the tool", /^Sure\./.test(((await last.textContent()) ?? "").trim()) && (await last.locator("p.status").count()) === 1);
  await p.evaluate(() => { window.__release = true; });
  await last.filter({ hasText: "relocation office" }).waitFor();
  check("…and goes when the answer continues", (await last.locator(".status").count()) === 0);
  await c.close();
}
{
  const { c, p, last } = await statusPage({ reducedMotion: "reduce" });
  await p.locator("#mccs-assistant textarea").fill("PCS to Pendleton?");
  await p.locator("#mccs-assistant textarea").press("Enter");
  await last.locator(".status").waitFor();
  const anim = await last.locator(".status").evaluate((el) => getComputedStyle(el).animationName);
  check("Reduced motion: status line doesn't pulse", anim === "none", anim);
  await p.evaluate(() => { window.__release = true; });
  await c.close();
}

// The bubble can be re-rendered between reads, leaving a detached element with no computed
// style; read the live one again until it has an animation name.
async function animationOf(loc) {
  for (let i = 0; i < 20; i++) {
    const name = await loc.evaluate((el) => (el.isConnected ? getComputedStyle(el).animationName : "")).catch(() => "");
    if (name) return name;
    await new Promise((r) => setTimeout(r, 50));
  }
  return "";
}

// Thinking phrase in place of typing dots: the same one on every message.
const THINKING = ["Hooking and jabbing, be right back…"];
{
  const { c, p } = await statusPage();
  await p.evaluate(() => { window.__noStatus = true; });
  const seen = [];
  for (let k = 0; k < 4; k++) {
    await p.evaluate(() => { window.__release = false; });
    await p.locator("#mccs-assistant textarea").fill(`Question ${k + 1}?`);
    await p.locator("#mccs-assistant textarea").press("Enter");
    const last = p.locator("#mccs-assistant .msg.assistant").last();
    await last.locator(".thinking").waitFor();
    seen.push({ text: await last.locator(".thinking").textContent(), role: await last.locator(".thinking").getAttribute("role"), dots: await last.locator(".typing").count(), anim: await animationOf(last.locator(".thinking")) });
    await p.evaluate(() => { window.__release = true; });
    await last.filter({ hasText: "relocation office" }).waitFor();
    if (k === 0) check("Thinking phrase clears when the answer starts", (await last.locator(".thinking").count()) === 0);
  }
  check("“Hooking and jabbing, be right back…” on every message, announced once (role=status), no dots", seen.length === 4 && seen.every((x) => x.text === THINKING[0] && x.role === "status" && x.dots === 0), JSON.stringify(seen));
  check("No random picker left", await p.evaluate(() => !("_pickThinking" in window.mccsAssistant)));
  const scroll = await p.locator("#mccs-assistant .panel").evaluate((panel) => {
    const log = panel.querySelector(".log");
    return { overflows: log.scrollHeight > log.clientHeight, overflowY: getComputedStyle(log).overflowY, panelHeight: panel.getBoundingClientRect().height, atEnd: log.scrollHeight - log.scrollTop - log.clientHeight < 2 };
  });
  check("Window: long conversations scroll inside it, at the same height", scroll.overflows && scroll.overflowY === "auto" && scroll.panelHeight <= 960 && scroll.atEnd, JSON.stringify(scroll));
  check("Thinking phrase shimmers", seen.every((x) => x.anim === "thinking-shimmer"), JSON.stringify(seen.map((x) => x.anim)));
  const saved = await p.evaluate(() => sessionStorage.getItem("mccs-assistant:quantico") ?? "");
  check("Thinking phrase never saved", !THINKING.some((t) => saved.includes(t)) && !saved.includes('"thinking"'), saved.slice(0, 120));
  await c.close();
}
{
  const { c, p } = await statusPage({ reducedMotion: "reduce" });
  await p.evaluate(() => { window.__noStatus = true; });
  await p.locator("#mccs-assistant textarea").fill("Pool hours?");
  await p.locator("#mccs-assistant textarea").press("Enter");
  const last = p.locator("#mccs-assistant .msg.assistant").last();
  await last.locator(".thinking").waitFor();
  const still = await animationOf(last.locator(".thinking"));
  check("Reduced motion: thinking phrase is static", still === "none", still);
  await p.evaluate(() => { window.__release = true; });
  await c.close();
}

// Open and minimize motion (Web Animations). The checks read each animation's timing and keyframes
// as it starts, then the settled state.
async function motionPage(viewport, mobile = false, extra = {}) {
  const c = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, ...extra });
  await c.addCookies(await ctx.cookies());
  await c.route(/usmc-mccs\.org/, (r) => r.abort());
  await c.route("**/api/warm", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await c.route("**/api/chat", (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "Stub answer." }));
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/quantico/recreation-fitness/recreation/indoor-recreation/bowling", { waitUntil: "networkidle" });
  return { c, p, wx: p.locator("#mccs-assistant") };
}
const motion = (pg) => pg.evaluate(() => {
  const r = document.querySelector("#mccs-assistant").shadowRoot;
  return r.getAnimations().filter((a) => !(a instanceof CSSAnimation)).map((a) => {
    const el = a.effect.target;
    const t = a.effect.getTiming();
    return { target: typeof el.className === "string" ? el.className : el.className.baseVal, inHead: !!el.closest("h2"), id: a.id, duration: t.duration, delay: t.delay, easing: t.easing,
      frames: a.effect.getKeyframes().map((k) => ({ transform: k.transform, opacity: k.opacity, filter: k.filter })), origin: el.style.transformOrigin };
  });
});
const widgetState = (pg) => pg.evaluate(() => {
  const r = document.querySelector("#mccs-assistant").shadowRoot;
  const panel = r.querySelector(".panel");
  const cs = getComputedStyle(panel);
  const tab = r.querySelector(".edge-tab");
  return { panels: r.querySelectorAll(".panel").length, open: !panel.hidden, opacity: cs.opacity, transform: cs.transform, pointer: cs.pointerEvents,
    tab: !tab.hidden, tabOpacity: getComputedStyle(tab).opacity, tabTransform: getComputedStyle(tab).transform, launcher: !r.querySelector(".launcher").hidden,
    focus: r.activeElement ? r.activeElement.id || r.activeElement.className : "", running: r.getAnimations().filter((a) => !(a instanceof CSSAnimation) && a.playState === "running").length };
});
const hasScale = (f, v) => typeof f === "string" && new RegExp(`scale\\(0?${v.replace(".", "\\.")}\\)`).test(f);
{
  const { c, p, wx } = await motionPage({ width: 1280, height: 800 });
  const lb = await wx.locator("button.launcher").boundingBox();
  await wx.locator("button.launcher").click();
  const opening = await motion(p);
  const offs = await wx.locator(".panel").evaluate((el) => ({ left: el.offsetLeft, top: el.offsetTop }));
  const pa = opening.find((a) => a.target === "panel");
  const [ox, oy] = (pa?.origin ?? "").split(" ").map(parseFloat);
  check("Open: the window grows out of the launcher (origin at its center)", Math.abs(ox - (lb.x + lb.width / 2 - offs.left)) <= 2 && Math.abs(oy - (lb.y + lb.height / 2 - offs.top)) <= 2, JSON.stringify({ origin: pa?.origin, lb, offs }));
  check("Open: scale 0.85 → 1 with a fade and a 24px slide, 360ms, spring ease", pa && pa.duration === 360 && /cubic-bezier\(0\.28, 1\.42, 0\.5, 1\)/.test(pa.easing) && hasScale(pa.frames[0].transform, ".85") && /translateX\(24px\)/.test(pa.frames[0].transform) && pa.frames[0].opacity === "0" && pa.frames[1].opacity === "1", JSON.stringify(pa));
  const inner = opening.filter((a) => ["head", "log", "bottom"].includes(a.target));
  check("Open: header, conversation, composer follow, 50ms apart, rising 10px", JSON.stringify(inner.map((a) => a.target)) === JSON.stringify(["head", "log", "bottom"]) && inner[1].delay - inner[0].delay === 50 && inner[2].delay - inner[1].delay === 50 && inner[0].delay > 0 && inner.every((a) => /translateY\(10px\)/.test(a.frames[0].transform)), JSON.stringify(inner.map((a) => [a.target, a.delay])));
  const hs = opening.filter((a) => a.inHead);
  check("Open: header sparkle bounces (1 → 1.3 → 0.95 → 1, glint) right after the window settles, 500ms", hs.length === 1 && hs[0].id === "spark-open" && hs[0].delay === 360 && hs[0].duration === 500 && hasScale(hs[0].frames[1].transform.split(" ")[0], "1.3") && /scale\(0\.95\)/.test(hs[0].frames[2].transform) && /rotate/.test(hs[0].frames[1].transform) && /brightness/.test(hs[0].frames[1].filter), JSON.stringify(hs));
  await settle(p);
  let st = await widgetState(p);
  check("Open: ends fully shown, no transform left, focus in the input", st.open && st.opacity === "1" && st.transform === "none" && st.running === 0 && st.focus === "input" && !st.tab && !st.launcher, JSON.stringify(st));
  const head = await wx.locator(".head").evaluate((el) => ({ h: el.getBoundingClientRect().height, btns: [...el.querySelectorAll(".icon-btn")].map((b) => b.getBoundingClientRect().height) }));
  check("Header about 72px, icon buttons still 44px", head.h >= 70 && head.h <= 74 && head.btns.every((h) => h >= 44), JSON.stringify(head));
  const tb = await wx.locator("button.minimize").boundingBox();
  await wx.locator("button.minimize").click();
  const closing = await motion(p);
  const pc = closing.find((a) => a.target === "panel");
  const pop = closing.find((a) => a.target === "edge-tab");
  const glint = closing.find((a) => a.target === "sparkle" && !a.inHead);
  check("Minimize: quicker (240ms), scales to 0.85 and fades out", pc && pc.duration === 240 && hasScale(pc.frames.at(-1).transform, ".85") && pc.frames.at(-1).opacity === "0", JSON.stringify(pc));
  const tabBox = await wx.locator("button.edge-tab").evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const [cx, cy] = (pc?.origin ?? "").split(" ").map(parseFloat);
  check("Minimize: toward the edge tab", Math.abs(cx - (tabBox.x - offs.left)) <= 12 && Math.abs(cy - (tabBox.y - offs.top)) <= 12, JSON.stringify({ origin: pc?.origin, tabBox, tb }));
  check("Minimize: the edge tab pops in after the window (0.75 → 1, clear overshoot) with a bright glint", pop && pop.delay === 240 && hasScale(pop.frames[0].transform, ".75") && pop.frames.some((f) => /scale\(1\.0[5-9]\)/.test(f.transform)) && glint && glint.delay > 240 && /rotate/.test(glint.frames[1].transform) && /brightness/.test(glint.frames[1].filter), JSON.stringify({ pop, glint }));
  check("Minimize: no header sparkle animation", !closing.some((a) => a.inHead), JSON.stringify(closing.filter((a) => a.inHead)));
  st = await widgetState(p);
  check("Minimize: focus moves to the edge tab at once", st.focus === "edge-tab", JSON.stringify(st));
  await settle(p);
  st = await widgetState(p);
  check("Minimize: ends with the window hidden and the edge tab fully shown", !st.open && st.tab && st.tabOpacity === "1" && st.tabTransform === "none" && st.running === 0 && st.focus === "edge-tab", JSON.stringify(st));

  // Rapid toggling (clicks a few frames apart) leaves exactly one correct state.
  const toggle = (seq) => p.evaluate(async (seq) => {
    const r = document.querySelector("#mccs-assistant").shadowRoot;
    for (const sel of seq) {
      r.querySelector(sel).click();
      await new Promise((res) => setTimeout(res, 45));
    }
  }, seq);
  await toggle([".edge-tab", ".minimize", ".edge-tab", ".minimize"]);
  await settle(p);
  st = await widgetState(p);
  check("Rapid toggling ending minimized: one window, hidden; edge tab shown and focused", st.panels === 1 && !st.open && st.tab && st.tabOpacity === "1" && st.tabTransform === "none" && st.focus === "edge-tab" && st.pointer === "auto", JSON.stringify(st));
  await toggle([".edge-tab", ".minimize", ".edge-tab"]);
  await settle(p);
  st = await widgetState(p);
  const box = await wx.locator(".panel").boundingBox();
  check("Rapid toggling ending open: one window, fully shown, in place, focus in the input", st.panels === 1 && st.open && st.opacity === "1" && st.transform === "none" && st.pointer === "auto" && !st.tab && st.focus === "input" && Math.abs(box.x + box.width - 1280) < 1 && box.y > 40, JSON.stringify({ st, box }));
  await c.close();
}
{
  const { c, p, wx } = await motionPage({ width: 1280, height: 800 }, false, { reducedMotion: "reduce" });
  await wx.locator("button.launcher").click();
  const o = await motion(p);
  await settle(p);
  await wx.locator("button.minimize").click();
  const m = await motion(p);
  const onlyOpacity = (list) => list.length > 0 && list.every((a) => a.frames.every((f) => f.transform === undefined && f.filter === undefined && f.opacity !== undefined) && a.duration === 150);
  check("Reduced motion: open and minimize are 150ms fades (opacity only, no stagger or glint)", onlyOpacity(o) && o.length === 1 && onlyOpacity(m) && !m.some((a) => a.target === "sparkle"), JSON.stringify({ o, m }));
  await settle(p);
  const st = await widgetState(p);
  check("Reduced motion: ends minimized, edge tab focused", !st.open && st.tab && st.tabOpacity === "1" && st.focus === "edge-tab", JSON.stringify(st));
  await c.close();
}
{
  const { c, p, wx } = await motionPage({ width: 390, height: 844 }, true);
  await wx.locator("button.launcher").click();
  const o = (await motion(p)).find((a) => a.target === "panel");
  check("Phone: the sheet slides up (280ms, the stronger spring)", o && o.duration === 280 && o.frames[0].transform === "translateY(100%)" && /none/.test(o.frames.at(-1).transform) && /cubic-bezier\(0\.28, 1\.42/.test(o.easing), JSON.stringify(o));
  await settle(p);
  let st = await widgetState(p);
  check("Phone: open sheet settles in place", st.open && st.transform === "none" && st.opacity === "1", JSON.stringify(st));
  await wx.locator("button.minimize").click();
  const m = (await motion(p)).find((a) => a.target === "panel");
  check("Phone: minimize slides the sheet down (280ms)", m && m.duration === 280 && m.frames.at(-1).transform === "translateY(100%)", JSON.stringify(m));
  await settle(p);
  st = await widgetState(p);
  check("Phone: ends minimized with the edge tab", !st.open && st.tab && st.focus === "edge-tab", JSON.stringify(st));
  await c.close();
}

// Header sparkle: a bounce-and-shake on send, a soft repeat every 1.5 s only while waiting, stopped by
// the first answer text, minimize, or the end of the reply; nothing with reduced motion.
const headSpark = (pg) => pg.evaluate(() => {
  const el = document.querySelector("#mccs-assistant").shadowRoot.querySelector("#title .sparkle");
  return el.getAnimations().map((a) => ({ id: a.id, state: a.playState, duration: a.effect.getTiming().duration, frames: a.effect.getKeyframes().map((k) => k.transform) }));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
{
  const { c, p } = await statusPage();
  await p.evaluate(() => { window.__noStatus = true; });
  await settle(p);
  const ask = async (q) => { await p.locator("#mccs-assistant textarea").fill(q); await p.locator("#mccs-assistant textarea").press("Enter"); };
  await ask("Pool hours?");
  const sent = await headSpark(p);
  check("Send: one bounce-and-shake (±12° twice), 600ms", sent.length === 1 && sent[0].id === "spark-send" && sent[0].duration === 600 && sent[0].frames.filter((f) => /rotate\(12deg\)/.test(f)).length === 2 && sent[0].frames.filter((f) => /rotate\(-12deg\)/.test(f)).length === 2 && sent[0].frames.some((f) => /scale\(1\.2/.test(f)), JSON.stringify(sent));
  await wait(1700);
  const soft1 = await headSpark(p);
  await wait(1500);
  const soft2 = await headSpark(p);
  check("Waiting: a softer repeat every 1.5 s, one at a time", soft1.length === 1 && soft1[0].id === "spark-soft" && soft2.length === 1 && soft2[0].id === "spark-soft", JSON.stringify({ soft1, soft2 }));
  await p.evaluate(() => { window.__release = true; });
  await p.locator("#mccs-assistant .msg.assistant").last().filter({ hasText: "relocation office" }).waitFor();
  const done = await headSpark(p);
  await wait(1700);
  check("First answer text stops the sparkle, no repeat after", done.length === 0 && (await headSpark(p)).length === 0, JSON.stringify(done));
  // Minimize while waiting stops it.
  await p.evaluate(() => { window.__release = false; });
  await ask("Gym hours?");
  await wait(200);
  await p.locator("#mccs-assistant button.minimize").click();
  await settle(p);
  await wait(1700);
  check("Minimize while waiting stops the sparkle", (await headSpark(p)).length === 0, JSON.stringify(await headSpark(p)));
  await p.evaluate(() => { window.__release = true; });
  await p.locator("#mccs-assistant button.edge-tab").click();
  await p.locator("#mccs-assistant .msg.assistant").last().filter({ hasText: "relocation office" }).waitFor();
  await settle(p);
  // Rapid sends (answers stream straight away): ends with no sparkle running or repeating.
  for (const q of ["One?", "Two?", "Three?"]) { await ask(q); await wait(30); }
  await p.waitForFunction(() => !document.querySelector("#mccs-assistant").shadowRoot.querySelector(".thinking"));
  await wait(1700);
  const after = await p.evaluate(() => {
    const r = document.querySelector("#mccs-assistant").shadowRoot;
    return { panels: r.querySelectorAll(".panel").length, open: !r.querySelector(".panel").hidden, thinking: r.querySelectorAll(".thinking").length, sendDisabled: r.querySelector(".send").disabled, spark: r.querySelector("#title .sparkle").getAnimations().length };
  });
  check("Rapid sends end clean: no sparkle running or repeating, ready for the next question", after.panels === 1 && after.open && after.thinking === 0 && !after.sendDisabled && after.spark === 0, JSON.stringify(after));
  await c.close();
}
{
  const { c, p } = await statusPage({ reducedMotion: "reduce" });
  await p.evaluate(() => { window.__noStatus = true; });
  const onOpen = await headSpark(p);
  await p.locator("#mccs-assistant textarea").fill("Pool hours?");
  await p.locator("#mccs-assistant textarea").press("Enter");
  const onSend = await headSpark(p);
  await wait(1700);
  check("Reduced motion: no sparkle animation on open, send or while waiting", onOpen.length === 0 && onSend.length === 0 && (await headSpark(p)).length === 0, JSON.stringify({ onOpen, onSend }));
  await p.evaluate(() => { window.__release = true; });
  await c.close();
}

// Hover sparkle: the header's open bounce on the launcher, edge tab and header search sparkles.
// Once per pointer entry or keyboard focus, never stacked; not for touch or reduced motion.
const sparkAnims = (pg, where) => pg.evaluate((where) => {
  const r = document.querySelector("#mccs-assistant").shadowRoot;
  const el = where === "launcher" ? r.querySelector(".launcher .sparkle") : where === "tab" ? r.querySelector(".edge-tab .sparkle")
    : where === "search" ? document.querySelector("#desktop-search-container .mccs-ask-icon") : document.querySelector(".mobile-search-trigger .mccs-ask-icon");
  return el.getAnimations().filter((a) => a.playState === "running").map((a) => ({ id: a.id, duration: a.effect.getTiming().duration, start: a.startTime, frames: a.effect.getKeyframes().map((k) => k.transform) }));
}, where);
const isHeaderBounce = (list) => list.length === 1 && list[0].id === "spark-open" && list[0].duration === 500 && /scale\(1\.3\)/.test(list[0].frames[1]) && /scale\(0\.95\)/.test(list[0].frames[2]);
async function hoverChecks(label, pg, where, control) {
  await pg.mouse.move(2, 400);
  await wait(600);
  await control.hover();
  const first = await sparkAnims(pg, where);
  check(`Hover sparkle (${label}): hovering plays the header's bounce once`, isHeaderBounce(first), JSON.stringify(first));
  const bx = await control.boundingBox();
  for (let i = 0; i < 3; i++) { await pg.mouse.move(2, 400); await pg.mouse.move(bx.x + bx.width - 8, bx.y + bx.height / 2); }
  const rapid = await sparkAnims(pg, where);
  check(`Hover sparkle (${label}): rapid in-and-out doesn't restart or stack`, rapid.length === 1 && rapid[0].start === first[0]?.start, JSON.stringify({ first, rapid }));
  await pg.mouse.move(2, 400);
  await wait(650);
  check(`Hover sparkle (${label}): done after about 500ms`, (await sparkAnims(pg, where)).length === 0);
  await control.hover();
  const again = await sparkAnims(pg, where);
  check(`Hover sparkle (${label}): hovering again plays it again`, isHeaderBounce(again) && again[0].start !== first[0]?.start, JSON.stringify(again));
  await pg.mouse.move(2, 400);
  await wait(650);
}
{
  const { c, p, wx } = await motionPage({ width: 1280, height: 800 });
  await wait(2400); // the launcher's load shimmer is CSS; let the page settle
  await hoverChecks("launcher", p, "launcher", wx.locator("button.launcher"));
  await p.locator("#main-search-input").evaluate((el) => el.blur());
  await wx.locator("button.launcher").focus();
  check("Hover sparkle (launcher): keyboard focus plays it once", isHeaderBounce(await sparkAnims(p, "launcher")));
  await wait(650);
  await hoverChecks("header search", p, "search", p.locator("#main-search-input"));
  await p.locator("#main-search-input").focus();
  check("Hover sparkle (header search): keyboard focus plays it once", isHeaderBounce(await sparkAnims(p, "search")));
  await p.keyboard.press("Escape");
  await p.locator("#main-search-input").evaluate((el) => el.blur());
  await wait(650);
  await wx.locator("button.launcher").click();
  await settle(p);
  await wx.locator("button.minimize").click();
  await settle(p);
  await hoverChecks("edge tab", p, "tab", wx.locator("button.edge-tab"));
  await wx.locator("button.edge-tab").hover();
  const during = await sparkAnims(p, "tab");
  await wait(300);
  const slid = await wx.locator(".edge-label").evaluate((el) => ({ opacity: getComputedStyle(el).opacity, width: el.getBoundingClientRect().width }));
  check("Hover sparkle (edge tab): the slide-out still happens alongside", isHeaderBounce(during) && slid.opacity === "1" && slid.width > 40, JSON.stringify({ during, slid }));
  await p.mouse.move(2, 400);
  await wait(650);
  await wx.locator("button.edge-tab").evaluate((el) => el.blur());
  await wx.locator("button.edge-tab").focus();
  check("Hover sparkle (edge tab): keyboard focus plays it once", isHeaderBounce(await sparkAnims(p, "tab")));
  await c.close();
}
{
  // Phone-width layout with a mouse: the header search icon.
  const { c, p } = await motionPage({ width: 390, height: 844 });
  await hoverChecks("phone search icon", p, "mobile", p.locator(".mobile-search-trigger"));
  await c.close();
}
{
  const { c, p, wx } = await motionPage({ width: 390, height: 844 }, true);
  await p.locator(".mobile-search-trigger").tap();
  const searchTap = await sparkAnims(p, "mobile");
  await p.locator("#mccs-ask-sheet").evaluate((el) => el.querySelector("button")?.click());
  await wx.locator("button.launcher").tap();
  const launcherTap = await sparkAnims(p, "launcher");
  check("Touch: a tap opens without the hover sparkle", searchTap.length === 0 && launcherTap.length === 0 && (await wx.locator(".panel").isVisible()), JSON.stringify({ searchTap, launcherTap }));
  await c.close();
}
{
  const { c, p, wx } = await motionPage({ width: 1280, height: 800 }, false, { reducedMotion: "reduce" });
  await wx.locator("button.launcher").hover();
  const l = await sparkAnims(p, "launcher");
  await p.locator("#main-search-input").hover();
  const sch = await sparkAnims(p, "search");
  await wx.locator("button.launcher").focus();
  const f = await sparkAnims(p, "launcher");
  check("Reduced motion: no hover or focus sparkle", l.length === 0 && sch.length === 0 && f.length === 0, JSON.stringify({ l, sch, f }));
  await c.close();
}

check("No page errors", errors.length === 0, errors.join(" | "));
await browser.close();

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

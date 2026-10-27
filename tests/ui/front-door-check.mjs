/**
 * Front door (/) checks with stubbed APIs: the chat stream, speech synthesis and speech
 * recognition are all fakes in the page (no Claude calls, no microphone).
 *
 *   node --env-file=.env.local tests/ui/front-door-check.mjs [baseUrl]
 *
 * Uses the locally installed Google Chrome. Every request to *.usmc-mccs.org is blocked.
 */
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const code = process.env.DEMO_ACCESS_CODE?.trim();
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const errors = [];

const ANSWER =
  "Start with **MilitaryChildCare.com**: create an account and request care. Call Resource & Referral at 760-725-3400, or stop by 2034 Barnett Ave.\n\n" +
  "Details: [Child Development Centers](https://pendleton.usmc-mccs.org/marine-family-support/child-and-youth/child-development-centers)";
const FOLLOWUPS = ["Where are the CDCs?", "How does the waitlist work?"];

const browser = await chromium.launch({ executablePath: CHROME });
const cookie = code ? [{ name: "mccs_demo_access", value: createHash("sha256").update(`mccs-demo-access:${code}`).digest("hex"), url: base }] : [];

/** A page with the chat and speech fakes installed. `opts.recognition: false` leaves out SpeechRecognition. */
async function open(opts = {}) {
  const c = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 900 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, reducedMotion: opts.reducedMotion });
  if (cookie.length) await c.addCookies(cookie);
  await c.route(/usmc-mccs\.org/, (r) => r.abort());
  await c.addInitScript(
    ({ answer, followups, recognition }) => {
      // Chat: a stream that can hold a tool status until the test releases it.
      window.__chatBodies = [];
      const realFetch = window.fetch;
      window.fetch = (url, init) => {
        if (!String(url).includes("/api/chat")) return realFetch(url, init);
        window.__chatBodies.push(JSON.parse(init.body));
        const enc = new TextEncoder();
        const body = new ReadableStream({
          async start(ctl) {
            if (window.__withStatus) {
              ctl.enqueue(enc.encode("\u001dChecking the live MCCS page…\u001d"));
              while (!window.__release) await new Promise((r) => setTimeout(r, 30));
            }
            ctl.enqueue(enc.encode(answer));
            ctl.enqueue(enc.encode("\u001e" + JSON.stringify({ followups })));
            ctl.close();
          },
        });
        return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } }));
      };
      // Speech synthesis: record what would be read aloud.
      window.__spoken = [];
      window.__cancels = 0;
      const synth = {
        speak: (u) => window.__spoken.push({ text: u.text, rate: u.rate }),
        cancel: () => window.__cancels++,
        getVoices: () => [],
        speaking: false,
        pending: false,
        paused: false,
        addEventListener() {},
        removeEventListener() {},
      };
      Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
      // Speech recognition: the test drives results and the end of speech.
      if (recognition) {
        class FakeRecognition {
          start() {
            window.__rec = this;
          }
          stop() {
            this.onend?.();
          }
          abort() {}
        }
        window.SpeechRecognition = FakeRecognition;
        window.webkitSpeechRecognition = FakeRecognition;
      } else {
        delete window.SpeechRecognition;
        delete window.webkitSpeechRecognition;
      }
    },
    { answer: ANSWER, followups: FOLLOWUPS, recognition: opts.recognition !== false },
  );
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  if (opts.clock) await p.clock.install();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  return { c, p };
}

const ask = async (p, q) => {
  await p.locator("#fd-ask-input").fill(q);
  await p.locator("#fd-ask-input").press("Enter");
  await p.locator(".fd-a").last().locator(".fd-md").waitFor();
  await p.locator(".fd-followups").waitFor();
};

// 0. Access gate still guards the front door.
{
  const c = await browser.newContext();
  const p = await c.newPage();
  await p.goto(base + "/");
  check("Access gate: / without the code goes to /access", !code || /\/access/.test(p.url()), p.url());
  await c.close();
}

// 1. Hero: headline, installation selector, chips, moments, installation cards, trust strip.
{
  const { c, p } = await open();
  check("/ is the front door (no redirect)", new URL(p.url()).pathname === "/", p.url());
  check("Headline: “Ask MCCS anything.” with Ask MCCS in red", (await p.locator("h1").textContent()) === "Ask MCCS anything." && (await p.locator("h1 .fd-red").textContent()) === "Ask MCCS");
  const red = await p.locator("h1 .fd-red").evaluate((el) => getComputedStyle(el).color);
  check("Headline red is the MCCS red", red === "rgb(158, 27, 50)", red);
  check("Serif headline, sans body", /Fraunces/.test(await p.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)) && /Inter/.test(await p.locator(".fd").evaluate((el) => getComputedStyle(el).fontFamily)));
  const options = await p.locator("#fd-inst-select option").allTextContents();
  check("Installation selector lists the three bases", JSON.stringify(options) === JSON.stringify(["MCCS Quantico", "MCCS Camp Pendleton", "MCCS Lejeune-New River"]), JSON.stringify(options));
  const qCfg = await (await p.request.get(base + "/api/installations/quantico")).json();
  check("Starter chips from Quantico's defaultChips", JSON.stringify(await p.locator(".fd-hero .fd-chip").allTextContents()) === JSON.stringify(qCfg.defaultChips.slice(0, 4)));
  check("Five moment cards", (await p.locator(".fd-moments .fd-card").count()) === 5);
  const baseLinks = await p.locator(".fd-bases a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("Installation cards link to /quantico, /pendleton, /lejeune", JSON.stringify(baseLinks) === JSON.stringify(["/quantico", "/pendleton", "/lejeune"]), JSON.stringify(baseLinks));
  check("Trust strip", /^Answers come from official MCCS pages · captured Oct 26 · links to every source\.$/.test(((await p.locator(".fd-trust-strip").textContent()) ?? "").trim()));
  check("Ask box is labeled; mic and send have names", (await p.locator("label[for=fd-ask-input]").textContent()) === "Ask MCCS" && (await p.locator(".fd-mic").getAttribute("aria-label")) === "Ask by voice" && (await p.locator(".fd-send").getAttribute("aria-label")) === "Send");

  // Installation choice is remembered.
  await p.locator("#fd-inst-select").selectOption("pendleton");
  check("Selected installation saved", (await p.evaluate(() => localStorage.getItem("mccs-front:installation"))) === "pendleton");
  await p.reload({ waitUntil: "networkidle" });
  const pCfg = await (await p.request.get(base + "/api/installations/pendleton")).json();
  check("Selected installation restored after reload", (await p.locator("#fd-inst-select").inputValue()) === "pendleton" && JSON.stringify(await p.locator(".fd-hero .fd-chip").allTextContents()) === JSON.stringify(pCfg.defaultChips.slice(0, 4)));
  check("Trust strip uses the base's capture date", /captured Oct 27/.test((await p.locator(".fd-trust-strip").textContent()) ?? ""));

  // Display menu.
  const displayBtn = p.locator(".fd-display > .fd-btn");
  await displayBtn.click();
  check("Display menu opens", (await displayBtn.getAttribute("aria-expanded")) === "true" && (await p.locator("#fd-display-panel").isVisible()));
  const heroSize = await p.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await p.getByLabel("Dark").check();
  await p.getByLabel("Large text").check();
  await p.getByLabel("High contrast").check();
  const attrs = await p.locator(".fd").evaluate((el) => [el.dataset.theme, el.dataset.text, el.dataset.contrast, getComputedStyle(el).backgroundColor]);
  check("Dark + large text + high contrast applied", JSON.stringify(attrs.slice(0, 3)) === JSON.stringify(["dark", "large", "high"]) && attrs[3] === "rgb(0, 0, 0)", JSON.stringify(attrs));
  check("Large text enlarges the hero", (await p.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) > heroSize * 1.15);
  await p.keyboard.press("Escape");
  check("Escape closes the menu and returns focus", !(await p.locator("#fd-display-panel").isVisible()) && (await displayBtn.evaluate((el) => document.activeElement === el)));
  await p.reload({ waitUntil: "networkidle" });
  check("Display settings remembered", JSON.stringify(await p.locator(".fd").evaluate((el) => [el.dataset.theme, el.dataset.text, el.dataset.contrast])) === JSON.stringify(["dark", "large", "high"]));
  await p.evaluate(() => localStorage.removeItem("mccs-front:display"));
  await c.close();
}

// 2. Asking: hero docks, the answer streams in a reading column, links, trust line, follow-ups.
{
  const { c, p } = await open();
  await p.locator("#fd-inst-select").selectOption("pendleton");
  await ask(p, "How do I get child care?");
  check("Hero becomes the compact top bar", (await p.locator(".fd.fd--chat").count()) === 1 && (await p.locator(".fd-dock #fd-ask-input").isVisible()) && (await p.locator(".fd-hero").count()) === 0);
  const body = (await p.evaluate(() => window.__chatBodies))[0] ?? {};
  check("Asks /api/chat for the selected base, from the front door", body.installationId === "pendleton" && body.page?.path === "/" && body.messages?.length === 1, JSON.stringify(body).slice(0, 200));
  const links = await p.locator(".fd-a .fd-md a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("Tap-to-call link", links.includes("tel:7607253400"), JSON.stringify(links));
  check("Map link for the street address", links.some((l) => /google\.com\/maps\/search/.test(l) && /2034%20Barnett/.test(l)), JSON.stringify(links));
  check("MCCS link goes to the demo page", links.includes("/pendleton/marine-family-support/child-and-youth/child-development-centers"), JSON.stringify(links));
  await p.locator(".fd-trust").waitFor();
  check("Trust line from the first MCCS link", (await p.locator(".fd-trust").textContent()) === "From MCCS Camp Pendleton · Child Development Centers · checked Oct 27", await p.locator(".fd-trust").textContent());
  check("Follow-up chips", JSON.stringify(await p.locator(".fd-followups .fd-chip").allTextContents()) === JSON.stringify(FOLLOWUPS));
  check("Conversation is a polite live log", (await p.locator(".fd-conv").getAttribute("role")) === "log" && (await p.locator(".fd-conv").getAttribute("aria-live")) === "polite");
  check("Docked ask box placeholder", (await p.locator("#fd-ask-input").getAttribute("placeholder")) === "Ask a follow-up…");

  // Read aloud.
  await p.getByRole("button", { name: "Listen" }).click();
  let spoken = await p.evaluate(() => window.__spoken);
  check("Listen reads the answer aloud without markdown or urls", spoken.length === 1 && spoken[0].rate === 1 && /^Start with MilitaryChildCare\.com/.test(spoken[0].text) && !/https?:|\*\*|\]\(/.test(spoken[0].text), JSON.stringify(spoken[0]));
  check("Stop control while reading", await p.getByRole("button", { name: "Stop" }).isVisible());
  const cancels = await p.evaluate(() => window.__cancels);
  await p.getByRole("button", { name: "Stop" }).click();
  check("Stop cancels speech", (await p.evaluate(() => window.__cancels)) > cancels && (await p.getByRole("button", { name: "Listen" }).isVisible()));
  await p.getByRole("button", { name: "Slow" }).click();
  check("Slow toggle is pressed", (await p.getByRole("button", { name: "Slow" }).getAttribute("aria-pressed")) === "true");
  await p.getByRole("button", { name: "Listen" }).click();
  spoken = await p.evaluate(() => window.__spoken);
  check("Slow reads at a lower rate", Math.abs(spoken.at(-1).rate - 0.8) < 0.01, JSON.stringify(spoken.at(-1)));

  // History carries the conversation; follow-up chip asks.
  await p.locator(".fd-followups .fd-chip").first().click();
  await p.waitForFunction(() => window.__chatBodies.length === 2);
  const b2 = (await p.evaluate(() => window.__chatBodies))[1];
  check("Follow-up chip asks with the conversation so far", b2.messages.length === 3 && b2.messages[2].content === FOLLOWUPS[0] && b2.messages.every((m) => typeof m.content === "string" && !("status" in m)));

  // New conversation.
  await p.locator(".fd-followups").waitFor();
  await p.getByRole("button", { name: "New conversation" }).click();
  await p.locator(".fd.fd--hero").waitFor();
  await p.waitForFunction(() => document.activeElement?.id === "fd-ask-input", null, { timeout: 2000 }).catch(() => {});
  check("New conversation returns to the full hero", (await p.locator(".fd.fd--hero").count()) === 1 && (await p.locator("h1").textContent()) === "Ask MCCS anything." && (await p.locator("#fd-ask-input").evaluate((el) => document.activeElement === el)));

  // Switching installation mid-conversation starts fresh.
  await ask(p, "Where can I stay?");
  await p.locator("#fd-inst-select").selectOption("lejeune");
  check("Switching installation starts a fresh conversation", (await p.locator(".fd.fd--hero").count()) === 1 && (await p.locator(".fd-q").count()) === 0);
  await ask(p, "Where can I stay?");
  const b4 = (await p.evaluate(() => window.__chatBodies)).at(-1);
  check("…asking the new base with no old turns", b4.installationId === "lejeune" && b4.messages.length === 1, JSON.stringify(b4).slice(0, 120));

  // Moment card.
  await p.getByRole("button", { name: "New conversation" }).click();
  await p.locator(".fd-card[data-moment=arrived]").click();
  await p.locator(".fd-q").first().waitFor();
  check("Moment card opens with its question", (await p.locator(".fd-q").first().textContent()) === "I just arrived at MCB Camp Lejeune. Can you give me a First 7 Days plan?", await p.locator(".fd-q").first().textContent());

  // Conversation survives following a link and coming back.
  await p.locator(".fd-followups").waitFor();
  await p.reload({ waitUntil: "networkidle" });
  check("Conversation restored in the tab", (await p.locator(".fd.fd--chat").count()) === 1 && (await p.locator(".fd-q").count()) === 1);
  await c.close();
}

// 3. Tool status in place of the typing dots.
{
  const { c, p } = await open();
  await p.evaluate(() => { window.__withStatus = true; });
  await p.locator("#fd-ask-input").fill("Is the pool open now?");
  await p.locator("#fd-ask-input").press("Enter");
  await p.locator(".fd-status").waitFor();
  check("Status line while a tool runs", (await p.locator(".fd-status").textContent()) === "Checking the live MCCS page…" && (await p.locator(".fd-typing").count()) === 0);
  await p.evaluate(() => { window.__release = true; });
  await p.locator(".fd-a .fd-md").waitFor();
  check("Status gone when the answer arrives", (await p.locator(".fd-status").count()) === 0);
  await p.locator(".fd-followups").waitFor();
  check("Status never saved", !(await p.evaluate(() => sessionStorage.getItem("mccs-front:conversation") ?? "")).includes("Checking"));
  await c.close();
}

// 4. Voice: live caption, auto-send when speech ends, answer read aloud.
{
  const { c, p } = await open();
  await p.locator(".fd-mic").click();
  check("Mic starts listening", (await p.locator(".fd-mic").getAttribute("aria-pressed")) === "true" && (await p.locator(".fd-mic").getAttribute("aria-label")) === "Stop listening");
  await p.evaluate(() => window.__rec.onresult({ resultIndex: 0, results: [[{ transcript: "Where can I" }]] }));
  await p.locator(".fd-caption q").waitFor({ timeout: 2000 }).catch(() => {});
  check("Live transcript caption", /Listening… “?Where can I/.test((await p.locator(".fd-caption").textContent()) ?? ""), await p.locator(".fd-caption").textContent());
  await p.evaluate(() => {
    window.__rec.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "Where can I stay on base?" }], { isFinal: true })] });
    window.__rec.onend();
  });
  await p.locator(".fd-followups").waitFor();
  check("Auto-sends when speech ends", (await p.locator(".fd-q").first().textContent()) === "Where can I stay on base?");
  const spoken = await p.evaluate(() => window.__spoken);
  check("Spoken question: answer read aloud automatically", spoken.length === 1 && /^Start with/.test(spoken[0].text), JSON.stringify(spoken));
  await c.close();
}
{
  const { c, p } = await open({ recognition: false });
  check("Mic hidden without SpeechRecognition", (await p.locator(".fd-mic").count()) === 0);
  await c.close();
}

// 5. Placeholder rotation, and reduced motion.
{
  const { c, p } = await open({ clock: true });
  const first = await p.locator("#fd-ask-input").getAttribute("placeholder");
  await p.clock.runFor(3100);
  const second = await p.locator("#fd-ask-input").getAttribute("placeholder");
  check("Ask box placeholder rotates", first !== second && !!second, `${first} -> ${second}`);
  await c.close();
}
{
  const { c, p } = await open({ clock: true, reducedMotion: "reduce" });
  const first = await p.locator("#fd-ask-input").getAttribute("placeholder");
  await p.clock.runFor(10000);
  check("Reduced motion: placeholder stays put", (await p.locator("#fd-ask-input").getAttribute("placeholder")) === first);
  await ask(p, "Gym hours today?");
  check("Reduced motion: no dock animation", (await p.locator(".fd-dock").evaluate((el) => getComputedStyle(el).animationName)) === "none");
  await c.close();
}

// 6. Phones (375px): no sideways scroll, placeholder fits, top bar usable, large text reaches answers.
{
  const { c, p } = await open({ viewport: { width: 375, height: 812 }, mobile: true });
  check("375px hero: no horizontal overflow", (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  const fits = await p.locator("#fd-ask-input").evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  check("375px: ask box shows its whole placeholder", fits);
  await ask(p, "How do I get child care?");
  check("375px chat: no horizontal overflow", (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  check("375px chat: installation selector stays usable", (await p.locator("#fd-inst-select").evaluate((el) => el.getBoundingClientRect().width)) >= 150);
  const before = await p.locator(".fd-a").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await p.locator(".fd-display > .fd-btn").click();
  await p.getByLabel("Large text").check();
  const after = await p.locator(".fd-a").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check("Large text applies to the conversation", after > before * 1.15, `${before} -> ${after}`);
  // Keyboard: chips and moment cards are real buttons reachable by Tab.
  await p.getByLabel("Large text").uncheck();
  await p.keyboard.press("Escape");
  await c.close();
}
{
  const { c, p } = await open();
  await p.locator("#fd-ask-input").focus();
  await p.keyboard.press("Tab"); // mic
  await p.keyboard.press("Tab"); // send (disabled: skipped) -> first chip
  const focused = await p.evaluate(() => document.activeElement?.className);
  check("Keyboard: Tab from the ask box reaches the starter chips", /fd-chip/.test(focused ?? ""), focused);
  await p.keyboard.press("Enter");
  await p.locator(".fd-followups").waitFor();
  check("Keyboard: Enter on a chip asks it", (await p.locator(".fd-q").count()) === 1);
  await c.close();
}

check("No page errors", errors.length === 0, errors.join(" | "));
await browser.close();

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

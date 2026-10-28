/**
 * Front door (/) checks with stubbed APIs: the chat stream, speech synthesis and speech
 * recognition are all fakes in the page (no Claude calls, no microphone).
 *
 *   node --env-file=.env.local tests/ui/front-door-check.mjs [baseUrl]
 *
 * Uses the locally installed Google Chrome. Every request to *.usmc-mccs.org is blocked.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
const CREDITS = JSON.parse(readFileSync(new URL("../../public/home/CREDITS.json", import.meta.url), "utf8")).photos;
const creditFor = (name) => CREDITS.find((c) => c.file === `/home/${name}.webp`);
const CAROUSEL = ["hero-quantico", "base-pendleton", "hero-lejeune", "base-quantico", "moments", "base-lejeune", "hero-pendleton"];
const EXAMPLES_FD = ["Gym hours today?", "Child care waitlist", "Where can I stay?", "Tuition Assistance help", "This weekend’s events"];

const browser = await chromium.launch({ executablePath: CHROME });
const cookie = code ? [{ name: "mccs_demo_access", value: createHash("sha256").update(`mccs-demo-access:${code}`).digest("hex"), url: base }] : [];

/** A page with the chat and speech fakes installed. `opts.recognition: false` leaves out SpeechRecognition. */
async function open(opts = {}) {
  const c = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 900 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, reducedMotion: opts.reducedMotion });
  if (cookie.length) await c.addCookies(cookie);
  await c.route(/usmc-mccs\.org/, (r) => r.abort());
  if (opts.hold) {
    // Hold one image request until the test releases it (a slow photo).
    let release;
    const released = new Promise((r) => (release = r));
    c.release = release;
    await c.route(`**${opts.hold}`, async (r) => {
      await released;
      await r.continue();
    });
  }
  // Warm-up is stubbed too (never a real prompt-cache write from tests).
  c.warms = [];
  await c.route("**/api/warm", (r) => {
    c.warms.push(r.request().postDataJSON()?.installationId);
    return r.fulfill({ status: 200, contentType: "application/json", body: '{"warmed":true}' });
  });
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
  // A held image keeps the network busy, so wait for the load event instead of network idle.
  await p.goto(base + "/", { waitUntil: opts.hold ? "load" : "networkidle" });
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
  check("Serif headline, sans body", /Fraunces/.test(await p.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily)) && /Plus Jakarta Sans/.test(await p.locator(".fd").evaluate((el) => getComputedStyle(el).fontFamily)));
  check("Heavy headline weight", Number(await p.locator("h1").evaluate((el) => getComputedStyle(el).fontWeight)) >= 700);
  check("Pill-shaped top controls", (await p.locator(".fd-top .fd-pill").count()) >= 2 && (await p.locator(".fd-display-btn").evaluate((el) => parseFloat(getComputedStyle(el).borderRadius))) > 100);
  const options = await p.locator("#fd-inst-select option").allTextContents();
  check("Installation selector lists the three bases", JSON.stringify(options) === JSON.stringify(["MCB Quantico", "MCB Camp Pendleton", "MCB Camp Lejeune"]), JSON.stringify(options));
  // Photos: the hero carousel (all three installations), one per card, one for the moments.
  const heroSrc = await p.locator(".fd-hero-photo img.is-active").getAttribute("src");
  check("Hero starts on the selected installation's photo", heroSrc === "/home/hero-quantico.webp", heroSrc);
  const imgs = await p.locator(".fd img").evaluateAll((els) => els.map((e) => ({ src: e.getAttribute("src"), alt: e.alt, hidden: e.getAttribute("aria-hidden") === "true" })));
  const described = imgs.filter((i) => !i.hidden);
  check("All photos are WebP; every visible one has descriptive alt text", imgs.length === 11 && imgs.every((i) => /\.webp$/.test(i.src)) && described.length === 5 && described.every((i) => i.alt.length > 20) && imgs.filter((i) => i.hidden).length === 6 && imgs.filter((i) => i.hidden).every((i) => i.alt === ""), JSON.stringify(imgs));
  await p.waitForFunction(() => [...document.querySelectorAll(".fd img")].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
  check("Photos load", (await p.locator(".fd img").evaluateAll((els) => els.every((e) => e.naturalWidth > 0))));
  const credits = await p.locator(".fd-credit").allTextContents();
  check("A credit on each photo", credits.length === 5 && credits.every((t) => /^Photo: .+, USMC$/.test(t)), JSON.stringify(credits));
  check("Credits link to their sources", (await p.locator(".fd-credit").evaluateAll((as) => as.every((a) => a.href.startsWith("https://commons.wikimedia.org/wiki/File:") && a.target === "_blank"))));
  check("Photo credits footer link", (await p.locator(".fd-footer a", { hasText: "Photo credits" }).getAttribute("href")) === "/credits");
  check("Warm-up on load for the selected base", JSON.stringify(c.warms) === JSON.stringify(["quantico"]), JSON.stringify(c.warms));
  const qCfg = await (await p.request.get(base + "/api/installations/quantico")).json();
  check("Starter chips from Quantico's defaultChips", JSON.stringify(await p.locator(".fd-hero .fd-chip").allTextContents()) === JSON.stringify(qCfg.defaultChips.slice(0, 4)));
  check("Five moment cards", (await p.locator(".fd-moments .fd-card").count()) === 5);
  const baseLinks = await p.locator(".fd-bases .fd-bcard").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("Installation cards link to /quantico, /pendleton, /lejeune", JSON.stringify(baseLinks) === JSON.stringify(["/quantico", "/pendleton", "/lejeune"]), JSON.stringify(baseLinks));
  check("Trust strip", /^Answers come from official MCCS pages · captured Oct 26 · links to every source\.$/.test(((await p.locator(".fd-trust-strip").textContent()) ?? "").trim()));
  check("Ask box is labeled; mic and send have names", (await p.locator("label[for=fd-ask-input]").textContent()) === "Ask MCCS" && (await p.locator(".fd-mic").getAttribute("aria-label")) === "Ask by voice" && (await p.locator(".fd-send").getAttribute("aria-label")) === "Send");

  // Installation choice is remembered.
  await p.locator("#fd-inst-select").selectOption("pendleton");
  check("Selected installation saved", (await p.evaluate(() => localStorage.getItem("mccs-front:installation"))) === "pendleton");
  await p.waitForTimeout(200);
  check("Warm-up when the selector changes", JSON.stringify(c.warms) === JSON.stringify(["quantico", "pendleton"]), JSON.stringify(c.warms));
  await p.reload({ waitUntil: "networkidle" });
  check("Warm-up throttled per base (like the widget)", JSON.stringify(c.warms) === JSON.stringify(["quantico", "pendleton"]), JSON.stringify(c.warms));
  const pCfg = await (await p.request.get(base + "/api/installations/pendleton")).json();
  check("Selected installation restored after reload", (await p.locator("#fd-inst-select").inputValue()) === "pendleton" && JSON.stringify(await p.locator(".fd-hero .fd-chip").allTextContents()) === JSON.stringify(pCfg.defaultChips.slice(0, 4)));
  check("Trust strip uses the base's capture date", /captured Oct 27/.test((await p.locator(".fd-trust-strip").textContent()) ?? ""));

  // Display menu.
  const displayBtn = p.locator(".fd-display-btn");
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

// 5. Hero photo carousel (fake clock): all seven photos, interleaved, 6.5 s each.
{
  // First view: only the first hero is in the page; the rest come after the load event.
  const first = await open();
  const html = await (await first.p.request.get(base + "/")).text();
  await first.c.close();
  check("Carousel: only the first hero photo is in the initial HTML", (html.match(/data-photo="/g) || []).length === 1 && /data-photo="hero-quantico"/.test(html), String((html.match(/data-photo="/g) || []).length));
}
{
  const { c, p } = await open({ clock: true });
  const active = () => p.locator(".fd-hero-photo img.is-active").getAttribute("data-photo");
  const state = async () => {
    const img = p.locator(".fd-hero-photo img.is-active");
    return {
      id: await img.getAttribute("data-photo"),
      alt: await img.getAttribute("alt"),
      focus: await img.evaluate((el) => getComputedStyle(el).objectPosition),
      credit: await p.locator(".fd-hero-photo .fd-credit").textContent(),
      href: await p.locator(".fd-hero-photo .fd-credit").getAttribute("href"),
    };
  };
  await p.mouse.move(5, 400); // away from the photo
  await p.waitForFunction(() => document.querySelectorAll(".fd-hero-photo img").length === 7 && [...document.querySelectorAll(".fd-hero-photo img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 }).catch(() => {});
  check("Carousel: all seven photos loaded in the background after page load", (await p.locator(".fd-hero-photo img").evaluateAll((els) => els.length === 7 && els.every((e) => e.complete && e.naturalWidth > 0))));
  check("Carousel: first hero high priority, the rest low", JSON.stringify(await p.locator(".fd-hero-photo img").evaluateAll((els) => els.map((e) => e.getAttribute("fetchpriority")))) === JSON.stringify(["high", "low", "low", "low", "low", "low", "low"]));
  check("Carousel: soft 0.8s crossfade", /opacity 0\.8s/.test(await p.locator(".fd-hero-photo img").first().evaluate((el) => getComputedStyle(el).transition)));
  await p.clock.pauseAt(Date.now() + 200); // from here, time only moves with runFor
  const seen = [await state()];
  for (let k = 0; k < 7; k++) {
    await p.clock.runFor(6500);
    seen.push(await state());
  }
  const ids = seen.map((x) => x.id);
  check("Carousel: all seven photos, interleaved, every 6.5 s, then repeats", JSON.stringify(ids) === JSON.stringify([...CAROUSEL, CAROUSEL[0]]), ids.join());
  const baseOf = (id) => (id === "moments" ? "pendleton" : id.split("-")[1]); // the moments photo is at Pendleton
  check("Carousel: neighbours never share a base", ids.every((id, k) => k === 0 || baseOf(id) !== baseOf(ids[k - 1])), ids.map(baseOf).join());
  const wrong = seen.filter((x) => { const c = creditFor(x.id); return x.alt !== c.alt || x.credit !== `Photo: ${c.author}, USMC` || x.href !== c.source || x.focus !== c.focus; });
  check("Carousel: alt text, credit and focus point follow every photo (from CREDITS.json)", wrong.length === 0 && (await p.locator(".fd-hero-photo img[aria-hidden=true]").count()) === 6, JSON.stringify(wrong));
  check("Carousel: every photo has a focus point", CREDITS.every((c) => /^\d+% \d+%$/.test(c.focus ?? "")));

  await p.locator("#fd-inst-select").selectOption("lejeune");
  check("Carousel: the selector doesn't change the hero photo", (await active()) === "hero-quantico" && /Lejeune/.test((await p.locator(".fd-lead").textContent()) ?? ""));

  const toggle = p.locator(".fd-slide-toggle");
  check("Carousel: pause button", (await toggle.getAttribute("aria-label")) === "Pause photo slideshow");
  check("Carousel: pause icon is visible (white on dark)", (await toggle.evaluate((el) => getComputedStyle(el).color)) === "rgb(255, 255, 255)");
  await toggle.click();
  await p.mouse.move(5, 400);
  check("Carousel: button becomes Play", (await toggle.getAttribute("aria-label")) === "Play photo slideshow");
  await p.clock.runFor(20000);
  check("Carousel: paused by the button", (await active()) === "hero-quantico");
  await toggle.click();
  await p.mouse.move(5, 400);
  await p.clock.runFor(6500);
  check("Carousel: Play resumes", (await active()) === "base-pendleton", await active());

  await p.locator(".fd-hero-photo").hover();
  await p.clock.runFor(15000);
  check("Carousel: paused while hovered", (await active()) === "base-pendleton");
  await p.mouse.move(5, 400);
  await p.clock.runFor(6500);
  check("Carousel: resumes when the pointer leaves", (await active()) === "hero-lejeune", await active());

  await p.locator(".fd-hero-photo .fd-credit").focus();
  await p.clock.runFor(15000);
  check("Carousel: paused while keyboard focus is on the photo", (await active()) === "hero-lejeune");
  await p.locator("#fd-inst-select").focus();
  await p.clock.runFor(6500);
  check("Carousel: resumes when focus leaves", (await active()) === "base-quantico", await active());

  const setHidden = (hidden) =>
    p.evaluate((h) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await setHidden(true);
  await p.clock.runFor(15000);
  check("Carousel: paused while the tab is hidden", (await active()) === "base-quantico");
  await setHidden(false);
  await p.clock.runFor(6500);
  check("Carousel: resumes when the tab is visible", (await active()) === "moments", await active());
  await c.close();
}
{
  // Never a blank frame: a photo that hasn't loaded yet is waited for.
  const { c, p } = await open({ clock: true, hold: "/home/base-pendleton.webp" });
  await p.mouse.move(5, 400);
  await p.waitForFunction(() => document.querySelectorAll(".fd-hero-photo img").length === 7, null, { timeout: 8000 }).catch(() => {});
  await p.clock.pauseAt(Date.now() + 200);
  await p.clock.runFor(13000);
  const shownWhileHeld = await p.locator(".fd-hero-photo img.is-active").evaluate((el) => ({ id: el.dataset.photo, ok: el.complete && el.naturalWidth > 0 }));
  check("Carousel: waits for a photo that hasn't loaded (no blank frame)", shownWhileHeld.id === "hero-quantico" && shownWhileHeld.ok, JSON.stringify(shownWhileHeld));
  c.release();
  await p.waitForFunction(() => { const i = document.querySelector('.fd-hero-photo img[data-photo="base-pendleton"]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).catch(() => {});
  await p.clock.runFor(6500);
  check("…and moves on once it has loaded", (await p.locator(".fd-hero-photo img.is-active").getAttribute("data-photo")) === "base-pendleton");
  await c.close();
}
{
  const { c, p } = await open({ clock: true, reducedMotion: "reduce" });
  const active = () => p.locator(".fd-hero-photo img.is-active").getAttribute("data-photo");
  await p.clock.runFor(20000);
  check("Reduced motion: no rotation, no pause button", (await active()) === "hero-quantico" && (await p.locator(".fd-slide-toggle").count()) === 0);
  await p.locator("#fd-inst-select").selectOption("pendleton");
  await p.waitForFunction(() => document.querySelector(".fd-hero-photo img.is-active")?.dataset.photo === "hero-pendleton", null, { timeout: 5000 }).catch(() => {});
  check("Reduced motion: shows the selected installation's hero photo", (await active()) === "hero-pendleton" && (await p.locator(".fd-hero-photo .fd-credit").textContent()) === "Photo: Sgt. Melissa Marnell, USMC");
  check("Reduced motion: no crossfade", (await p.locator(".fd-hero-photo img").first().evaluate((el) => getComputedStyle(el).transitionDuration)) === "0s");
  await p.locator("#fd-inst-select").selectOption("quantico");
  await c.close();
}

// 6. Typing placeholder (the widget's effect, calmer timing), and reduced motion.
{
  const { c, p } = await open({ clock: true });
  const box = p.locator("#fd-ask-input");
  check("Ask box: screen readers get only its label", (await p.getByRole("textbox", { name: "Ask MCCS", exact: true }).count()) === 1 && !(await box.getAttribute("aria-describedby")) && !(await box.getAttribute("aria-live")));
  check("Typing: starts on the first example", (await box.getAttribute("placeholder")) === "Gym hours today?");
  await box.evaluate((el) => {
    window.__ph = [{ t: Date.now(), v: el.placeholder }];
    new MutationObserver(() => window.__ph.push({ t: Date.now(), v: el.placeholder })).observe(el, { attributes: true, attributeFilter: ["placeholder"] });
  });
  await p.clock.runFor(12000);
  const frames = await p.evaluate(() => window.__ph);
  const vals = frames.map((f) => f.v);
  const second = "Child care waitlist";
  const at = (v, from = 0) => frames.findIndex((f, k) => k >= from && f.v === v);
  const emptyAt = at("", 1);
  const typedFrames = vals.slice(emptyAt + 1, at(second) + 1);
  check("Typing: the next example types letter by letter", typedFrames.length === second.length && typedFrames.every((v, k) => v === second.slice(0, k + 1)), JSON.stringify(typedFrames.slice(0, 5)));
  const perChar = (frames[at(second)].t - frames[at("C", emptyAt)].t) / (second.length - 1);
  const hold = frames[at(second) + 1].t - frames[at(second)].t;
  const erase = frames[at("", at(second))].t - frames[at(second)].t - hold;
  check("Typing: ~50 ms a letter", perChar >= 45 && perChar <= 60, perChar.toFixed(1));
  check("Typing: holds ~3.25 s", hold >= 3200 && hold <= 3350, String(hold));
  check("Typing: erases in ~0.3 s", erase >= 200 && erase <= 380, String(erase));
  const cycle = frames[at("W", at(second))].t - frames[at("C", emptyAt)].t;
  check("Typing: about 4.5 s per example", cycle >= 4200 && cycle <= 4800, String(cycle));

  await box.focus();
  check("Typing: cleared while the box is focused", (await box.getAttribute("placeholder")) === "");
  await p.clock.runFor(4000);
  check("Typing: stays stopped while focused", (await box.getAttribute("placeholder")) === "");
  await box.fill("pool");
  await p.locator("#fd-inst-select").focus();
  await p.clock.runFor(4000);
  check("Typing: stays stopped while the box has text", (await box.getAttribute("placeholder")) === "");
  await box.fill(""); // fill() focuses the box, so move focus away again
  await p.locator("#fd-inst-select").focus();
  await p.clock.runFor(1500);
  const resumed = (await box.getAttribute("placeholder")) ?? "";
  check("Typing: resumes on blur when empty", resumed.length > 0 && EXAMPLES_FD.some((e) => e.startsWith(resumed)), resumed);

  await ask(p, "Gym hours today?");
  await box.evaluate((el) => {
    window.__dock = 0;
    new MutationObserver(() => window.__dock++).observe(el, { attributes: true, attributeFilter: ["placeholder"] });
  });
  await p.clock.runFor(8000);
  check("Docked placeholder stays static", (await box.getAttribute("placeholder")) === "Ask a follow-up…" && (await p.evaluate(() => window.__dock)) === 0);
  await c.close();
}
{
  const { c, p } = await open({ clock: true, reducedMotion: "reduce" });
  const box = p.locator("#fd-ask-input");
  await box.evaluate((el) => {
    window.__n = 0;
    new MutationObserver(() => window.__n++).observe(el, { attributes: true, attributeFilter: ["placeholder"] });
  });
  await p.clock.runFor(10000);
  check("Reduced motion: static first example, no typing", (await box.getAttribute("placeholder")) === "Gym hours today?" && (await p.evaluate(() => window.__n)) === 0);
  await ask(p, "Gym hours today?");
  check("Reduced motion: no dock animation", (await p.locator(".fd-dock").evaluate((el) => getComputedStyle(el).animationName)) === "none");
  await c.close();
}

// 7. Phones (375px): no sideways scroll, placeholder fits, top bar usable, large text reaches answers.
{
  const { c, p } = await open({ viewport: { width: 375, height: 812 }, mobile: true });
  check("375px hero: no horizontal overflow", (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  const tops = await p.locator(".fd-top > .fd-pill, .fd-top > .fd-display").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  check("375px: top pills fit on one row", tops.length === 2 && Math.abs(tops[0] - tops[1]) <= 4, JSON.stringify(tops));
  check("375px: Display pill keeps its accessible name", (await p.getByRole("button", { name: "Display" }).count()) === 1);
  const fits = await p.locator("#fd-ask-input").evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  check("375px: ask box shows its whole placeholder", fits);
  await ask(p, "How do I get child care?");
  check("375px chat: no horizontal overflow", (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  check("375px chat: installation selector stays usable", (await p.locator("#fd-inst-select").evaluate((el) => el.getBoundingClientRect().width)) >= 150);
  const before = await p.locator(".fd-a").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await p.locator(".fd-display-btn").click();
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

// 8. Photo credits page.
{
  const { c, p } = await open();
  await p.goto(base + "/credits", { waitUntil: "networkidle" });
  const items = await p.locator(".fd-credit-list li").count();
  const text = (await p.locator(".fd-credit-list").textContent()) ?? "";
  check("Credits page lists every photo with author and license", items === 7 && (text.match(/Public domain \(PD-USGov/g) || []).length === 7 && (text.match(/U\.S\. Marine Corps/g) || []).length === 7, `${items} items`);
  await c.close();
}

// 9. Focus rings: one per control, on the rounded container, never a square inner outline.
{
  const { c, p } = await open();
  const st = (sel) =>
    p.locator(sel).first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, ow: cs.outlineWidth, oc: cs.outlineColor, shadow: cs.boxShadow, radius: cs.borderTopLeftRadius, border: cs.borderTopColor };
    });
  const pillBase = await st(".fd-inst");
  const askBase = await st(".fd-ask");

  // Mouse click in the ask box: no inner outline; the box glows, following its radius.
  await p.locator("#fd-ask-input").click();
  const ta = await st("#fd-ask-input");
  const ask = await st(".fd-ask");
  check("Ask box click: no outline or shadow on the textarea", ta.outline === "none" && ta.shadow === "none", JSON.stringify(ta));
  check("Ask box click: the box shows its ring, with its own radius", ask.shadow !== askBase.shadow && /0px 0px 0px 4px/.test(ask.shadow) && ask.radius === askBase.radius && parseFloat(ask.radius) > 0, JSON.stringify(ask));

  // Mouse click on the installation select: no inner outline, and no ring (keyboard only).
  await p.locator("#fd-inst-select").click();
  await p.keyboard.press("Escape").catch(() => {});
  await p.locator("#fd-inst-select").evaluate((el) => el.blur());
  await p.mouse.click(600, 820);
  await p.locator("#fd-inst-select").click();
  const selClick = await st("#fd-inst-select");
  check("Selector click: no outline on the inner select", selClick.outline === "none" && selClick.shadow === "none", JSON.stringify(selClick));
  check("Selector click: no ring on the pill", (await st(".fd-inst")).shadow === pillBase.shadow);
  await p.mouse.click(600, 820); // closes the list, blurs the select

  // Keyboard: Tab from the top lands on the select; the pill gets the ring.
  await p.locator(".demo-banner").click(); // start sequential focus at the top of the page
  await p.keyboard.press("Tab");
  check("Keyboard: Tab reaches the installation selector first", await p.locator("#fd-inst-select").evaluate((el) => document.activeElement === el));
  const selKey = await st("#fd-inst-select");
  const pillKey = await st(".fd-inst");
  check("Keyboard: no outline on the inner select", selKey.outline === "none" && selKey.shadow === "none", JSON.stringify(selKey));
  check("Keyboard: the pill shows the ring, following its radius", pillKey.shadow !== pillBase.shadow && /0px 0px 0px 4px/.test(pillKey.shadow) && pillKey.radius === pillBase.radius && parseFloat(pillKey.radius) > 100, JSON.stringify(pillKey));

  // Tab through the rest of the hero: each stop has exactly one ring, on the control itself.
  const stops = [];
  for (let k = 0; k < 14; k++) {
    await p.keyboard.press("Tab");
    stops.push(
      await p.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        const inner = [...el.querySelectorAll("*")].some((d) => getComputedStyle(d).outlineStyle !== "none");
        const box = el.closest(".fd-ask");
        return {
          what: el.id || el.className || el.tagName,
          tag: el.tagName,
          outline: cs.outlineStyle,
          ow: cs.outlineWidth,
          radius: parseFloat(cs.borderTopLeftRadius),
          inner,
          askRing: box ? getComputedStyle(box).boxShadow : null,
        };
      }),
    );
  }
  const bad = stops.filter((s) =>
    s.tag === "TEXTAREA" ? s.outline !== "none" || !/0px 0px 0px 4px/.test(s.askRing ?? "") : s.outline !== "solid" || s.ow !== "3px" || !(s.radius > 0) || s.inner,
  );
  const kinds = new Set(stops.map((s) => String(s.what).split(" ")[0]));
  check("Keyboard: every control has one ring that follows its shape", bad.length === 0, JSON.stringify(bad));
  check("…covering the Display pill, photo controls, ask box, mic, chips", ["fd-pill", "fd-credit", "fd-slide-toggle", "fd-ask-input", "fd-icon-btn", "fd-chip"].every((k) => kinds.has(k)), JSON.stringify([...kinds]));

  // Cards: numbered moment cards and installation cards.
  await p.keyboard.press("Shift"); // keyboard modality for programmatic focus
  for (const sel of [".fd-card[data-moment=arrived]", ".fd-bases .fd-bcard"]) {
    await p.locator(sel).first().focus();
    const s = await st(sel);
    check(`Keyboard: ${sel} ring follows its radius`, s.outline === "solid" && s.ow === "3px" && parseFloat(s.radius) > 10, JSON.stringify(s));
  }

  // Visible in dark and high contrast.
  for (const [label, display, ring] of [
    ["dark", { theme: "dark", large: false, contrast: false }, /0px 0px 0px 4px/],
    ["high contrast", { theme: "light", large: false, contrast: true }, /rgb\(0, 51, 204\) 0px 0px 0px 3px/],
    ["dark high contrast", { theme: "dark", large: false, contrast: true }, /rgb\(255, 211, 77\) 0px 0px 0px 3px/],
  ]) {
    await p.evaluate((d) => localStorage.setItem("mccs-front:display", JSON.stringify(d)), display);
    await p.reload({ waitUntil: "networkidle" });
    await p.evaluate(() => document.activeElement?.blur());
    await p.keyboard.press("Tab");
    const pill = await st(".fd-inst");
    await p.keyboard.press("Tab"); // Display pill
    const btn = await st(".fd-display-btn");
    const bg = await p.locator(".fd").evaluate((el) => getComputedStyle(el).backgroundColor);
    check(`Rings visible in ${label}`, ring.test(pill.shadow) && btn.outline === "solid" && btn.oc !== bg && pill.border !== bg, JSON.stringify({ pill: pill.shadow, btn: btn.oc, bg }));
  }
  await p.evaluate(() => localStorage.removeItem("mccs-front:display"));
  await c.close();
}

check("No page errors", errors.length === 0, errors.join(" | "));
await browser.close();

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  →  ${r.detail}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);

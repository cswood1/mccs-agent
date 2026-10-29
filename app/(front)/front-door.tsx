"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { firstMccsLink, markdown, parsePlanReply, parseStream, planFallbackText, shortDate, THINKING, speechText, type Plan } from "@/lib/chat-client";
import { DisplayMenu, useDisplay } from "./display-menu";
import type { Photo } from "./photos";
import { PLAN_LABEL, PlanPanel, type PlanKind } from "./plan-panel";
import { ARRIVED_KEY, GLOBE_ICON, LAST_KEY, useInputType, useReturnShortcut, warm, write } from "./shared";

export type FrontInstallation = {
  id: string;
  name: string;
  shortName: string;
  location: string;
  defaultChips: string[];
  /** Capture date of the base's pages (ISO), for the trust strip. */
  capturedOn: string;
  /** Installation card photo. */
  card: Photo | null;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** Display only: tool status while waiting, follow-ups, trust line. Never sent back to the API. */
  status?: string;
  /** Thinking phrase shown until the answer starts. */
  thinking?: string;
  followups?: string[];
  trust?: string;
  error?: boolean;
  /** Plan mode: the kind of plan this reply was asked for (its ```plan block opens in the panel). */
  plan?: PlanKind;
};

// Conversation per base, for this tab: switching base starts fresh; coming back restores it.
const convoKey = (id: string) => `mccs-front:conversation:${id}`;
// Short enough to fit the ask box on a 375px phone.
const EXAMPLES = ["Gym hours today?", "Child care waitlist", "Where can I stay?", "Tuition Assistance help", "This weekend’s events"];
// Typing placeholder: the widget header search's effect (public/widget.js), at a calmer pace for the
// front door: about 4.5 s per example. 50 ms a letter (~1 s for the ~19-letter examples), a 3.25 s
// hold, then a 0.3 s erase.
const TYPE_MS = 50;
const HOLD_MS = 3250;
const ERASE_MS = 300;
const SLIDE_MS = 6500; // hero photo carousel

/** Lower section: who's asking. Sent as `audience` (lib/turn.ts adds "The user is a …"). */
type Audience = "marine" | "family" | "retiree" | "community";
const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "marine", label: "Marine" },
  { id: "family", label: "Marine Family" },
  { id: "retiree", label: "Retiree & Veteran" },
  { id: "community", label: "Community" },
];

type Starter = { id: string; title: string; blurb: string; question: (base: string) => string; plan?: PlanKind };
/** "Start your next chapter": two plan-mode cards for everyone, then one per audience. */
const PLAN_CARDS: Starter[] = [
  { id: "arrival", title: "New to this installation", blurb: "Your arrival plan: this week, the first 30 days, and once you’re settled.", plan: "arrival", question: (b) => `I'm new to ${b}. Can you make me an arrival plan?` },
  { id: "workout", title: "Build my weekly workout plan", blurb: "Seven days of classes, open gym, pool and rest, at this installation’s facilities.", plan: "workout", question: (b) => `Build me a weekly workout plan using the gyms, pools and classes at ${b}.` },
];
const AUDIENCE_CARD: Record<Audience, Starter> = {
  marine: { id: "pcs-out", title: "PCSing out", blurb: "What to wrap up on base before you go.", question: (b) => `I'm PCSing out of ${b} soon. What should I take care of before I leave?` },
  family: { id: "kids", title: "Childcare & schools", blurb: "Child care, school help and youth programs.", question: (b) => `What child care and school support is there for my kids at ${b}?` },
  retiree: { id: "retiree", title: "What I can use on base", blurb: "MCCS programs and services open to retirees and veterans.", question: (b) => `I'm a retiree or veteran. Which MCCS programs and services at ${b} can I use?` },
  community: { id: "visiting", title: "Visiting the base", blurb: "Getting on base and what visitors can do.", question: (b) => `I'm visiting ${b}. What do I need to get on base, and what can visitors use?` },
};
/** "Everyday support" tiles, the same for every audience. */
const TILES: Starter[] = [
  { id: "childcare", title: "Childcare & Schools", blurb: "Care, school transitions and youth", question: (b) => `What child care and school support is there at ${b}?` },
  { id: "fitness", title: "Fitness & Sports", blurb: "Train, play and stay ready", question: (b) => `What gyms, classes and sports are there at ${b}?` },
  { id: "money", title: "Money & Benefits", blurb: "Build a plan for your finances", question: (b) => `What financial help and benefits does MCCS offer at ${b}?` },
  { id: "education", title: "Education & Careers", blurb: "Learning and your next step", question: (b) => `What education and career help is there at ${b}?` },
  { id: "family", title: "Family & Relationships", blurb: "Support for life together", question: (b) => `What family and relationship support is there at ${b}?` },
  { id: "recreation", title: "Recreation & Events", blurb: "Get out and get connected", question: (b) => `What recreation and events are coming up at ${b}?` },
  { id: "transition", title: "Transition & Retirement", blurb: "Prepare for what comes next", question: (b) => `What help is there at ${b} for leaving the service or retiring?` },
  { id: "shopping", title: "Shopping & Dining", blurb: "Everyday essentials and more", question: (b) => `Where can I shop and eat at ${b}?` },
];

/** What Listen reads: for a plan reply, the text around the plan (not its JSON). */
const spokenText = (content: string) => {
  const p = parsePlanReply(content);
  return p?.plan ? [p.intro, p.after].filter(Boolean).join("\n\n") : p ? planFallbackText(content) : content;
};

/** The plan's kind: as asked for, else a Monday–Sunday plan is a workout. */
const kindOf = (m: Msg, plan: Plan | null | undefined): PlanKind =>
  m.plan ?? (plan?.sections.some((s) => /^monday$/i.test(s.name)) ? "workout" : "arrival");

// Web Speech API: not in every browser, and prefixed in Chrome/Safari.
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;
const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export default function FrontDoor({
  installationId,
  installations,
  momentsPhoto,
  carousel,
}: {
  /** The base this front door is for (/ask/<base>). */
  installationId: string;
  installations: FrontInstallation[];
  momentsPhoto: Photo | null;
  /** Hero carousel photos, in order (photos.ts CAROUSEL). */
  carousel: Photo[];
}) {
  const instId = installationId;
  const inst = installations.find((i) => i.id === instId) ?? installations[0];
  const { display, update: updateDisplay, attrs: displayAttrs } = useDisplay();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [mode, setMode] = useState<"hero" | "chat">("hero");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [typed, setTyped] = useState(EXAMPLES[0]);
  const exampleRef = useRef(0);
  const typingStarted = useRef(false);
  const [askFocused, setAskFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState("");
  const [micNote, setMicNote] = useState("");
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  // Audience tab shown, and the audience sent with questions (once the visitor picks a tab or a card).
  const [tab, setTab] = useState<Audience>("marine");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [openPlan, setOpenPlan] = useState<number | null>(null); // message index of the plan in the panel
  const planOpener = useRef<HTMLElement | null>(null);
  const convRef = useRef<HTMLElement | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  const restored = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false); // browser-only state loaded

  // ---------- browser-only setup (after hydration) ----------
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only state once after hydration */
    write(LAST_KEY, instId); // last visited base, marked on the globe page
    // Restore this base's conversation (after following an answer's link, or coming back to this base).
    let restoredChat = false;
    try {
      const c = JSON.parse(sessionStorage.getItem(convoKey(instId)) || "null");
      if (c && Array.isArray(c.messages) && c.messages.length) {
        setMessages(c.messages);
        if (AUDIENCES.some((a) => a.id === c.audience)) {
          setAudience(c.audience);
          setTab(c.audience);
        }
        setMode("chat");
        restoredChat = true;
      }
    } catch {
      /* ignore */
    }
    // Arriving from the globe: focus lands on the ask box.
    try {
      if (sessionStorage.getItem(ARRIVED_KEY) === instId) {
        sessionStorage.removeItem(ARRIVED_KEY);
        if (!restoredChat) setTimeout(() => askRef.current?.focus({ preventScroll: true }), 0);
      }
    } catch {
      /* ignore */
    }
    restored.current = true;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setMicSupported(!!recognitionCtor());
    setSpeechSupported("speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [instId]);

  // Pre-load this base's knowledge into the prompt cache while the person reads or types.
  useEffect(() => {
    if (ready) warm(instId);
  }, [instId, ready]);

  // Typing placeholder: each example types out, holds, erases, then the next types. Stopped (and the
  // placeholder cleared) while the box is focused or has text; resumes on blur when empty.
  useEffect(() => {
    if (mode !== "hero" || reducedMotion || askFocused || question) return;
    let i = exampleRef.current;
    // The first run starts on the whole first example (like the widget); a resume types from empty.
    let n = typingStarted.current ? 0 : EXAMPLES[i].length;
    let phase: "type" | "hold" | "erase" = typingStarted.current ? "type" : "hold";
    typingStarted.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const ex = EXAMPLES[i];
      if (phase === "type") {
        if (n < ex.length) {
          setTyped(ex.slice(0, ++n));
          timer = setTimeout(tick, TYPE_MS);
        } else {
          phase = "hold";
          timer = setTimeout(tick, HOLD_MS);
        }
      } else if (phase === "hold") {
        phase = "erase";
        tick();
      } else if (n > 0) {
        setTyped(ex.slice(0, --n));
        timer = setTimeout(tick, ERASE_MS / ex.length);
      } else {
        i = exampleRef.current = (i + 1) % EXAMPLES.length;
        phase = "type";
        timer = setTimeout(tick, TYPE_MS);
      }
    };
    setTyped(EXAMPLES[i].slice(0, n)); // start state of the loop
    timer = setTimeout(tick, phase === "hold" ? HOLD_MS : TYPE_MS);
    return () => clearTimeout(timer);
  }, [mode, reducedMotion, askFocused, question]);
  const askPlaceholder =
    mode === "chat" ? "Ask a follow-up…" : reducedMotion ? EXAMPLES[0] : askFocused || question ? "" : typed;

  // Hero photo carousel: all seven front-door photos in a fixed interleaved order, whichever base is
  // selected; 6.5 s each, crossfading. Paused while the tab is hidden, on hover, on keyboard focus in
  // the photo, or by the button. With reduced motion: the selected base's hero, no rotation.
  // Loading: the first photo is in the page; the rest are requested after the page's load event.
  // The shown photo only changes to one that has loaded, so there's never a blank frame.
  const slides = carousel;
  const heroIndex = useCallback((id: string) => Math.max(0, slides.findIndex((p) => p.name === `hero-${id}`)), [slides]);
  const [slide, setSlide] = useState(() => heroIndex(installationId)); // the photo we want to show
  const [visible, setVisible] = useState(() => heroIndex(installationId)); // on screen: the wanted one, once loaded
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [background, setBackground] = useState(false); // request the other photos
  const loadedRef = useRef<Record<string, boolean>>({});
  const brokenRef = useRef<Record<string, boolean>>({});
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const markLoaded = useCallback((name: string) => {
    if (loadedRef.current[name]) return;
    loadedRef.current = { ...loadedRef.current, [name]: true };
    setLoaded(loadedRef.current);
  }, []);
  useEffect(() => {
    const go = () => setBackground(true);
    if (document.readyState === "complete") go();
    else {
      window.addEventListener("load", go, { once: true });
      return () => window.removeEventListener("load", go);
    }
  }, []);
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const rotating = !reducedMotion && slides.length > 1;
  const wanted = rotating ? slide : heroIndex(instId);
  useEffect(() => {
    if (loaded[slides[wanted]?.name]) setVisible(wanted); // eslint-disable-line react-hooks/set-state-in-effect
  }, [wanted, loaded, slides]);
  useEffect(() => {
    if (!rotating || mode !== "hero" || userPaused || hoverPaused || focusPaused || tabHidden) return;
    const t = setInterval(() => {
      setSlide((k) => {
        // Next photo in order; wait for it to load (skip one only if it failed to load).
        for (let step = 1; step < slides.length; step++) {
          const next = (k + step) % slides.length;
          if (brokenRef.current[slides[next].name]) continue;
          return loadedRef.current[slides[next].name] ? next : k;
        }
        return k;
      });
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, [rotating, mode, userPaused, hoverPaused, focusPaused, tabHidden, slides]);
  const shown = visible;

  // Ask box height follows its text, or its placeholder when empty (which can wrap with large text).
  useLayoutEffect(() => {
    const ta = askRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`; // capped by max-height in front.css
  }, [question, askPlaceholder, display.large, mode]);

  // ---------- conversation layout: ask box docked at the bottom ----------
  // Follow the newest message while the reader is at the bottom; once they scroll up to read, leave
  // them there and offer "↓ Latest" instead.
  const stickRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const heroAskRect = useRef<DOMRect | null>(null); // where the ask box was in the hero, for the slide
  // Following jumps ("instant"): Bootstrap's reboot turns on smooth scrolling for the whole page.
  const scrollToLatest = (behavior: ScrollBehavior = "instant") => {
    stickRef.current = true;
    setAtBottom(true);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  };
  const chatMainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (mode !== "chat") return;
    // Only scrolling up stops following; content growing below the reader doesn't.
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const near = document.documentElement.scrollHeight - (y + window.innerHeight) < 80;
      if (near) stickRef.current = true;
      else if (y < lastY) stickRef.current = false;
      lastY = y;
      setAtBottom(stickRef.current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Whatever grows the conversation (streaming text, follow-ups, Listen buttons, fonts) keeps the
    // newest message in view while following.
    const grown = new ResizeObserver(() => {
      if (stickRef.current) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    });
    if (chatMainRef.current) grown.observe(chatMainRef.current);
    return () => {
      window.removeEventListener("scroll", onScroll);
      grown.disconnect();
    };
  }, [mode]);
  useLayoutEffect(() => {
    if (mode === "chat" && stickRef.current) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  }, [messages, mode, busy]);
  // Phones: keep the docked box above the on-screen keyboard.
  useEffect(() => {
    const vv = window.visualViewport;
    const root = rootRef.current;
    if (mode !== "chat" || !vv || !root) return;
    const update = () => root.style.setProperty("--fd-kb", `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--fd-kb");
    };
  }, [mode]);
  // The first question: the ask box slides from the hero down to its docked place (a fade with
  // reduced motion).
  useLayoutEffect(() => {
    const from = heroAskRect.current;
    heroAskRect.current = null;
    const form = askRef.current?.closest("form");
    if (mode !== "chat" || !from || !form?.animate) return;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    const to = form.getBoundingClientRect();
    if (reducedMotion) {
      form.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
    } else {
      form.animate(
        [{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, opacity: 0.85 }, { transform: "none", opacity: 1 }],
        { duration: 450, easing: "cubic-bezier(.2, .8, .2, 1)" },
      );
    }
  }, [mode, reducedMotion]);

  // Remember the conversation for this tab (display-only fields stay out of what's sent).
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (messages.length) sessionStorage.setItem(convoKey(instId), JSON.stringify({ audience, messages: messages.map(({ status, thinking, ...m }) => (void status, void thinking, m)) }));
      else sessionStorage.removeItem(convoKey(instId));
    } catch {
      /* ignore */
    }
  }, [messages, instId, audience]);

  // Last input type, for focus rings that should show for keyboard focus only (front.css).
  useInputType(rootRef);
  useReturnShortcut();

  // ---------- reading aloud ----------
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(null);
  }, []);

  const speak = useCallback(
    (index: number, text: string, rateSlow = slow) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speechText(text));
      u.rate = rateSlow ? 0.8 : 1;
      u.lang = "en-US";
      u.onend = () => setSpeaking((s) => (s === index ? null : s));
      u.onerror = () => setSpeaking((s) => (s === index ? null : s));
      setSpeaking(index);
      window.speechSynthesis.speak(u);
    },
    [slow],
  );

  // ---------- asking ----------
  const resetConversation = useCallback(() => {
    abortRef.current?.abort();
    recRef.current?.abort();
    stopSpeaking();
    setBusy(false);
    setMessages([]);
    setOpenPlan(null);
    setCaption("");
    setListening(false);
  }, [stopSpeaking]);

  const trustLine = useCallback(
    async (content: string): Promise<string | undefined> => {
      const link = firstMccsLink(content);
      if (!link) return undefined;
      const base = installations.find((i) => i.id === link.slug);
      if (!base) return undefined;
      try {
        const r = await fetch(`/api/installations/${base.id}/page?path=${encodeURIComponent(link.path)}`);
        if (!r.ok) return undefined;
        const info = await r.json();
        if (!info.known) return undefined;
        const title = link.path === "/" ? "Home" : info.title;
        return `From ${base.name} · ${title}${info.fetchedAt ? ` · checked ${shortDate(info.fetchedAt)}` : ""}`;
      } catch {
        return undefined;
      }
    },
    [installations],
  );

  const send = useCallback(
    async (text: string, opts: { spoken?: boolean; plan?: PlanKind; audience?: Audience } = {}) => {
      const q = text.trim();
      if (!q || busy || !inst) return;
      setQuestion("");
      if (mode === "hero") heroAskRect.current = askRef.current?.closest("form")?.getBoundingClientRect() ?? null;
      stickRef.current = true; // sending always shows the newest message
      setAtBottom(true);
      setMode("chat");
      stopSpeaking();
      const history: Msg[] = [...messages.filter((m) => !m.error && m.content), { role: "user", content: q }];
      while (history.length > 29) history.shift();
      while (history.length && history[0].role !== "user") history.shift();
      const replyIndex = messages.length + 1;
      const thinking = THINKING[0];
      setMessages((ms) => [...ms, { role: "user", content: q }, { role: "assistant", content: "", thinking, plan: opts.plan }]);
      const who = opts.audience ?? audience;
      setBusy(true);
      const abort = new AbortController();
      abortRef.current = abort;
      const patch = (p: Partial<Msg>) =>
        setMessages((ms) => ms.map((m, i) => (i === replyIndex ? { ...m, ...p } : m)));

      let raw = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            installationId: inst.id,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            page: { url: location.href, path: "/", title: "Ask MCCS front door" },
            trail: [],
            ...(who ? { audience: who } : {}),
            ...(opts.plan ? { mode: "plan", kind: opts.plan } : {}),
          }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          const parsed = parseStream(raw);
          patch({ content: parsed.text, status: parsed.status });
        }
        const final = parseStream(raw, true);
        const content = final.text.trim();
        if (!content) throw new Error("No answer came back.");
        patch({ content, status: undefined, thinking: undefined, followups: final.followups });
        setBusy(false);
        if (opts.spoken) speak(replyIndex, spokenText(content));
        const trust = await trustLine(content);
        if (trust && !abort.signal.aborted) patch({ trust });
      } catch (err) {
        if (abort.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Couldn't reach Ask MCCS.";
        const partial = parseStream(raw).text.trim();
        patch({ content: (partial ? partial + "\n\n" : "") + msg + (/try again/i.test(msg) ? "" : " Please try again."), status: undefined, thinking: undefined, error: true });
        setBusy(false);
      }
    },
    [audience, busy, inst, messages, mode, speak, stopSpeaking, trustLine],
  );

  const newConversation = () => {
    resetConversation();
    setMode("hero");
    window.scrollTo({ top: 0, behavior: "instant" });
    setTimeout(() => askRef.current?.focus(), 0);
  };

  // ---------- voice input ----------
  const toggleMic = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    setMicNote("");
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let transcript = "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      transcript = t;
      setCaption(t);
    };
    rec.onerror = (e) => {
      transcript = "";
      setMicNote(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone access is blocked. You can type instead." : "Didn't catch that. Try again or type your question.");
    };
    rec.onend = () => {
      setListening(false);
      setCaption("");
      recRef.current = null;
      if (transcript.trim()) send(transcript, { spoken: true });
    };
    recRef.current = rec;
    setListening(true);
    setCaption("");
    rec.start();
  };

  const chips = (inst?.defaultChips ?? []).slice(0, 4);
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant");
  const followups = !busy && lastAnswer && !lastAnswer.error ? (lastAnswer.followups ?? []) : [];

  // A card or tile: the conversation is for this base, as the audience on the selected tab.
  const start = (st: Starter) => {
    setAudience(tab);
    send(st.question(inst?.shortName ?? ""), { plan: st.plan, audience: tab });
  };
  const openPlanPanel = (i: number, opener: HTMLElement) => {
    planOpener.current = opener;
    setOpenPlan(i);
  };
  const closePlan = useCallback(() => {
    setOpenPlan(null);
    planOpener.current?.focus();
  }, []);
  const panelPlan = openPlan !== null ? parsePlanReply(messages[openPlan]?.content ?? "")?.plan : null;

  /** An answer's body: markdown, or for a plan reply the intro, the plan card and any text after it. */
  const answerBody = (m: Msg, i: number) => {
    const p = parsePlanReply(m.content);
    const streaming = busy && i === messages.length - 1;
    const md = (text: string) => <div className="fd-md" dangerouslySetInnerHTML={{ __html: markdown(text, inst?.location) }} />;
    if (!p) return md(m.content);
    if (!p.plan && !streaming) return md(planFallbackText(m.content)); // invalid JSON: just the text
    const kind = kindOf(m, p.plan);
    const label = PLAN_LABEL[kind];
    return (
      <>
        {p.intro && md(p.intro)}
        {p.plan ? (
          <button type="button" className="fd-card fd-plan-card" data-plan={kind} onClick={(e) => openPlanPanel(i, e.currentTarget)}>
            <span className="fd-plan-card-label">
              <span aria-hidden="true">{label.icon}</span> {label.name} · <span className="fd-plan-open">Open</span>
            </span>
            <span className="fd-card-blurb">
              {p.plan.title} · {p.plan.sections.reduce((n, s) => n + s.items.length, 0)} steps
            </span>
          </button>
        ) : (
          <p className="fd-status" role="status">
            Building your {label.name.toLowerCase()}…
          </p>
        )}
        {p.after && md(p.after)}
      </>
    );
  };

  const askForm = (
    <form
      className="fd-ask"
      role="search"
      aria-label="Ask MCCS"
      onSubmit={(e) => {
        e.preventDefault();
        send(question);
      }}
    >
      <label htmlFor="fd-ask-input" className="fd-sr">
        Ask MCCS
      </label>
      <textarea
        id="fd-ask-input"
        ref={askRef}
        rows={1}
        value={question}
        placeholder={askPlaceholder}
        onChange={(e) => setQuestion(e.target.value)}
        onFocus={() => setAskFocused(true)}
        onBlur={() => setAskFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send(question);
          }
        }}
        enterKeyHint="send"
        autoComplete="off"
      />
      {micSupported && (
        <button
          type="button"
          className={`fd-icon-btn fd-mic${listening ? " is-on" : ""}`}
          aria-label={listening ? "Stop listening" : "Ask by voice"}
          aria-pressed={listening}
          onClick={toggleMic}
          disabled={busy}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm6-3a6 6 0 0 1-12 0M12 18v3" />
          </svg>
        </button>
      )}
      <button type="submit" className="fd-icon-btn fd-send" aria-label="Send" disabled={busy || !question.trim()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12l16-8-6 16-2.5-6.5z" />
        </svg>
      </button>
    </form>
  );

  const voiceStatus = (
    <div className="fd-caption" aria-live="polite">
      {listening ? (
        <p>
          <span className="fd-rec-dot" aria-hidden="true" /> Listening… {caption && <q>{caption}</q>}
        </p>
      ) : micNote ? (
        <p>{micNote}</p>
      ) : null}
    </div>
  );

  const credit = (ph: Photo | null) =>
    ph ? (
      <a className="fd-credit" href={ph.source} target="_blank" rel="noopener noreferrer">
        {ph.credit}
      </a>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={`fd fd--${mode}`}
      {...displayAttrs}
    >
      <header className="fd-top">
        {/* Back to the globe (a full navigation, so supporting browsers crossfade: see front.css). */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- cross-document view transition */}
        <a className="fd-pill fd-inst" href="/" aria-label={`${inst?.shortName}: choose another installation`}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="fd-pill-icon">
            <path d={GLOBE_ICON} />
          </svg>
          <span>{inst?.shortName}</span>
        </a>
        {mode === "chat" && (
          <button type="button" className="fd-pill fd-new" onClick={newConversation}>
            New conversation
          </button>
        )}
        <DisplayMenu display={display} update={updateDisplay} />
      </header>

      {mode === "hero" ? (
        <main className="fd-main">
          <section className="fd-hero" aria-labelledby="fd-title">
            {slides.length > 0 && (
              <figure
                className="fd-hero-photo"
                onPointerEnter={() => setHoverPaused(true)}
                onPointerLeave={() => setHoverPaused(false)}
                // Keyboard focus on the credit link pauses; focus on the pause/play button doesn't, so Play works.
                onFocus={(e) => setFocusPaused(!(e.target as HTMLElement).closest(".fd-slide-toggle"))}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusPaused(false);
                }}
              >
                {/* Stacked photos: the first view's photo, the wanted one, then (after page load) all of
                    them, preloaded in the background. Only the visible one is described. */}
                {slides.map((ph, k) =>
                  k === shown || k === wanted || background || loaded[ph.name] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP
                    <img
                      key={ph.name}
                      ref={(el) => {
                        if (el?.complete && el.naturalWidth > 0) markLoaded(ph.name); // loaded before hydration
                      }}
                      className={k === shown ? "is-active" : undefined}
                      src={ph.src}
                      alt={k === shown ? ph.alt : ""}
                      aria-hidden={k === shown ? undefined : true}
                      data-photo={ph.name}
                      style={{ objectPosition: ph.focus }}
                      fetchPriority={k === shown ? "high" : "low"}
                      decoding="async"
                      onLoad={() => markLoaded(ph.name)}
                      onError={() => {
                        brokenRef.current[ph.name] = true;
                      }}
                    />
                  ) : null,
                )}
                {credit(slides[shown] ?? null)}
                {rotating && (
                  <button
                    type="button"
                    className="fd-slide-toggle"
                    aria-label={userPaused ? "Play photo slideshow" : "Pause photo slideshow"}
                    onClick={() => setUserPaused((p) => !p)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d={userPaused ? "M8 5v14l11-7z" : "M8 5h3v14H8zM13 5h3v14h-3z"} />
                    </svg>
                  </button>
                )}
              </figure>
            )}
            <div className="fd-hero-text">
              <h1 id="fd-title">
                <span className="fd-red">Ask MCCS</span> anything.
              </h1>
              <p className="fd-lead">Your guide to everything MCCS offers at {inst?.shortName}, from gym hours to child care.</p>
              {askForm}
              <p className="fd-hint">Ask in your own words. Please don’t include personal or sensitive information.</p>
              {voiceStatus}
              {chips.length > 0 && (
                <div className="fd-chips" role="group" aria-label="Suggested questions">
                  {chips.map((c) => (
                    <button key={c} type="button" className="fd-chip" onClick={() => send(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="fd-chapter" aria-label="Get started">
            {momentsPhoto && (
              <figure className="fd-chapter-photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP */}
                <img src={momentsPhoto.src} alt={momentsPhoto.alt} loading="lazy" />
                {credit(momentsPhoto)}
              </figure>
            )}
            <div className="fd-chapter-body">
              <div
                className="fd-audiences"
                role="tablist"
                aria-label="I am a…"
                onKeyDown={(e) => {
                  const k = AUDIENCES.findIndex((a) => a.id === tab);
                  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                  if (!step) return;
                  e.preventDefault();
                  const next = AUDIENCES[(k + step + AUDIENCES.length) % AUDIENCES.length].id;
                  setTab(next);
                  setAudience(next);
                  document.getElementById(`fd-aud-${next}`)?.focus();
                }}
              >
                {AUDIENCES.map((a) => (
                  <button
                    key={a.id}
                    id={`fd-aud-${a.id}`}
                    type="button"
                    role="tab"
                    className="fd-pill fd-aud"
                    aria-selected={tab === a.id}
                    aria-controls="fd-aud-panel"
                    tabIndex={tab === a.id ? 0 : -1}
                    onClick={() => {
                      setTab(a.id);
                      setAudience(a.id);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <div id="fd-aud-panel" role="tabpanel" aria-labelledby={`fd-aud-${tab}`}>
                <h2 className="fd-label" id="fd-chapter">
                  Start your next chapter
                </h2>
                <ol className="fd-moments" aria-labelledby="fd-chapter">
                  {[...PLAN_CARDS, AUDIENCE_CARD[tab]].map((m, n) => (
                    <li key={m.id}>
                      <button type="button" className="fd-card fd-ncard" data-card={m.id} onClick={() => start(m)}>
                        <span className="fd-num" aria-hidden="true">
                          {String(n + 1).padStart(2, "0")}
                        </span>
                        <span className="fd-ncard-body">
                          <span className="fd-card-title">{m.title}</span>
                          <span className="fd-card-blurb">{m.blurb}</span>
                          <span className="fd-cta" aria-hidden="true">
                            {m.plan ? "Make my plan" : "Ask MCCS"} <span className="fd-arrow">→</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <h2 className="fd-label" id="fd-everyday">
                  Everyday support
                </h2>
                <ul className="fd-tiles" aria-labelledby="fd-everyday">
                  {TILES.map((t) => (
                    <li key={t.id}>
                      <button type="button" className="fd-card fd-tile" data-tile={t.id} onClick={() => start(t)}>
                        <span className="fd-card-title">{t.title}</span>
                        <span className="fd-card-blurb">{t.blurb}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <h2 className="fd-label" id="fd-bases">
                Your installation
              </h2>
              <ul className="fd-bases" aria-labelledby="fd-bases">
                {installations.map((i) => (
                  <li key={i.id}>
                    <div className="fd-card fd-bcard" data-installation={i.id}>
                      {i.card && (
                        <span className="fd-bcard-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP */}
                          <img src={i.card.src} alt={i.card.alt} loading="lazy" />
                        </span>
                      )}
                      <span className="fd-card-title">{i.name}</span>
                      <span className="fd-card-blurb">{i.location}</span>
                      <span className="fd-bcard-links">
                        {i.id === instId ? (
                          <span className="fd-here">You’re here</span>
                        ) : (
                          // A full navigation (cross-document view transition), like the pill.
                          <a className="fd-cta fd-cta-link" href={`/ask/${i.id}`}>
                            Ask MCCS <span className="fd-arrow">→</span>
                          </a>
                        )}
                        <a className="fd-cta fd-cta-link" href={`/${i.id}`}>
                          Visit the site <span className="fd-arrow">→</span>
                        </a>
                      </span>
                    </div>
                    {credit(i.card)}
                  </li>
                ))}
              </ul>

              <p className="fd-trust-strip">
                Answers come from official MCCS pages · captured {inst?.capturedOn ? shortDate(inst.capturedOn) : "recently"} · links to every source.
              </p>
            </div>
          </section>
        </main>
      ) : (
        <main className="fd-main fd-chat-main" ref={chatMainRef}>
          <p className="fd-chat-title" aria-hidden="true">
            <span className="fd-red">Ask MCCS</span> · {inst?.shortName}
          </p>
          <h1 className="fd-sr">Ask MCCS conversation</h1>
          <section ref={convRef} tabIndex={-1} className="fd-conv" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversation">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="fd-q">
                  {m.content}
                </p>
              ) : (
                <article key={i} className={`fd-a${m.error ? " is-error" : ""}`}>
                  {m.content ? (
                    answerBody(m, i)
                  ) : m.status ? null : (
                    // Until the answer starts. role="status": announced once (the shimmer is CSS only).
                    <span className="fd-thinking" role="status">
                      {m.thinking}
                    </span>
                  )}
                  {m.status && (
                    <p className="fd-status" role="status">
                      {m.status}
                    </p>
                  )}
                  {m.trust && <p className="fd-trust">{m.trust}</p>}
                  {m.content && !m.error && speechSupported && !(busy && i === messages.length - 1) && (
                    <div className="fd-listen" role="group" aria-label="Read aloud">
                      {speaking === i ? (
                        <button type="button" className="fd-pill fd-small" onClick={stopSpeaking}>
                          Stop
                        </button>
                      ) : (
                        <button type="button" className="fd-pill fd-small" onClick={() => speak(i, spokenText(m.content))}>
                          Listen
                        </button>
                      )}
                      <button
                        type="button"
                        className="fd-pill fd-small"
                        aria-pressed={slow}
                        onClick={() => {
                          const next = !slow;
                          setSlow(next);
                          if (speaking === i) speak(i, spokenText(m.content), next);
                        }}
                      >
                        Slow
                      </button>
                    </div>
                  )}
                </article>
              ),
            )}
          </section>
          {followups.length > 0 && (
            <div className="fd-chips fd-followups" role="group" aria-label="Suggested next questions">
              {followups.map((c) => (
                <button key={c} type="button" className="fd-chip" onClick={() => send(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {/* Docked at the bottom of the viewport (sticky, so it never covers the end of the conversation). */}
          <div className="fd-dock">
            {!atBottom && (
              <button type="button" className="fd-pill fd-latest" onClick={() => scrollToLatest(reducedMotion ? "instant" : "smooth")}>
                <span aria-hidden="true">↓</span> Latest
              </button>
            )}
            {voiceStatus}
            {askForm}
            <p className="fd-dock-note">
              Please don’t include personal or sensitive information.{" "}
              <span className="fd-dock-meta">
                Prototype demo, not the official MCCS site · <Link href="/credits">Photo credits</Link>
              </span>
            </p>
          </div>
        </main>
      )}

      {panelPlan && openPlan !== null && inst && (
        <PlanPanel
          plan={panelPlan}
          kind={kindOf(messages[openPlan], panelPlan)}
          baseId={inst.id}
          baseName={inst.shortName}
          location={inst.location}
          onClose={closePlan}
          onChat={(q) => {
            // Like a follow-up chip: a normal question with the current audience; focus goes to the conversation.
            setOpenPlan(null);
            convRef.current?.focus({ preventScroll: true });
            send(q);
          }}
        />
      )}

      {mode === "hero" && (
        <footer className="fd-footer">
          Prototype demo — not the official MCCS site. · <Link href="/credits">Photo credits</Link>
        </footer>
      )}
    </div>
  );

}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { firstMccsLink, markdown, parseStream, shortDate, speechText } from "@/lib/chat-client";
import type { Photo } from "./photos";

export type FrontInstallation = {
  id: string;
  name: string;
  shortName: string;
  location: string;
  defaultChips: string[];
  /** Capture date of the base's pages (ISO), for the trust strip. */
  capturedOn: string;
  /** Hero photo (swaps with the selector) and installation card photo. */
  hero: Photo | null;
  card: Photo | null;
};

type Msg = {
  role: "user" | "assistant";
  content: string;
  /** Display only: tool status while waiting, follow-ups, trust line. Never sent back to the API. */
  status?: string;
  followups?: string[];
  trust?: string;
  error?: boolean;
};

type Display = { theme: "light" | "dark"; large: boolean; contrast: boolean };

const INST_KEY = "mccs-front:installation";
const DISPLAY_KEY = "mccs-front:display";
const CONVO_KEY = "mccs-front:conversation";
// Short enough to fit the ask box on a 375px phone.
const EXAMPLES = ["Gym hours today?", "Child care waitlist", "Where can I stay?", "Tuition Assistance help", "This weekend’s events"];
const PLACEHOLDER_MS = 3000;

/** "Start with a moment": each numbered card opens the conversation with a set question. */
const MOMENTS: { id: string; title: string; blurb: string; question: (base: string) => string }[] = [
  { id: "arrived", title: "I just arrived", blurb: "Get a First 7 Days plan for your new installation.", question: (b) => `I just arrived at ${b}. Can you give me a First 7 Days plan?` },
  { id: "pcs-out", title: "I’m PCSing out", blurb: "What to wrap up on base before you go.", question: (b) => `I'm PCSing out of ${b} soon. What should I take care of before I leave?` },
  { id: "talk", title: "I need someone to talk to", blurb: "Confidential support, right now.", question: () => "I need someone to talk to." },
  { id: "kids", title: "Childcare and youth", blurb: "Child care, camps, school help and youth programs.", question: () => "What child care and youth programs are there for my kids?" },
  { id: "active", title: "Getting active", blurb: "Gyms, classes, pools and sports.", question: () => "I want to get active. What gyms, classes and sports are there?" },
];
const WARM_MS = 50 * 60 * 1000; // the prompt cache lasts an hour

const PIN = "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";
const SUN = "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4";
const MOON = "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z";

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

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice just isn't remembered */
  }
};

export default function FrontDoor({ installations, momentsPhoto }: { installations: FrontInstallation[]; momentsPhoto: Photo | null }) {
  const [instId, setInstId] = useState(installations[0]?.id ?? "quantico");
  const inst = installations.find((i) => i.id === instId) ?? installations[0];
  const [display, setDisplay] = useState<Display>({ theme: "light", large: false, contrast: false });
  const [displayOpen, setDisplayOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [mode, setMode] = useState<"hero" | "chat">("hero");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [placeholder, setPlaceholder] = useState(0);
  const [askFocused, setAskFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState("");
  const [micNote, setMicNote] = useState("");
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const askRef = useRef<HTMLTextAreaElement | null>(null);
  const displayBtnRef = useRef<HTMLButtonElement | null>(null);
  const displayPanelRef = useRef<HTMLDivElement | null>(null);
  const restored = useRef(false);
  const [ready, setReady] = useState(false); // browser-only state (saved installation etc.) loaded

  // ---------- browser-only setup (after hydration) ----------
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only state once after hydration */
    const saved = read(INST_KEY);
    const startInst = saved && installations.some((i) => i.id === saved) ? saved : installations[0]?.id;
    if (startInst) setInstId(startInst);
    try {
      const d = JSON.parse(read(DISPLAY_KEY) || "null");
      if (d && (d.theme === "light" || d.theme === "dark")) setDisplay({ theme: d.theme, large: !!d.large, contrast: !!d.contrast });
    } catch {
      /* ignore a bad saved value */
    }
    // Restore the conversation after following an answer's link and coming back.
    try {
      const c = JSON.parse(sessionStorage.getItem(CONVO_KEY) || "null");
      if (c && c.inst === startInst && Array.isArray(c.messages) && c.messages.length) {
        setMessages(c.messages);
        setMode("chat");
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
  }, [installations]);

  // Pre-load the selected base's knowledge into the prompt cache while the person reads or types,
  // like the widget: at most once per browser per base per 50 minutes (same localStorage key, so the
  // widget and the front door share it). The server also rate-limits warm-ups.
  useEffect(() => {
    if (!ready || !instId) return;
    const key = `mccs-assistant:${instId}:warmed`;
    try {
      if (Date.now() - Number(localStorage.getItem(key) || 0) < WARM_MS) return;
      localStorage.setItem(key, String(Date.now()));
    } catch {
      /* storage unavailable: warm anyway */
    }
    fetch("/api/warm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ installationId: instId }) }).catch(() => {
      /* best effort */
    });
  }, [instId, ready]);

  // Rotating example questions in the ask box (still with reduced motion, paused while in use).
  useEffect(() => {
    if (reducedMotion || askFocused || question) return;
    const t = setInterval(() => setPlaceholder((p) => (p + 1) % EXAMPLES.length), PLACEHOLDER_MS);
    return () => clearInterval(t);
  }, [reducedMotion, askFocused, question]);

  // Ask box height follows its text, or its placeholder when empty (which can wrap with large text).
  useLayoutEffect(() => {
    const ta = askRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`; // capped by max-height in front.css
  }, [question, placeholder, display.large, mode]);

  // Remember the conversation for this tab (display-only fields stay out of what's sent).
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (messages.length) sessionStorage.setItem(CONVO_KEY, JSON.stringify({ inst: instId, messages: messages.map(({ status, ...m }) => (void status, m)) }));
      else sessionStorage.removeItem(CONVO_KEY);
    } catch {
      /* ignore */
    }
  }, [messages, instId]);

  // Display menu: close on Escape or a click outside.
  useEffect(() => {
    if (!displayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDisplayOpen(false);
        displayBtnRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!displayPanelRef.current?.contains(t) && !displayBtnRef.current?.contains(t)) setDisplayOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [displayOpen]);

  const updateDisplay = (next: Partial<Display>) => {
    setDisplay((d) => {
      const merged = { ...d, ...next };
      write(DISPLAY_KEY, JSON.stringify(merged));
      return merged;
    });
  };

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
    async (text: string, opts: { spoken?: boolean } = {}) => {
      const q = text.trim();
      if (!q || busy || !inst) return;
      setQuestion("");
      setMode("chat");
      stopSpeaking();
      const history: Msg[] = [...messages.filter((m) => !m.error && m.content), { role: "user", content: q }];
      while (history.length > 29) history.shift();
      while (history.length && history[0].role !== "user") history.shift();
      const replyIndex = messages.length + 1;
      setMessages((ms) => [...ms, { role: "user", content: q }, { role: "assistant", content: "" }]);
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
        patch({ content, status: undefined, followups: final.followups });
        setBusy(false);
        if (opts.spoken) speak(replyIndex, content);
        const trust = await trustLine(content);
        if (trust && !abort.signal.aborted) patch({ trust });
      } catch (err) {
        if (abort.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Couldn't reach Ask MCCS.";
        const partial = parseStream(raw).text.trim();
        patch({ content: (partial ? partial + "\n\n" : "") + msg + (/try again/i.test(msg) ? "" : " Please try again."), status: undefined, error: true });
        setBusy(false);
      }
    },
    [busy, inst, messages, speak, stopSpeaking, trustLine],
  );

  const newConversation = () => {
    resetConversation();
    setMode("hero");
    setTimeout(() => askRef.current?.focus(), 0);
  };

  const switchInstallation = (id: string) => {
    if (id === instId) return;
    write(INST_KEY, id);
    setInstId(id);
    // A different base is a different conversation.
    resetConversation();
    setMode("hero");
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
        placeholder={mode === "chat" ? "Ask a follow-up…" : EXAMPLES[placeholder]}
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
      className={`fd fd--${mode}`}
      data-theme={display.theme}
      data-text={display.large ? "large" : "normal"}
      data-contrast={display.contrast ? "high" : "normal"}
    >
      <header className="fd-top">
        <div className="fd-pill fd-inst">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="fd-pill-icon">
            <path d={PIN} />
          </svg>
          <label htmlFor="fd-inst-select" className="fd-sr">
            Installation
          </label>
          <select id="fd-inst-select" value={instId} onChange={(e) => switchInstallation(e.target.value)}>
            {installations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.shortName}
              </option>
            ))}
          </select>
        </div>
        {mode === "chat" && (
          <button type="button" className="fd-pill fd-new" onClick={newConversation}>
            New conversation
          </button>
        )}
        <div className="fd-display">
          <button
            type="button"
            ref={displayBtnRef}
            className="fd-pill fd-display-btn"
            aria-expanded={displayOpen}
            aria-controls="fd-display-panel"
            onClick={() => setDisplayOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="fd-pill-icon">
              <path d={display.theme === "dark" ? MOON : SUN} />
            </svg>
            <span className="fd-pill-label">Display</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="fd-pill-caret">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {displayOpen && (
            <div id="fd-display-panel" className="fd-display-panel" ref={displayPanelRef} role="group" aria-label="Display settings">
              <fieldset>
                <legend>Theme</legend>
                {(["light", "dark"] as const).map((t) => (
                  <label key={t}>
                    <input type="radio" name="fd-theme" checked={display.theme === t} onChange={() => updateDisplay({ theme: t })} />
                    {t === "light" ? "Light" : "Dark"}
                  </label>
                ))}
              </fieldset>
              <label>
                <input type="checkbox" checked={display.large} onChange={(e) => updateDisplay({ large: e.target.checked })} />
                Large text
              </label>
              <label>
                <input type="checkbox" checked={display.contrast} onChange={(e) => updateDisplay({ contrast: e.target.checked })} />
                High contrast
              </label>
            </div>
          )}
        </div>
      </header>

      {mode === "hero" ? (
        <main className="fd-main">
          <section className="fd-hero" aria-labelledby="fd-title">
            {inst?.hero && (
              <figure className="fd-hero-photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP */}
                <img src={inst.hero.src} alt={inst.hero.alt} style={{ objectPosition: inst.hero.focus }} fetchPriority="high" />
                {credit(inst.hero)}
              </figure>
            )}
            <div className="fd-hero-text">
              <h1 id="fd-title">
                <span className="fd-red">Ask MCCS</span> anything.
              </h1>
              <p className="fd-lead">Hours, programs, child care, fitness and more at {inst?.name}, answered from official MCCS pages.</p>
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
              <h2 className="fd-label" id="fd-moments">
                Start with a moment
              </h2>
              <ol className="fd-moments" aria-labelledby="fd-moments">
                {MOMENTS.map((m, n) => (
                  <li key={m.id}>
                    <button type="button" className="fd-card fd-ncard" data-moment={m.id} onClick={() => send(m.question(inst?.shortName ?? ""))}>
                      <span className="fd-num" aria-hidden="true">
                        {String(n + 1).padStart(2, "0")}
                      </span>
                      <span className="fd-ncard-body">
                        <span className="fd-card-title">{m.title}</span>
                        <span className="fd-card-blurb">{m.blurb}</span>
                        <span className="fd-cta" aria-hidden="true">
                          Ask MCCS <span className="fd-arrow">→</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

              <h2 className="fd-label" id="fd-bases">
                Your installation
              </h2>
              <ul className="fd-bases" aria-labelledby="fd-bases">
                {installations.map((i) => (
                  <li key={i.id}>
                    <a className="fd-card fd-bcard" href={`/${i.id}`}>
                      {i.card && (
                        <span className="fd-bcard-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP */}
                          <img src={i.card.src} alt={i.card.alt} loading="lazy" />
                        </span>
                      )}
                      <span className="fd-card-title">{i.name}</span>
                      <span className="fd-card-blurb">{i.location}</span>
                      <span className="fd-cta" aria-hidden="true">
                        Visit the site <span className="fd-arrow">→</span>
                      </span>
                    </a>
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
        <main className="fd-main fd-chat-main">
          <div className="fd-dock">
            <p className="fd-dock-title" aria-hidden="true">
              <span className="fd-red">Ask MCCS</span> · {inst?.shortName}
            </p>
            {askForm}
            {voiceStatus}
          </div>
          <h1 className="fd-sr">Ask MCCS conversation</h1>
          <section className="fd-conv" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversation">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="fd-q">
                  {m.content}
                </p>
              ) : (
                <article key={i} className={`fd-a${m.error ? " is-error" : ""}`}>
                  {m.content ? (
                    <div className="fd-md" dangerouslySetInnerHTML={{ __html: markdown(m.content, inst?.location) }} />
                  ) : m.status ? null : (
                    <span className="fd-typing" aria-label="Ask MCCS is typing">
                      <i />
                      <i />
                      <i />
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
                        <button type="button" className="fd-pill fd-small" onClick={() => speak(i, m.content)}>
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
                          if (speaking === i) speak(i, m.content, next);
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
        </main>
      )}

      <footer className="fd-footer">
        Prototype demo — not the official MCCS site. · <Link href="/credits">Photo credits</Link>
      </footer>
    </div>
  );

}

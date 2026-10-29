/**
 * Browser-side helpers for talking to /api/chat outside the widget (the front door at /).
 * Mirrors public/widget.js: the stream format, the small safe markdown with tap-to-call and map
 * links, and demo-app link mapping. Keep the two in step.
 */

/** Separates the answer text from the follow-up chips frame. */
export const FRAME = "\u001e";
/** Wraps a status line ("Checking the live MCCS page…") sent while a tool runs. */
export const STATUS = "\u001d";

/** Shown in place of typing dots until the answer starts. Same list as THINKING in public/widget.js. */
export const THINKING = ["Hooking and jabbing, be right back…"];

/** Demo app slugs that differ from the real subdomain (same map as scripts/extract-theme.mjs). */
const SLUG_FOR_SUBDOMAIN: Record<string, string> = { lejeunenewriver: "lejeune" };

export type ParsedStream = { text: string; status: string; followups: string[] };

/**
 * Answer text without status frames; the status to show (the latest complete one, until answer
 * text arrives after it); and the follow-up chips once their frame is complete.
 */
export function parseStream(raw: string, done = false): ParsedStream {
  const [answer, frame] = raw.split(FRAME);
  const parts = answer.split(STATUS);
  let text = "";
  let status = "";
  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      text += part;
      if (part.trim()) status = "";
    } else if (i < parts.length - 1) {
      status = part;
    }
  });
  let followups: string[] = [];
  if (frame && done) {
    try {
      const items = JSON.parse(frame).followups;
      if (Array.isArray(items)) followups = items.filter((x) => typeof x === "string").slice(0, 2);
    } catch {
      // a malformed frame just means no chips
    }
  }
  return { text, status, followups };
}

/** Demo path for a link to a real MCCS installation site: https://pendleton.usmc-mccs.org/x -> /pendleton/x. */
export function demoPath(href: string): { slug: string; path: string; local: string } | null {
  let u: URL;
  try {
    u = new URL(href.replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.pathname.startsWith("/modules/")) return null;
  const m = /^([a-z0-9]+)\.usmc-mccs\.org$/.exec(u.hostname.replace(/^www\./, ""));
  if (!m) return null;
  const slug = SLUG_FOR_SUBDOMAIN[m[1]] || m[1];
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return { slug, path, local: `/${slug}${path === "/" ? "" : path}${u.search}${u.hash}` };
}

/** First link in an answer to a page on an MCCS installation site, for the trust line. */
export function firstMccsLink(markdownText: string): { slug: string; path: string } | null {
  for (const m of markdownText.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)) {
    const d = demoPath(m[1]);
    if (d) return { slug: d.slug, path: d.path };
  }
  return null;
}

/** "2026-10-26" -> "Oct 26". */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Plain text for reading aloud: no markdown, link text kept, urls dropped. */
export function speechText(markdownText: string): string {
  return markdownText
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ---------- tiny, safe markdown: paragraphs, lists, **bold**, links (same as the widget) ----------

const PHONE = String.raw`(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}`;
const CRISIS = "(?:dial|call) 988|text 838255";
const STREET = String.raw`\b\d{2,5} (?:[A-Z][a-z]+\.? ){1,3}(?:Rd|Road|Ave|Avenue|St|Street|Loop|Blvd|Dr|Drive|Ln|Lane|Hwy|Way|Ct|Pl|Cir|Circle)\b\.?(?:,? (?:Suite|Ste\.?|Bldg\.?|Building) [\w-]+)?`;
const INLINE = new RegExp(
  String.raw`\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^\s)]+)\)|(https?:\/\/[^\s<]*[^\s<.,;:!?)\]])|\*\*([^*]+)\*\*|(` +
    CRISIS + ")|(" + PHONE + ")|(" + STREET + ")",
  "g",
);

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const unescapeHtml = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Answer markdown to HTML. Input is escaped first; only tags built here are added. */
export function markdown(src: string, location = ""): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.join("<br>")}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of escapeHtml(src).split(/\r?\n/)) {
    const line = raw.trim();
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (list !== type) {
        closeList();
        out.push(`<${type}>`);
        list = type;
      }
      out.push(`<li>${inline((ul || ol)![1], location)}</li>`);
    } else if (!line) {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(inline(line.replace(/^#{1,6}\s+/, ""), location));
    }
  }
  flushPara();
  closeList();
  return out.join("");
}

function inline(s: string, location: string): string {
  return s.replace(INLINE, (whole, text, href, bare, bold, crisis, phone, street) => {
    if (href) return link(href, text);
    if (bare) return link(bare, bare);
    if (bold) return `<strong>${inline(bold, location)}</strong>`;
    if (crisis) {
      const sms = /838255/.test(crisis);
      return `<a href="${sms ? "sms:838255" : "tel:988"}">${crisis}</a>`;
    }
    if (phone) return `<a href="tel:${phone.replace(/[^\d+]/g, "")}">${phone}</a>`;
    if (street) {
      const place = unescapeHtml(street) + (location ? `, ${location}` : "");
      return `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(place)}" target="_blank" rel="noopener noreferrer">${street}</a>`;
    }
    return whole;
  });
}

function link(href: string, text: string): string {
  const local = demoPath(href);
  if (local) return `<a href="${escapeHtml(local.local)}">${text}</a>`;
  const external = /^https?:/.test(href);
  return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
}

// ---------- plan mode: an intro sentence, then a ```plan JSON block (lib/turn.ts) ----------

export type PlanItem = { task: string; detail?: string; where?: string; when?: string; phone?: string; sourceUrl?: string; confirm?: boolean };
export type Plan = { title: string; sections: { name: string; items: PlanItem[] }[] };
export type PlanReply = {
  /** Text before the block, and any after it. */
  intro: string;
  after: string;
  /** The parsed plan, or null while the block is still streaming or when its JSON is invalid. */
  plan: Plan | null;
  /** The block has started (so the raw JSON shouldn't be shown while it streams). */
  started: boolean;
};

const PLAN_OPEN = /```plan[^\n]*\n?/;

/** Splits a plan-mode reply. Returns null when there's no ```plan block. */
export function parsePlanReply(text: string): PlanReply | null {
  const open = PLAN_OPEN.exec(text);
  if (!open) return null;
  const intro = text.slice(0, open.index).trim();
  const rest = text.slice(open.index + open[0].length);
  const close = rest.indexOf("```");
  if (close < 0) return { intro, after: "", plan: null, started: true };
  return { intro, after: rest.slice(close + 3).trim(), plan: toPlan(rest.slice(0, close)), started: true };
}

/** The text to show when a plan can't be: the reply without the fence markers. */
export function planFallbackText(text: string): string {
  return text.replace(PLAN_OPEN, "\n").replace(/```/g, "\n").trim();
}

const str = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

function toPlan(json: string): Plan | null {
  let data: unknown;
  try {
    data = JSON.parse(json.trim());
  } catch {
    return null;
  }
  const d = data as { title?: unknown; sections?: unknown };
  if (!d || typeof d !== "object" || !Array.isArray(d.sections)) return null;
  const sections = d.sections
    .map((s: { name?: unknown; items?: unknown }) => ({
      name: str(s?.name, 80) ?? "",
      items: (Array.isArray(s?.items) ? s.items : [])
        .map((it: Record<string, unknown>): PlanItem | null => {
          const task = str(it?.task, 160);
          if (!task) return null;
          return { task, detail: str(it.detail), where: str(it.where, 160), when: str(it.when, 120), phone: str(it.phone, 40), sourceUrl: str(it.sourceUrl, 500), confirm: it.confirm === true };
        })
        .filter((x: PlanItem | null): x is PlanItem => !!x),
    }))
    .filter((s: { name: string; items: PlanItem[] }) => s.name && s.items.length);
  if (!sections.length) return null;
  return { title: str(d.title, 120) ?? "Your plan", sections };
}

/** The plan as plain text (Copy). */
export function planText(plan: Plan, baseName: string): string {
  const lines = [`${plan.title} · ${baseName}`, ""];
  for (const s of plan.sections) {
    lines.push(s.name);
    for (const it of s.items) {
      const meta = [it.when, it.where, it.phone, it.confirm ? "call to confirm" : ""].filter(Boolean).join(" · ");
      lines.push(`- ${it.task}${it.detail ? ` — ${it.detail}` : ""}${meta ? ` (${meta})` : ""}`);
      if (it.sourceUrl) lines.push(`  ${it.sourceUrl}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Map search link for a place on the installation. */
export function mapHref(place: string, location = ""): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place + (location ? `, ${location}` : ""))}`;
}

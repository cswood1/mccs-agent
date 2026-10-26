import { Marked } from "marked";
import { localHref } from "@/lib/site/data";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Captured page text is markdown from WebFetch. Render it without any raw HTML, keep
// links on the real site inside the recreation, and open other sites in a new tab.
const md = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }) {
      return escape(text);
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:|mailto:|tel:|\/)/i.test(href)) return label;
      const local = localHref(href);
      const external = /^https?:/i.test(local);
      return `<a href="${escape(local)}"${external ? ' target="_blank" rel="noopener" class="external-link"' : ""}>${label}</a>`;
    },
    image({ href, text }) {
      if (!/^https?:/i.test(href)) return "";
      return `<img src="${escape(href)}" alt="${escape(text)}" class="img-fluid">`;
    },
    table(token) {
      // Bootstrap table classes, as on the real site.
      const header = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("");
      const rows = token.rows
        .map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`)
        .join("");
      return `<div class="table-responsive"><table class="table table-striped table-bordered table-sm"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },
  },
});

export function renderMarkdown(src: string): string {
  // Some captures flatten "•" bullet lines into one paragraph; turn them back into a list.
  const text = (src ?? "").replace(/(^|\s)•\s+/g, "\n- ").replace(/^\n/, "");
  return md.parse(text, { async: false }) as string;
}

/** Inline-only rendering (no wrapping <p>), for short strings like card teasers. */
export function renderInline(src: string): string {
  return md.parseInline(src ?? "", { async: false }) as string;
}

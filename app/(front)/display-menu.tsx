"use client";

import { useEffect, useRef, useState } from "react";
import { read, write } from "./shared";

/** Display settings (Light/Dark, Large text, High contrast), saved per browser, shared by both pages. */
export type Display = { theme: "light" | "dark"; large: boolean; contrast: boolean };
const DISPLAY_KEY = "mccs-front:display";

export function useDisplay() {
  const [display, setDisplay] = useState<Display>({ theme: "light", large: false, contrast: false });
  useEffect(() => {
    try {
      const d = JSON.parse(read(DISPLAY_KEY) || "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read once after hydration
      if (d && (d.theme === "light" || d.theme === "dark")) setDisplay({ theme: d.theme, large: !!d.large, contrast: !!d.contrast });
    } catch {
      /* ignore a bad saved value */
    }
  }, []);
  const update = (next: Partial<Display>) =>
    setDisplay((d) => {
      const merged = { ...d, ...next };
      write(DISPLAY_KEY, JSON.stringify(merged));
      return merged;
    });
  const attrs = { "data-theme": display.theme, "data-text": display.large ? "large" : "normal", "data-contrast": display.contrast ? "high" : "normal" };
  return { display, update, attrs };
}

const SUN = "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4";
const MOON = "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z";

export function DisplayMenu({ display, update }: { display: Display; update: (next: Partial<Display>) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape (focus back on the button) or a click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="fd-display">
      <button
        type="button"
        ref={btnRef}
        className="fd-pill fd-display-btn"
        aria-expanded={open}
        aria-controls="fd-display-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="fd-pill-icon">
          <path d={display.theme === "dark" ? MOON : SUN} />
        </svg>
        <span className="fd-pill-label">Display</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="fd-pill-caret">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id="fd-display-panel" className="fd-display-panel" ref={panelRef} role="group" aria-label="Display settings">
          <fieldset>
            <legend>Theme</legend>
            {(["light", "dark"] as const).map((t) => (
              <label key={t}>
                <input type="radio" name="fd-theme" checked={display.theme === t} onChange={() => update({ theme: t })} />
                {t === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
          <label>
            <input type="checkbox" checked={display.large} onChange={(e) => update({ large: e.target.checked })} />
            Large text
          </label>
          <label>
            <input type="checkbox" checked={display.contrast} onChange={(e) => update({ contrast: e.target.checked })} />
            High contrast
          </label>
        </div>
      )}
    </div>
  );
}

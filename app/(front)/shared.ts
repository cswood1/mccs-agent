"use client";

import { useEffect, type RefObject } from "react";

/** Shared by the Explore page (/) and each base's front door (/ask/<base>). */

export const LAST_KEY = "mccs-front:installation"; // last visited base (localStorage)
export const ARRIVED_KEY = "mccs-front:arrived"; // set when picking on the globe; the front door focuses its ask box
const WARM_MS = 50 * 60 * 1000; // the prompt cache lasts an hour

export const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
export const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice just isn't remembered */
  }
};

/**
 * Pre-load a base's knowledge into the prompt cache, like the widget: at most once per browser per
 * base per 50 minutes (the widget's localStorage key, so they share it). The server also rate-limits.
 */
export function warm(installationId: string) {
  const key = `mccs-assistant:${installationId}:warmed`;
  try {
    if (Date.now() - Number(localStorage.getItem(key) || 0) < WARM_MS) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage unavailable: warm anyway */
  }
  fetch("/api/warm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ installationId }) }).catch(() => {
    /* best effort */
  });
}

/** Last input type on the root element (data-input), for focus rings shown for keyboard focus only. */
export function useInputType(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const set = (type: "keyboard" | "pointer") => () => {
      if (rootRef.current) rootRef.current.dataset.input = type;
    };
    const onKey = set("keyboard");
    const onPointer = set("pointer");
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [rootRef]);
}

export const GLOBE_ICON =
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.3 2.4 3.5 5.5 3.5 9s-1.2 6.6-3.5 9c-2.3-2.4-3.5-5.5-3.5-9s1.2-6.6 3.5-9z";

/** Can this browser draw the WebGL globe? */
export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

"use client";

import { useEffect } from "react";

// 1x1 transparent GIF; the .img-placeholder class paints the neutral placeholder behind it.
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Small behaviors the real site gets from its own scripts (which we don't copy):
 * photo fallback, the Important Links scroll arrows, and side-nav expanders. (The header search box
 * is enhanced by the widget.)
 */
export default function SiteEnhancements() {
  useEffect(() => {
    const swap = (img: HTMLImageElement) => {
      // React-rendered photos (<Photo>) handle their own fallback.
      if (img.dataset.fallback || img.hasAttribute("data-photo") || img.src.startsWith("data:")) return;
      img.dataset.fallback = "1";
      // Icons (social links etc.) just disappear; photos get a neutral placeholder.
      const declared = parseInt(img.getAttribute("height") || img.getAttribute("width") || "0", 10);
      if (declared && declared < 60) {
        img.style.visibility = "hidden";
        return;
      }
      img.classList.add("img-placeholder");
      img.src = BLANK;
    };
    // Wait until the page has loaded (and React has hydrated it) before touching the DOM,
    // or the swap shows up as a hydration mismatch.
    let ready = false;
    const pending: HTMLImageElement[] = [];
    const onError = (e: Event) => {
      if (!(e.target instanceof HTMLImageElement)) return;
      if (ready) swap(e.target);
      else pending.push(e.target);
    };
    document.addEventListener("error", onError, true);
    const start = () =>
      setTimeout(() => {
        ready = true;
        pending.forEach(swap);
        document.querySelectorAll("img").forEach((img) => {
          if (img.complete && img.naturalWidth === 0 && img.src) swap(img);
        });
      }, 0);
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const arrow = t.closest<HTMLElement>(".scroll-left, .scroll-right");
      if (arrow) {
        const row = arrow.closest(".container")?.querySelector<HTMLElement>(".overflow-x-auto");
        row?.scrollBy({ left: arrow.classList.contains("scroll-left") ? -320 : 320, behavior: "smooth" });
      }
      const toggle = t.closest<HTMLButtonElement>(".sidenav-dropdown-arrow");
      if (toggle) {
        const list = document.getElementById(toggle.getAttribute("aria-controls") || "");
        if (list) {
          const open = list.style.display === "none";
          list.style.display = open ? "block" : "none";
          toggle.setAttribute("aria-expanded", String(open));
        }
      }
      // The header search box is handled by the widget (Ask MCCS search, docs/PRODUCT.md §13).
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("load", start);
      document.removeEventListener("error", onError, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  return null;
}

"use client";

import { useEffect, useRef } from "react";
import type { GlobeInstance } from "globe.gl";
import type { Display } from "./display-menu";

/** One marker per MCCS site; only the bases with a front door are clickable. */
export type GlobeMarker = { id: string; label: string; lat: number; lng: number; dir: "left-down" | "right" | "right-up" | "right-down"; clickable: boolean };
export type GlobeApi = { flyTo: (id: string) => Promise<void> };

// Facing North America, tilted so the continental US is centered.
const HOME = { lat: 37, lng: -96, altitude: 1.75 };
// Phones: a little farther out and a little east, so the East Coast labels fit on a 375px screen.
const HOME_NARROW = { ...HOME, lng: -93, altitude: 2.15 };
const START = { lat: 18, lng: -25, altitude: 2.3 }; // over the Atlantic, for the idle spin
// Zoom limits: out to where the US stays readable; in far enough that clustered sites (San Diego,
// the Carolinas, the DC area) separate and their labels fit.
const MIN_ALT = 0.3;
const MAX_ALT = 2.6;

/** Grayscale palette per theme (globe surface, land dots, atmosphere). */
function palette(d: Display) {
  if (d.contrast) return d.theme === "dark" ? { globe: "#000000", land: "#ffffff", glow: "#ffffff" } : { globe: "#ffffff", land: "#000000", glow: "#000000" };
  return d.theme === "dark" ? { globe: "#101a27", land: "#7b8ca3", glow: "#4d6a93" } : { globe: "#e7ecf2", land: "#6f7d8f", glow: "#aebfd3" };
}

/**
 * The Explore globe (globe.gl, loaded on demand in the browser). Dotted land from a bundled GeoJSON
 * (public/globe/countries.geojson), a soft atmosphere, and one pulsing MCCS-red marker per MCCS site
 * with an HTML label. Idle spin, then it settles on the US; drag with inertia; zoom limited.
 *
 * Labels never overlap: every frame, labels are placed greedily, the clickable bases first; any other
 * label that would overlap one already placed is hidden until its dot is hovered or a zoom gives it
 * room. Dots always show.
 */
export default function Globe({
  markers,
  display,
  reducedMotion,
  lastId,
  onSelect,
  apiRef,
}: {
  markers: GlobeMarker[];
  display: Display;
  reducedMotion: boolean;
  lastId: string | null;
  onSelect: (id: string) => void;
  apiRef: React.RefObject<GlobeApi | null>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const globeRef = useRef<GlobeInstance | null>(null);
  const colorsRef = useRef(palette(display)); // current palette, for the test hook
  const onSelectRef = useRef(onSelect);
  const displayRef = useRef(display);
  const lastRef = useRef(lastId);
  useEffect(() => {
    onSelectRef.current = onSelect;
    displayRef.current = display;
    lastRef.current = lastId;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let resize: ResizeObserver | undefined;
    let frame = 0;

    (async () => {
      const [{ default: GlobeGl }, land] = await Promise.all([
        import("globe.gl"),
        fetch("/globe/countries.geojson").then((r) => r.json()),
      ]);
      if (disposed) return;
      const home = host.clientWidth < 500 ? HOME_NARROW : HOME;
      const c = palette(displayRef.current);
      const globe = new GlobeGl(host, { animateIn: false, rendererConfig: { antialias: true, alpha: true } })
        .backgroundColor("rgba(0,0,0,0)")
        .showAtmosphere(true)
        .atmosphereColor(c.glow)
        .atmosphereAltitude(0.16)
        .hexPolygonsData(land.features)
        .hexPolygonResolution(3)
        .hexPolygonMargin(0.4)
        .hexPolygonUseDots(true)
        .hexPolygonColor(() => c.land)
        .htmlElementsData(markers)
        .htmlLat("lat")
        .htmlLng("lng")
        .htmlAltitude(0.012)
        .htmlElement((d) => marker(d as GlobeMarker))
        // Markers on the far side of the globe are hidden (and can't be clicked).
        .htmlElementVisibilityModifier((el, visible) => {
          el.style.opacity = visible ? "1" : "0";
          el.style.pointerEvents = visible ? "auto" : "none";
        })
        .width(host.clientWidth)
        .height(host.clientHeight)
        .pointOfView(reducedMotion ? home : START, 0);
      globeRef.current = globe;
      const material = globe.globeMaterial() as unknown as { color: { set: (c: string) => void }; shininess: number };
      material.color.set(c.globe);
      material.shininess = 4;

      const controls = globe.controls();
      controls.enableDamping = true; // drag with inertia
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.rotateSpeed = 0.55;
      controls.zoomSpeed = 0.6;
      controls.minDistance = 100 * (1 + MIN_ALT);
      controls.maxDistance = 100 * (1 + MAX_ALT);
      // Phones: vertical drags scroll the page; horizontal drags spin the globe.
      globe.renderer().domElement.style.touchAction = "pan-y";
      const canvas = globe.renderer().domElement;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Interactive globe of MCCS installations worldwide, including ${markers.filter((m) => m.clickable).map((m) => m.label).join(", ")}. Use the list of installations to choose one.`);

      if (!reducedMotion) {
        // A slow idle spin, then settle facing the US. Any drag ends the intro.
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.9;
        settleTimer = setTimeout(() => {
          controls.autoRotate = false;
          globe.pointOfView(home, 1800);
        }, 2200);
        controls.addEventListener("start", () => {
          clearTimeout(settleTimer);
          controls.autoRotate = false;
        });
      }

      resize = new ResizeObserver(() => globe.width(host.clientWidth).height(host.clientHeight));
      resize.observe(host);

      apiRef.current = {
        flyTo: (id) =>
          new Promise((resolve) => {
            const b = markers.find((x) => x.id === id);
            clearTimeout(settleTimer);
            controls.autoRotate = false;
            if (!b) return resolve();
            globe.pointOfView({ lat: b.lat, lng: b.lng, altitude: 0.5 }, 1000);
            setTimeout(resolve, 1000);
          }),
      };
      // Hovering a spot shows every label whose dot is under the pointer, stacked, so overlapping and
      // shared dots (Western Recruiting Region is at MCRD San Diego) can still be read.
      let pointer: { x: number; y: number } | null = null;
      host.addEventListener("pointermove", (e) => (pointer = { x: e.clientX, y: e.clientY }));
      host.addEventListener("pointerleave", () => (pointer = null));

      // Label collisions, every frame (positions change as the globe turns and zooms).
      const placeLabels = () => {
        const placed: DOMRect[] = [];
        const els = [...host.querySelectorAll<HTMLElement>(".fd-marker")];
        // Other sites' labels stay inside the globe area (and on screen) and keep clear of every dot.
        const hostRect = host.getBoundingClientRect();
        const bounds = { left: Math.max(hostRect.left, 0), right: Math.min(hostRect.right, document.documentElement.clientWidth), top: hostRect.top, bottom: hostRect.bottom };
        const dots = els.filter((e) => e.style.opacity !== "0").map((e) => ({ el: e, r: e.querySelector(".fd-marker-dot")!.getBoundingClientRect() }));
        // Clickable bases first, then the others in a fixed order.
        els.sort((a, b) => Number(b.dataset.clickable === "true") - Number(a.dataset.clickable === "true"));
        for (const el of els) {
          if (el.style.opacity === "0") {
            el.classList.remove("is-label-hidden", "is-flipped"); // far side of the globe: not shown anyway
            continue;
          }
          const label = el.querySelector<HTMLElement>(".fd-marker-label");
          if (!label) continue;
          el.classList.remove("is-label-hidden", "is-flipped");
          const over = (r: DOMRect, p: DOMRect) => r.left < p.right && p.left < r.right && r.top < p.bottom && p.top < r.bottom;
          const outside = (r: DOMRect) => r.left < bounds.left || r.right > bounds.right || r.top < bounds.top || r.bottom > bounds.bottom;
          const hits = (r: DOMRect) => outside(r) || placed.some((p) => over(r, p)) || dots.some((d) => d.el !== el && over(r, d.r));
          let r = label.getBoundingClientRect();
          const coversDot = (rr: DOMRect) => dots.some((d) => d.el !== el && over(rr, d.r));
          if (el.dataset.clickable === "true" && (outside(r) || coversDot(r))) {
            // A front-door base's label always shows: flip it if that keeps it on screen and clear of
            // other sites' dots.
            el.classList.add("is-flipped");
            const flipped = label.getBoundingClientRect();
            if (outside(flipped) || coversDot(flipped) || placed.some((p) => over(flipped, p))) el.classList.remove("is-flipped");
            else r = flipped;
          }
          if (el.dataset.clickable !== "true" && hits(r)) {
            // Try the other side of the dot, then hide the label (the dot stays).
            el.classList.add("is-flipped");
            r = label.getBoundingClientRect();
            if (hits(r)) {
              el.classList.remove("is-flipped");
              el.classList.add("is-label-hidden");
              continue;
            }
          }
          placed.push(r);
        }
        // Hover group: all dots under the pointer.
        const near = pointer
          ? dots.filter(({ r }) => pointer!.x >= r.left - 4 && pointer!.x <= r.right + 4 && pointer!.y >= r.top - 4 && pointer!.y <= r.bottom + 4).map((d) => d.el)
          : [];
        for (const el of els) {
          const k = near.indexOf(el);
          el.classList.toggle("is-hover", k >= 0);
          el.style.setProperty("--fd-stack", String(Math.max(k, 0)));
        }
        frame = requestAnimationFrame(placeLabels);
      };
      frame = requestAnimationFrame(placeLabels);
      host.dataset.ready = "true";
      // Test hook: the current point of view and colors.
      (window as unknown as { __mccsGlobe?: object }).__mccsGlobe = {
        ...((window as unknown as { __mccsGlobe?: object }).__mccsGlobe ?? {}),
        ready: true,
        pov: () => globe.pointOfView(),
        view: (pov: { lat: number; lng: number; altitude?: number }) => {
          clearTimeout(settleTimer);
          controls.autoRotate = false;
          globe.pointOfView(pov, 0);
        },
        colors: () => colorsRef.current,
      };
    })().catch(() => {
      host.dataset.ready = "error";
    });

    function marker(m: GlobeMarker) {
      // Bases with a front door are buttons; every other site is a plain marker (hover only).
      const el = document.createElement(m.clickable ? "button" : "div");
      if (el instanceof HTMLButtonElement) el.type = "button";
      el.className = `fd-marker fd-marker--${m.dir}${m.clickable ? "" : " fd-marker--static"}${m.id === lastRef.current ? " is-last" : ""}`;
      el.dataset.installation = m.id;
      el.dataset.clickable = String(m.clickable);
      // The list next to the globe is the keyboard and screen-reader path; markers are for pointers.
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `<span class="fd-marker-dot"></span><span class="fd-marker-label"></span>`;
      (el.querySelector(".fd-marker-label") as HTMLElement).textContent = m.label;
      if (m.clickable)
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(m.id);
        });
      return el;
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      resize?.disconnect();
      apiRef.current = null;
      globeRef.current?._destructor();
      globeRef.current = null;
      host.replaceChildren();
    };
    // Built once; theme changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the theme (light, dark, high contrast).
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const c = palette(display);
    colorsRef.current = c;
    globe.atmosphereColor(c.glow).hexPolygonColor(() => c.land);
    (globe.globeMaterial() as unknown as { color: { set: (c: string) => void } }).color.set(c.globe);
  }, [display]);

  // Mark the last visited base's marker.
  useEffect(() => {
    hostRef.current?.querySelectorAll<HTMLElement>(".fd-marker").forEach((m) => m.classList.toggle("is-last", m.dataset.installation === lastId));
  });

  return <div className="fd-globe" ref={hostRef} />;
}

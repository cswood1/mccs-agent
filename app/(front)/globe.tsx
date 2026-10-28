"use client";

import { useEffect, useRef } from "react";
import type { GlobeInstance } from "globe.gl";
import type { Display } from "./display-menu";

export type GlobeBase = { id: string; shortName: string; lat: number; lng: number; label: "left" | "right-up" | "right-down" };
export type GlobeApi = { flyTo: (id: string) => Promise<void> };

// Facing North America, tilted so the continental US is centered.
const HOME = { lat: 37, lng: -96, altitude: 1.75 };
// Phones: a little farther out and a little east, so the East Coast labels fit on a 375px screen.
const HOME_NARROW = { ...HOME, lng: -93, altitude: 2.15 };
const START = { lat: 18, lng: -25, altitude: 2.3 }; // over the Atlantic, for the idle spin
const MIN_ALT = 0.9; // zoom limits: the US stays readable
const MAX_ALT = 2.6;

/** Grayscale palette per theme (globe surface, land dots, atmosphere). */
function palette(d: Display) {
  if (d.contrast) return d.theme === "dark" ? { globe: "#000000", land: "#ffffff", glow: "#ffffff" } : { globe: "#ffffff", land: "#000000", glow: "#000000" };
  return d.theme === "dark" ? { globe: "#101a27", land: "#7b8ca3", glow: "#4d6a93" } : { globe: "#e7ecf2", land: "#6f7d8f", glow: "#aebfd3" };
}

/**
 * The Explore globe (globe.gl, loaded on demand in the browser). Dotted land from a bundled GeoJSON
 * (public/globe/countries.geojson), a soft atmosphere, and one pulsing MCCS-red marker per base with
 * an HTML label. Idle spin, then it settles on the US; drag with inertia; zoom limited.
 */
export default function Globe({
  bases,
  display,
  reducedMotion,
  lastId,
  onSelect,
  apiRef,
}: {
  bases: GlobeBase[];
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
        .htmlElementsData(bases)
        .htmlLat("lat")
        .htmlLng("lng")
        .htmlAltitude(0.012)
        .htmlElement((d) => marker(d as GlobeBase))
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
      canvas.setAttribute("aria-label", `Interactive globe with ${bases.map((b) => b.shortName).join(", ")}. Use the list of installations to choose one.`);

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
            const b = bases.find((x) => x.id === id);
            clearTimeout(settleTimer);
            controls.autoRotate = false;
            if (!b) return resolve();
            globe.pointOfView({ lat: b.lat, lng: b.lng, altitude: 0.5 }, 1000);
            setTimeout(resolve, 1000);
          }),
      };
      host.dataset.ready = "true";
      // Test hook: the current point of view and colors.
      (window as unknown as { __mccsGlobe?: object }).__mccsGlobe = {
        ...((window as unknown as { __mccsGlobe?: object }).__mccsGlobe ?? {}),
        ready: true,
        pov: () => globe.pointOfView(),
        colors: () => colorsRef.current,
      };
    })().catch(() => {
      host.dataset.ready = "error";
    });

    function marker(b: GlobeBase) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `fd-marker fd-marker--${b.label}${b.id === lastRef.current ? " is-last" : ""}`;
      el.dataset.installation = b.id;
      // The list next to the globe is the keyboard and screen-reader path; markers are for pointers.
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `<span class="fd-marker-dot"></span><span class="fd-marker-label"></span>`;
      (el.querySelector(".fd-marker-label") as HTMLElement).textContent = b.shortName;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(b.id);
      });
      return el;
    }

    return () => {
      disposed = true;
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

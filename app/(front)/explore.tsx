"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { DisplayMenu, useDisplay } from "./display-menu";
import type { GlobeApi, GlobeMarker } from "./globe";
import { ARRIVED_KEY, hasWebGL, LAST_KEY, read, useInputType, warm, write } from "./shared";

// The globe library is loaded only in the browser, after the page is up.
const Globe = dynamic(() => import("./globe"), { ssr: false });

type ExploreBase = { id: string; name: string; shortName: string; location: string };

/** Explore your MCCS (/): pick a base on the globe, or from the list, to open its front door. */
export default function Explore({ bases, markers }: { bases: ExploreBase[]; markers: GlobeMarker[] }) {
  const { display, update, attrs } = useDisplay();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<GlobeApi | null>(null);
  const lastBtnRef = useRef<HTMLButtonElement | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null); // null until checked in the browser
  const [picking, setPicking] = useState<string | null>(null);
  useInputType(rootRef);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- browser-only state, read once after hydration */
    const last = read(LAST_KEY);
    setLastId(last && bases.some((b) => b.id === last) ? last : null);
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setWebgl(hasWebGL());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [bases]);

  // The last visited base gets focus first.
  useEffect(() => {
    if (lastId) lastBtnRef.current?.focus({ preventScroll: true });
  }, [lastId]);

  const select = useCallback(
    async (id: string) => {
      if (picking || !bases.some((b) => b.id === id)) return;
      setPicking(id);
      warm(id); // as soon as it's picked
      write(LAST_KEY, id);
      try {
        sessionStorage.setItem(ARRIVED_KEY, id); // the front door focuses its ask box
      } catch {
        /* ignore */
      }
      // Fly to the marker (about 1 s), then navigate. A full navigation, so browsers with cross-document
      // view transitions crossfade into the front door (front.css); others just navigate.
      if (!reducedMotion && apiRef.current) await apiRef.current.flyTo(id);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full navigation enables the cross-document view transition
      window.location.assign(`/ask/${id}`);
    },
    [bases, picking, reducedMotion],
  );

  // Test hook: select a base as a marker click would.
  useEffect(() => {
    const w = window as unknown as { __mccsGlobe?: object };
    w.__mccsGlobe = { ...(w.__mccsGlobe ?? {}), select };
  }, [select]);

  return (
    <div ref={rootRef} className="fd fd--explore" {...attrs}>
      <header className="fd-top">
        <DisplayMenu display={display} update={update} />
      </header>
      <main className="fd-explore">
        <section className="fd-explore-text" aria-labelledby="fd-explore-title">
          <h1 id="fd-explore-title">
            <span className="fd-red">Explore</span> your MCCS.
          </h1>
          <p className="fd-lead">Marine Corps Community Services, one question away. Choose your installation to get started.</p>
          <h2 className="fd-label" id="fd-choose">
            or choose:
          </h2>
          <ul className="fd-explore-list" aria-labelledby="fd-choose">
            {bases.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className={`fd-card fd-explore-btn${b.id === lastId ? " is-last" : ""}`}
                  data-installation={b.id}
                  ref={b.id === lastId ? lastBtnRef : undefined}
                  aria-busy={picking === b.id || undefined}
                  onClick={() => select(b.id)}
                >
                  <span className="fd-card-title">{b.shortName}</span>
                  <span className="fd-card-blurb">{b.location}</span>
                  {b.id === lastId && <span className="fd-last">Last visited</span>}
                  <span className="fd-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="fd-globe-wrap" aria-label="Globe">
          {webgl === false ? (
            <p className="fd-globe-note">The interactive globe isn’t available in this browser. Choose your installation from the list.</p>
          ) : webgl ? (
            <Globe markers={markers} display={display} reducedMotion={reducedMotion} lastId={lastId} onSelect={select} apiRef={apiRef} />
          ) : null}
        </section>
      </main>
      <footer className="fd-footer">Prototype demo — not the official MCCS site.</footer>
    </div>
  );
}

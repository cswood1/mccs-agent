"use client";

import { useEffect, useRef, useState } from "react";
import { demoPath, mapHref, planText, type Plan } from "@/lib/chat-client";
import { write } from "./shared";

export type PlanKind = "arrival" | "workout";
export const PLAN_LABEL: Record<PlanKind, { icon: string; name: string }> = {
  arrival: { icon: "📋", name: "Arrival Plan" },
  workout: { icon: "💪", name: "Weekly Workout Plan" },
};

/** Checked items per plan (localStorage), keyed by base and a hash of the plan. */
const doneKey = (baseId: string, plan: Plan) => {
  let h = 0;
  for (const ch of JSON.stringify(plan)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return `mccs-front:plan:${baseId}:${(h >>> 0).toString(36)}`;
};

/**
 * A plan from plan mode: a right-side panel on desktop, a full-screen sheet on phones. Items are
 * checkboxes (remembered in localStorage); Print / Save as PDF and Copy.
 */
export function PlanPanel({
  plan,
  kind,
  baseId,
  baseName,
  location,
  onClose,
}: {
  plan: Plan;
  kind: PlanKind;
  baseId: string;
  baseName: string;
  location: string;
  onClose: () => void;
}) {
  const key = doneKey(baseId, plan);
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
      return {};
    }
  });
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Keep Tab inside the dialog.
      if (e.key === "Tab" && panelRef.current) {
        const f = [...panelRef.current.querySelectorAll<HTMLElement>("a[href], button, input")];
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("fd-plan-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("fd-plan-open");
    };
  }, [onClose]);

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    if (!next[id]) delete next[id];
    setDone(next);
    write(key, JSON.stringify(next));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(planText(plan, baseName));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  const total = plan.sections.reduce((n, s) => n + s.items.length, 0);
  const checked = Object.keys(done).length;
  const label = PLAN_LABEL[kind];

  return (
    <div className="fd-plan-layer">
      <div className="fd-plan-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className="fd-plan" role="dialog" aria-modal="true" aria-labelledby="fd-plan-title">
        <header className="fd-plan-head">
          <div>
            <p className="fd-label">
              <span aria-hidden="true">{label.icon}</span> {label.name}
            </p>
            <h2 id="fd-plan-title">{plan.title}</h2>
            <p className="fd-plan-base">
              {baseName} · {checked} of {total} done
            </p>
          </div>
          <button ref={closeRef} type="button" className="fd-icon-btn fd-plan-close" aria-label="Close plan" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="fd-plan-actions">
          <button type="button" className="fd-pill fd-small" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <button type="button" className="fd-pill fd-small" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="fd-sr" aria-live="polite">
            {copied ? "Plan copied" : ""}
          </span>
        </div>
        <div className="fd-plan-body">
          {plan.sections.map((s, si) => (
            <section key={si} className="fd-plan-section" aria-labelledby={`fd-plan-s${si}`}>
              <h3 id={`fd-plan-s${si}`}>{s.name}</h3>
              <ul>
                {s.items.map((it, ii) => {
                  const id = `${si}-${ii}`;
                  const local = it.sourceUrl ? demoPath(it.sourceUrl) : null;
                  return (
                    <li key={id} className={done[id] ? "is-done" : undefined}>
                      <input type="checkbox" id={`fd-plan-${id}`} checked={!!done[id]} onChange={() => toggle(id)} />
                      <div className="fd-plan-item">
                        <label htmlFor={`fd-plan-${id}`} className="fd-plan-task">
                          {it.task}
                        </label>
                        {it.detail && <p className="fd-plan-detail">{it.detail}</p>}
                        {(it.when || it.where || it.phone || it.sourceUrl || it.confirm) && (
                          <p className="fd-plan-meta">
                            {it.when && <span>{it.when}</span>}
                            {it.where && (
                              <a href={mapHref(it.where, location)} target="_blank" rel="noopener noreferrer">
                                {it.where}
                              </a>
                            )}
                            {it.phone && <a href={`tel:${it.phone.replace(/[^\d+]/g, "")}`}>{it.phone}</a>}
                            {it.sourceUrl && /^https?:\/\//.test(it.sourceUrl) && (
                              <a href={local ? local.local : it.sourceUrl} {...(local ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
                                Source
                              </a>
                            )}
                            {it.confirm && <span className="fd-plan-confirm">Call to confirm</span>}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <p className="fd-plan-note">From official MCCS pages. Hours and schedules change; check the source before you go.</p>
        </div>
      </div>
    </div>
  );
}

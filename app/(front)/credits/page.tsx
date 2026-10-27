import type { Metadata } from "next";
import Link from "next/link";
import { allCredits } from "../photos";
import "../front.css";

export const metadata: Metadata = { title: { absolute: "Photo credits · Ask MCCS (prototype demo)" } };

// Credits for the front door's photos (public/home/CREDITS.json): all U.S. government works in the
// public domain, from Wikimedia Commons.
export default function Credits() {
  return (
    <>
      <div className="demo-banner" role="note">
        <span className="demo-banner-full">NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo</span>
        <span className="demo-banner-short">NPS SI Hackathon · Team 2 · Prototype Demo</span>
      </div>
      <div className="fd fd--credits" data-theme="light" data-text="normal" data-contrast="normal">
        <main className="fd-main fd-credits">
          <p>
            <Link href="/">← Back to Ask MCCS</Link>
          </p>
          <h1>Photo credits</h1>
          <p className="fd-lead">
            All photos are U.S. Marine Corps photos, works of the U.S. government in the public domain, from Wikimedia Commons.
          </p>
          <ul className="fd-credit-list">
            {allCredits.map((c) => (
              <li key={c.file}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP */}
                <img src={c.file} alt="" loading="lazy" />
                <div>
                  <p className="fd-card-title">{c.alt}</p>
                  <p className="fd-card-blurb">
                    {c.author}, {c.organization} · {c.date} · {c.license} ({c.licenseTemplate})
                  </p>
                  <p className="fd-card-blurb">
                    <a href={c.source} target="_blank" rel="noopener noreferrer">
                      {c.title}
                    </a>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </main>
        <footer className="fd-footer">Prototype demo — not the official MCCS site.</footer>
      </div>
    </>
  );
}

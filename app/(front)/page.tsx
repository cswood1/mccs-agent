import type { Metadata } from "next";
import { COVERED_INSTALLATIONS } from "@/lib/crossbase";
import { getInstallation } from "@/lib/installations";
import { loadPage } from "@/lib/site/data";
import FrontDoor, { type FrontInstallation } from "./front-door";
import { photo } from "./photos";
import "./front.css";

export const metadata: Metadata = {
  title: { absolute: "Ask MCCS (prototype demo)" },
  description: "Prototype demo: ask MCCS anything about Quantico, Camp Pendleton or Camp Lejeune–New River. Not the official site.",
};

// The MCCS front door: one place to ask about any installation we cover (docs/PRODUCT.md §12).
// Installation details come from installations/*.json; the capture date from each home page;
// photos and their credits from public/home/CREDITS.json.
export default function Home() {
  const installations: FrontInstallation[] = COVERED_INSTALLATIONS.map((id) => getInstallation(id))
    .filter((i) => !!i)
    .map((i) => ({
      id: i.id,
      name: i.name,
      shortName: i.shortName,
      location: i.location,
      defaultChips: i.defaultChips,
      capturedOn: loadPage(i.id, "/")?.fetchedAt ?? "",
      hero: photo(`hero-${i.id}`),
      card: photo(`base-${i.id}`),
    }));

  return (
    <>
      <div className="demo-banner" role="note">
        <span className="demo-banner-full">NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo</span>
        <span className="demo-banner-short">NPS SI Hackathon · Team 2 · Prototype Demo</span>
      </div>
      <FrontDoor installations={installations} momentsPhoto={photo("moments")} />
    </>
  );
}

import type { Metadata } from "next";
import { frontInstallations, GLOBE_PLACES } from "./data";
import Explore from "./explore";
import "./front.css";

export const metadata: Metadata = {
  title: { absolute: "Explore your MCCS (prototype demo)" },
  description: "Prototype demo: choose your installation on the globe and ask MCCS anything. Not the official site.",
};

// Explore your MCCS: a globe to choose an installation, which opens its front door (/ask/<base>).
export default function Home() {
  const bases = frontInstallations().map((i) => ({ id: i.id, name: i.name, shortName: i.shortName, location: i.location, ...GLOBE_PLACES[i.id] }));
  return (
    <>
      <div className="demo-banner" role="note">
        <span className="demo-banner-full">NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo</span>
        <span className="demo-banner-short">NPS SI Hackathon · Team 2 · Prototype Demo</span>
      </div>
      <Explore bases={bases} />
    </>
  );
}

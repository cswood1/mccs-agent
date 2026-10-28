import type { Metadata } from "next";
import { SITE_INSTALLATIONS } from "@/lib/site/data";
import { frontInstallations, GLOBE_PLACES } from "./data";
import Explore from "./explore";
import type { GlobeMarker } from "./globe";
import "./front.css";

export const metadata: Metadata = {
  title: { absolute: "Explore your MCCS (prototype demo)" },
  description: "Prototype demo: choose your installation on the globe and ask MCCS anything. Not the official site.",
};

// Explore your MCCS: a globe to choose an installation, which opens its front door (/ask/<base>).
export default function Home() {
  // The list: the bases with a front door. The globe: every MCCS site; only those three are clickable.
  const front = frontInstallations();
  const bases = front.map((i) => ({ id: i.id, name: i.name, shortName: i.shortName, location: i.location }));
  const markers: GlobeMarker[] = SITE_INSTALLATIONS.filter((i) => GLOBE_PLACES[i.slug]).map((i) => {
    const fd = front.find((f) => f.id === i.slug);
    const place = GLOBE_PLACES[i.slug];
    return { id: i.slug, label: fd ? fd.shortName : i.name, lat: place.lat, lng: place.lng, dir: place.label ?? "right", clickable: !!fd };
  });
  return (
    <>
      <div className="demo-banner" role="note">
        <span className="demo-banner-full">NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo</span>
        <span className="demo-banner-short">NPS SI Hackathon · Team 2 · Prototype Demo</span>
      </div>
      <Explore bases={bases} markers={markers} />
    </>
  );
}

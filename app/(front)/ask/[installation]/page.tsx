import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { COVERED_INSTALLATIONS } from "@/lib/crossbase";
import { getInstallation } from "@/lib/installations";
import FrontDoor from "../../front-door";
import { frontInstallations } from "../../data";
import { CAROUSEL, photo, type Photo } from "../../photos";
import "../../front.css";

type Props = { params: Promise<{ installation: string }> };

export function generateStaticParams() {
  return COVERED_INSTALLATIONS.map((installation) => ({ installation }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const inst = getInstallation((await params).installation);
  return {
    title: { absolute: `Ask MCCS · ${inst?.shortName ?? "MCCS"} (prototype demo)` },
    description: "Prototype demo: ask MCCS anything, answered from official MCCS pages. Not the official site.",
  };
}

// A base's front door. The URL decides the base, so a refresh stays on it; an unknown base goes to
// the globe page.
export default async function AskInstallation({ params }: Props) {
  const { installation } = await params;
  if (!COVERED_INSTALLATIONS.includes(installation)) redirect("/");

  return (
    <>
      <div className="demo-banner" role="note">
        <span className="demo-banner-full">NPS SI Hackathon - MCCS Agent - Team 2 - Prototype Demo</span>
        <span className="demo-banner-short">NPS SI Hackathon · Team 2 · Prototype Demo</span>
      </div>
      <FrontDoor
        installationId={installation}
        installations={frontInstallations()}
        momentsPhoto={photo("moments")}
        carousel={CAROUSEL.map(photo).filter((p): p is Photo => !!p)}
      />
    </>
  );
}

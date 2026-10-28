import { COVERED_INSTALLATIONS } from "@/lib/crossbase";
import { getInstallation } from "@/lib/installations";
import { loadPage } from "@/lib/site/data";
import type { FrontInstallation } from "./front-door";
import { photo } from "./photos";

/** The covered bases, as the front door and the globe page need them (server only). */
export function frontInstallations(): FrontInstallation[] {
  return COVERED_INSTALLATIONS.map((id) => getInstallation(id))
    .filter((i) => !!i)
    .map((i) => ({
      id: i.id,
      name: i.name,
      shortName: i.shortName,
      location: i.location,
      defaultChips: i.defaultChips,
      capturedOn: loadPage(i.id, "/")?.fetchedAt ?? "",
      card: photo(`base-${i.id}`),
    }));
}

/**
 * Where each base sits on the globe (real coordinates of the main base area) and which way its label
 * points, so Quantico and Camp Lejeune (about 4° apart) don't overlap.
 */
export const GLOBE_PLACES: Record<string, { lat: number; lng: number; label: "left" | "right-up" | "right-down" }> = {
  quantico: { lat: 38.5228, lng: -77.3053, label: "right-up" },
  pendleton: { lat: 33.3305, lng: -117.3436, label: "left" },
  lejeune: { lat: 34.6774, lng: -77.3449, label: "right-down" },
};

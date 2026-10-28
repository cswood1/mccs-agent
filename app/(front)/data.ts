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
 * Where each MCCS site sits on the globe: the main base location, one marker per site in
 * site/installations.json (Camp Lejeune–New River is one). `label` is which way the label points;
 * only the three bases with a front door set it (so Quantico and Camp Lejeune, about 4° apart, don't
 * overlap). The recruiting regions are at their headquarters: Eastern at MCRD Parris Island,
 * Western at MCRD San Diego (the same spot as the San Diego site).
 */
export const GLOBE_PLACES: Record<string, { lat: number; lng: number; label?: "left-down" | "right-up" | "right-down" }> = {
  quantico: { lat: 38.5228, lng: -77.3053, label: "right-up" },
  pendleton: { lat: 33.3305, lng: -117.3436, label: "left-down" }, // below Hawaii's dot in the US view
  lejeune: { lat: 34.6774, lng: -77.3449, label: "right-down" },
  "29palms": { lat: 34.2367, lng: -116.0564 }, // MCAGCC Twentynine Palms
  "8thandi": { lat: 38.8798, lng: -76.9946 }, // Marine Barracks Washington
  albany: { lat: 31.548, lng: -84.056 }, // MCLB Albany
  barstow: { lat: 34.8656, lng: -116.98 }, // MCLB Barstow
  bridgeport: { lat: 38.356, lng: -119.518 }, // MCMWTC Bridgeport (Pickel Meadow)
  campfuji: { lat: 35.333, lng: 138.8836 }, // Camp Fuji, Gotemba, Shizuoka
  cherrypoint: { lat: 34.9008, lng: -76.8807 }, // MCAS Cherry Point
  err: { lat: 32.3433, lng: -80.6847 }, // Eastern Recruiting Region HQ, MCRD Parris Island
  hamptonroads: { lat: 36.923, lng: -76.283 }, // Camp Allen, Norfolk
  hawaii: { lat: 21.4436, lng: -157.75 }, // MCB Hawaii, Kaneohe Bay
  hendersonhall: { lat: 38.8686, lng: -77.0749 }, // Henderson Hall, Arlington
  iwakuni: { lat: 34.144, lng: 132.236 }, // MCAS Iwakuni
  miramar: { lat: 32.8684, lng: -117.1428 }, // MCAS Miramar
  mujuk: { lat: 36.02, lng: 129.343 }, // Camp Mujuk, Pohang
  okinawa: { lat: 26.2994, lng: 127.7731 }, // MCB Camp Butler, Camp Foster
  mcrd: { lat: 32.7406, lng: -117.195 }, // MCRD San Diego
  southcarolina: { lat: 32.4774, lng: -80.7231 }, // MCAS Beaufort
  wrr: { lat: 32.7406, lng: -117.195 }, // Western Recruiting Region HQ, MCRD San Diego
  yuma: { lat: 32.6566, lng: -114.606 }, // MCAS Yuma
};

import credits from "@/public/home/CREDITS.json";

/** A front-door photo with its alt text, credit and crop focus (public/home/CREDITS.json). */
export type Photo = { name: string; src: string; alt: string; credit: string; source: string; focus: string };

export function photo(name: string): Photo | null {
  const c = credits.photos.find((p) => p.file === `/home/${name}.webp`);
  if (!c) return null;
  // Short on-image credit; the full record is on /credits.
  return { name, src: c.file, alt: c.alt, credit: `Photo: ${c.author}, USMC`, source: c.source, focus: c.focus ?? "50% 50%" };
}

/**
 * Hero carousel: all seven front-door photos, interleaved so neighbours differ in base and scene
 * (Quantico trail run, Pendleton surf, Lejeune fun run, Quantico pool, Pendleton beach stage,
 * Lejeune music class, Pendleton mountains).
 */
export const CAROUSEL = ["hero-quantico", "base-pendleton", "hero-lejeune", "base-quantico", "moments", "base-lejeune", "hero-pendleton"];

export const allCredits = credits.photos;

import credits from "@/public/home/CREDITS.json";

/** A front-door photo with its alt text and credit (public/home/CREDITS.json). */
export type Photo = { src: string; alt: string; credit: string; source: string; focus?: string };

// Where to keep the subject when a photo is cropped (CSS object-position).
const FOCUS: Record<string, string> = {
  "hero-quantico": "55% 50%",
  "hero-pendleton": "50% 40%",
  "hero-lejeune": "45% 45%",
};

export function photo(name: string): Photo | null {
  const c = credits.photos.find((p) => p.file === `/home/${name}.webp`);
  if (!c) return null;
  // Short on-image credit; the full record is on /credits.
  return { src: c.file, alt: c.alt, credit: `Photo: ${c.author}, USMC`, source: c.source, focus: FOCUS[name] };
}

export const allCredits = credits.photos;

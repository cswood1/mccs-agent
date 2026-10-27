import { readFile } from "node:fs/promises";
import path from "node:path";
import lejeune from "@/installations/lejeune.json";
import pendleton from "@/installations/pendleton.json";
import quantico from "@/installations/quantico.json";

/** Per-installation settings. One JSON file per base in /installations. */
export type InstallationConfig = {
  id: string;
  /** Site name as shown to users, e.g. "MCCS Quantico". */
  name: string;
  /** Display-only short name for the panel subtitle, e.g. "MCB Quantico" (docs/PRODUCT.md §13).
   *  Never used in the system prompt, so changing it doesn't rewrite the prompt cache. */
  shortName: string;
  installationName: string;
  assistantName: string;
  siteUrl: string;
  location: string;
  /** Short background on the base and its local area, injected into the system prompt. */
  localContext: string;
  welcomeMessage: string;
  /** Home page / default chips (docs/PRODUCT.md §6); the widget shows the first 4. */
  defaultChips: string[];
  /** Show the nudge bubble on non-home pages (docs/PRODUCT.md §5). */
  nudge: boolean;
  /**
   * The only domains the agent's live web_fetch / web_search may reach: the installation
   * site plus official sites for education/benefits questions. Plain hostnames; subdomains
   * are included automatically.
   */
  trustedDomains: string[];
  theme: { primary: string; accent: string };
};

export type ContentPage = {
  url: string;
  title: string;
  /** When the HTML was saved from the live site (ISO date). */
  savedAt?: string;
  /** Clean markdown-ish text of the page body. */
  text: string;
};

export type InstallationContent = {
  installationId: string;
  /** True for the placeholder file in data/sample — never real MCCS data. */
  sample: boolean;
  generatedAt: string;
  pages: ContentPage[];
};

const installations: Record<string, InstallationConfig> = {
  [quantico.id]: quantico,
  [pendleton.id]: pendleton,
  [lejeune.id]: lejeune,
};

export function getInstallation(id: string): InstallationConfig | undefined {
  return Object.hasOwn(installations, id) ? installations[id] : undefined;
}

/**
 * Real content (data/content/<id>.json, produced by `npm run build:content`) wins; otherwise the
 * sample placeholder if there is one. Null when an installation has no content yet.
 */
export async function loadContent(id: string): Promise<InstallationContent | null> {
  for (const dir of ["content", "sample"]) {
    try {
      const raw = await readFile(path.join(process.cwd(), "data", dir, `${id}.json`), "utf8");
      return JSON.parse(raw) as InstallationContent;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return null;
}

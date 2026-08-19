import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const instructionsDir = path.join(import.meta.dirname, "..", "instructions");

export const SECTIONS = [
  "escalate-ambiguity",
  "executable-reasoning",
  "yagni",
  "craftsmanship",
  "progressive-disclosure",
  "ste100",
] as const;

export type Section = (typeof SECTIONS)[number];

const sectionText: Record<Section, string> = Object.fromEntries(
  SECTIONS.map((name) => [
    name,
    fs.readFileSync(path.join(instructionsDir, `${name}.md`), "utf-8").trim(),
  ]),
) as Record<Section, string>;

export function loadSection(name: Section): string {
  return sectionText[name];
}

export function parseSelection(value: string | undefined): Section[] | null {
  if (value === undefined) {
    return null;
  }
  const raw = value.trim().toLowerCase();
  if (raw === "") {
    return null;
  }
  if (raw === "off" || raw === "none") {
    return [];
  }

  const known = new Set<string>(SECTIONS);
  const included: Section[] = [];
  const excluded = new Set<Section>();
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const name = part.trim();
    const excludedName = name.startsWith("-") ? name.slice(1) : undefined;
    if (excludedName && known.has(excludedName)) {
      excluded.add(excludedName as Section);
    } else if (name && !seen.has(name) && known.has(name)) {
      seen.add(name);
      included.push(name as Section);
    }
  }
  if (included.length === 0 && excluded.size === 0) {
    return null;
  }
  const selected = included.length > 0 ? included : SECTIONS;
  return selected.filter((name) => !excluded.has(name));
}

export function getSelection(pi: ExtensionAPI): Section[] {
  const flag = pi.getFlag("pi-steer");

  return (
    parseSelection(typeof flag === "string" ? flag : undefined) ??
    parseSelection(process.env.PI_STEER) ?? [...SECTIONS]
  );
}

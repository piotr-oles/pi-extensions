import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const instructionsDir = path.join(import.meta.dirname, "..", "instructions");

export const SECTIONS = [
  "think-in-code",
  "parallel-calls",
  "ask-dont-assume",
  "attention-to-quality",
  "top-down-code-layout",
  "commands",
  "technical-writing",
] as const;

export type Section = (typeof SECTIONS)[number];

const sectionText: Record<string, string> = Object.fromEntries(
  SECTIONS.map((name) => [
    name,
    fs.readFileSync(path.join(instructionsDir, `${name}.md`), "utf-8").trim(),
  ]),
);

export function loadSection(name: string): string | undefined {
  return sectionText[name];
}

export type Selection = { off: boolean; names: Section[] };

export function parseSelection(value: string | undefined): Selection | null {
  if (value === undefined) {
    return null;
  }
  const raw = value.trim().toLowerCase();
  if (raw === "") {
    return null;
  }
  if (raw === "off" || raw === "none") {
    return { off: true, names: [] };
  }

  const known = new Set<string>(SECTIONS);
  const names: Section[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (!name || seen.has(name) || !known.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name as Section);
  }
  if (names.length === 0) {
    return null;
  }
  return { off: false, names };
}

export function getSelection(pi: ExtensionAPI): Selection {
  return (
    parseSelection(
      typeof pi.getFlag("pi-steer") === "string" ? (pi.getFlag("pi-steer") as string) : undefined,
    ) ??
    parseSelection(process.env.PI_STEER) ?? {
      off: false,
      names: [...SECTIONS],
    }
  );
}

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSection, parseSelection, SECTIONS } from "./sections.js";

describe("instruction files", () => {
  it("one .md per declared section, no orphans", () => {
    const files = readdirSync(join(import.meta.dirname, "../instructions"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3))
      .sort();
    expect(files).toEqual([...SECTIONS].sort());
  });

  it.each(SECTIONS)("%s.md loads and starts with its header line", (name) => {
    const content = readFileSync(join(import.meta.dirname, `../instructions/${name}.md`), "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
    expect(loadSection(name)?.split("\n")[0]?.endsWith(":")).toBe(true);
  });
});

describe("parseSelection", () => {
  it("off / none disables", () => {
    expect(parseSelection("off")).toEqual({ off: true, names: [] });
    expect(parseSelection("none")).toEqual({ off: true, names: [] });
  });

  it("comma list selects subset in given order", () => {
    expect(parseSelection("commands,think-in-code")).toEqual({
      off: false,
      names: ["commands", "think-in-code"],
    });
  });

  it("dedupes and drops unknown names", () => {
    expect(parseSelection("commands,commands,bogus")).toEqual({
      off: false,
      names: ["commands"],
    });
  });

  it("empty / all-unknown returns null (fall through)", () => {
    expect(parseSelection("")).toBeNull();
    expect(parseSelection("bogus")).toBeNull();
    expect(parseSelection(undefined)).toBeNull();
  });
});

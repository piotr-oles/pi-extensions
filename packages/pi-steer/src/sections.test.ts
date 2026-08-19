import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSection, parseSelection, SECTIONS } from "./sections.js";

describe("loadSection", () => {
  it("has one .md per declared section and no orphans", () => {
    const files = readdirSync(join(import.meta.dirname, "../instructions"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -3))
      .sort();
    expect(files).toEqual([...SECTIONS].sort());
  });

  it.each(SECTIONS)("%s.md loads and starts with its header line", (name) => {
    const content = readFileSync(join(import.meta.dirname, `../instructions/${name}.md`), "utf-8");
    expect(content.trim().length).toBeGreaterThan(0);
    expect(loadSection(name).split("\n")[0]?.endsWith(":")).toBe(true);
  });
});

describe("parseSelection", () => {
  it("off / none disables", () => {
    expect(parseSelection("off")).toEqual([]);
    expect(parseSelection("none")).toEqual([]);
  });

  it("comma list selects subset in given order", () => {
    expect(parseSelection("ste100,executable-reasoning")).toEqual([
      "ste100",
      "executable-reasoning",
    ]);
  });

  it("exclusion starts with all sections and removes named sections", () => {
    expect(parseSelection("-craftsmanship")).toEqual(
      SECTIONS.filter((name) => name !== "craftsmanship"),
    );
  });

  it("exclusion removes sections from an explicit selection", () => {
    expect(parseSelection("craftsmanship,ste100,-craftsmanship")).toEqual(["ste100"]);
  });

  it("dedupes and drops unknown names", () => {
    expect(parseSelection("ste100,ste100,bogus")).toEqual(["ste100"]);
  });

  it("empty / all-unknown returns null (fall through)", () => {
    expect(parseSelection("")).toBeNull();
    expect(parseSelection("bogus")).toBeNull();
    expect(parseSelection(undefined)).toBeNull();
  });
});

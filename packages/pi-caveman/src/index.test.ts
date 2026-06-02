import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLevel } from "./level.js";

describe("instruction files", () => {
  it.each(["lite", "full", "ultra"])("%s.md loads and starts with IMPORTANT directive", (level) => {
    const content = readFileSync(join(import.meta.dirname, `../instructions/${level}.md`), "utf-8");
    expect(content).toContain("IMPORTANT:");
  });
});

describe("parseLevel", () => {
  it.each(["off", "lite", "full", "ultra"])("parses '%s'", (level) => {
    expect(parseLevel(level)).toBe(level);
  });

  it("returns null for unknown values", () => {
    expect(parseLevel("extreme")).toBeNull();
    expect(parseLevel("")).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
  });
});

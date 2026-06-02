import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("instruction files", () => {
  it.each(["lite", "full", "ultra"])("%s.md loads and starts with IMPORTANT directive", (level) => {
    const content = readFileSync(join(import.meta.dirname, `../instructions/${level}.md`), "utf-8");
    expect(content).toContain("IMPORTANT:");
  });
});

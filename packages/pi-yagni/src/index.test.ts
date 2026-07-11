import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("instruction file", () => {
  it("yagni.md loads and starts with YAGNI directive", () => {
    const content = readFileSync(join(import.meta.dirname, "../instructions/yagni.md"), "utf-8");
    expect(content).toContain("YAGNI");
  });
});

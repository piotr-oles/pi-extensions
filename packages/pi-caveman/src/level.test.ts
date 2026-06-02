import { describe, expect, it } from "vitest";
import { parseLevel } from "./level.js";

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

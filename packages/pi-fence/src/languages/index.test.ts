import { describe, expect, it } from "vitest";
import { getLanguageDefinition } from "./index.js";

describe("getLanguageDefinition", () => {
  it("returns undefined for unsupported extensions", () => {
    expect(getLanguageDefinition("src/template.html")).toBeUndefined();
    expect(getLanguageDefinition("data.json")).toBeUndefined();
  });
});

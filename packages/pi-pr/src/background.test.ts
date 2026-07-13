import { describe, expect, it } from "vitest";
import { detectBackground } from "./background.js";

describe("detectBackground", () => {
  it("defaults to dark when COLORFGBG is unset or empty", () => {
    expect(detectBackground({})).toBe("dark");
    expect(detectBackground({ COLORFGBG: "" })).toBe("dark");
  });

  it("reads the background field of fg;bg", () => {
    expect(detectBackground({ COLORFGBG: "15;0" })).toBe("dark");
    expect(detectBackground({ COLORFGBG: "0;15" })).toBe("light");
  });

  it("reads the last field of fg;aux;bg", () => {
    expect(detectBackground({ COLORFGBG: "0;default;15" })).toBe("light");
    expect(detectBackground({ COLORFGBG: "15;default;0" })).toBe("dark");
  });

  it("treats 7 and 9-15 as light, 0-6 and 8 as dark", () => {
    expect(detectBackground({ COLORFGBG: "0;7" })).toBe("light");
    expect(detectBackground({ COLORFGBG: "0;8" })).toBe("dark");
    expect(detectBackground({ COLORFGBG: "0;6" })).toBe("dark");
    expect(detectBackground({ COLORFGBG: "0;9" })).toBe("light");
  });

  it("falls back to dark on unparseable background", () => {
    expect(detectBackground({ COLORFGBG: "15;default" })).toBe("dark");
    expect(detectBackground({ COLORFGBG: "nonsense" })).toBe("dark");
  });
});

import { describe, expect, it } from "vitest";
import {
  BASH_DEFAULT_TIMEOUT_SECONDS,
  BASH_MAX_TIMEOUT_SECONDS,
  buildBashTimeoutPrompt,
  DEFAULT_TIMEOUT_ENV,
  MAX_TIMEOUT_ENV,
  resolveBashTimeoutDefaults,
} from "./timeout.js";

describe("resolveBashTimeoutDefaults", () => {
  it("returns built-in constants when no flag or env is set", () => {
    const result = resolveBashTimeoutDefaults({}, {});
    expect(result).toEqual({
      defaultSeconds: BASH_DEFAULT_TIMEOUT_SECONDS,
      maxSeconds: BASH_MAX_TIMEOUT_SECONDS,
    });
  });

  it("uses env vars when no flag is set", () => {
    const result = resolveBashTimeoutDefaults(
      {},
      { [DEFAULT_TIMEOUT_ENV]: "30", [MAX_TIMEOUT_ENV]: "900" },
    );
    expect(result).toEqual({ defaultSeconds: 30, maxSeconds: 900 });
  });

  it("prefers flag over env (flag > env precedence)", () => {
    const result = resolveBashTimeoutDefaults(
      { default: "45", max: "300" },
      { [DEFAULT_TIMEOUT_ENV]: "30", [MAX_TIMEOUT_ENV]: "900" },
    );
    expect(result).toEqual({ defaultSeconds: 45, maxSeconds: 300 });
  });

  it("falls through to env when a flag value is invalid", () => {
    const result = resolveBashTimeoutDefaults(
      { default: "garbage", max: "0" },
      { [DEFAULT_TIMEOUT_ENV]: "30", [MAX_TIMEOUT_ENV]: "900" },
    );
    expect(result).toEqual({ defaultSeconds: 30, maxSeconds: 900 });
  });

  it("ignores invalid env values and falls back to built-in", () => {
    const garbage = resolveBashTimeoutDefaults({}, { [DEFAULT_TIMEOUT_ENV]: "garbage" });
    const zero = resolveBashTimeoutDefaults({}, { [DEFAULT_TIMEOUT_ENV]: "0" });
    const negative = resolveBashTimeoutDefaults({}, { [MAX_TIMEOUT_ENV]: "-1" });
    expect(garbage.defaultSeconds).toBe(BASH_DEFAULT_TIMEOUT_SECONDS);
    expect(zero.defaultSeconds).toBe(BASH_DEFAULT_TIMEOUT_SECONDS);
    expect(negative.maxSeconds).toBe(BASH_MAX_TIMEOUT_SECONDS);
  });

  it("ignores boolean flag values", () => {
    const result = resolveBashTimeoutDefaults({ default: true, max: false }, {});
    expect(result).toEqual({
      defaultSeconds: BASH_DEFAULT_TIMEOUT_SECONDS,
      maxSeconds: BASH_MAX_TIMEOUT_SECONDS,
    });
  });

  it("raises max up to default when max is lower", () => {
    const result = resolveBashTimeoutDefaults({ default: "500", max: "100" }, {});
    expect(result).toEqual({ defaultSeconds: 500, maxSeconds: 500 });
  });
});

describe("buildBashTimeoutPrompt", () => {
  it("labels minute-aligned values in minutes", () => {
    const prompt = buildBashTimeoutPrompt({ defaultSeconds: 120, maxSeconds: 600 });
    expect(prompt).toContain("Default timeout: 120s (2 min)");
    expect(prompt).toContain("Recommended maximum timeout: 600s (10 min)");
  });

  it("falls back to seconds labels for non-minute-aligned values", () => {
    const prompt = buildBashTimeoutPrompt({ defaultSeconds: 45, maxSeconds: 90 });
    expect(prompt).toContain("Default timeout: 45s (45s)");
    expect(prompt).toContain("Recommended maximum timeout: 90s (90s)");
  });

  it("states max is advisory and includes long-running guidance", () => {
    const prompt = buildBashTimeoutPrompt({ defaultSeconds: 120, maxSeconds: 600 });
    expect(prompt).toMatch(/advisory guidance, not a hard cap/);
    expect(prompt).toMatch(/long-running commands/i);
    expect(prompt).toContain("tmux");
  });
});

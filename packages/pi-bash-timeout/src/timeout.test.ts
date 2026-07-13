import { describe, expect, it } from "vitest";
import {
  BASH_DEFAULT_TIMEOUT_SECONDS,
  BASH_MAX_TIMEOUT_SECONDS,
  buildBashTimeoutPrompt,
  DEFAULT_TIMEOUT_ENV,
  MAX_TIMEOUT_ENV,
  resolveBashTimeoutConfig,
} from "./timeout.js";

describe("resolveBashTimeoutDefaults", () => {
  it("returns built-in constants when no flag or env is set", () => {
    const result = resolveBashTimeoutConfig({}, {});
    expect(result).toEqual({
      defaultSeconds: BASH_DEFAULT_TIMEOUT_SECONDS,
      maxSeconds: BASH_MAX_TIMEOUT_SECONDS,
    });
  });

  it("uses env vars when no flag is set", () => {
    const result = resolveBashTimeoutConfig(
      {},
      { [DEFAULT_TIMEOUT_ENV]: "30", [MAX_TIMEOUT_ENV]: "900" },
    );
    expect(result).toEqual({ defaultSeconds: 30, maxSeconds: 900 });
  });

  it("prefers flag over env (flag > env precedence)", () => {
    const result = resolveBashTimeoutConfig(
      { default: "45", max: "300" },
      { [DEFAULT_TIMEOUT_ENV]: "30", [MAX_TIMEOUT_ENV]: "900" },
    );
    expect(result).toEqual({ defaultSeconds: 45, maxSeconds: 300 });
  });

  it("falls through to env when a flag value is invalid", () => {
    const result = resolveBashTimeoutConfig(
      { default: "garbage", max: "0" },
      { [DEFAULT_TIMEOUT_ENV]: "30", [MAX_TIMEOUT_ENV]: "900" },
    );
    expect(result).toEqual({ defaultSeconds: 30, maxSeconds: 900 });
  });

  it("ignores invalid env values and falls back to built-in", () => {
    const garbage = resolveBashTimeoutConfig({}, { [DEFAULT_TIMEOUT_ENV]: "garbage" });
    const zero = resolveBashTimeoutConfig({}, { [DEFAULT_TIMEOUT_ENV]: "0" });
    const negative = resolveBashTimeoutConfig({}, { [MAX_TIMEOUT_ENV]: "-1" });
    expect(garbage.defaultSeconds).toBe(BASH_DEFAULT_TIMEOUT_SECONDS);
    expect(zero.defaultSeconds).toBe(BASH_DEFAULT_TIMEOUT_SECONDS);
    expect(negative.maxSeconds).toBe(BASH_MAX_TIMEOUT_SECONDS);
  });

  it("ignores boolean flag values", () => {
    const result = resolveBashTimeoutConfig({ default: true, max: false }, {});
    expect(result).toEqual({
      defaultSeconds: BASH_DEFAULT_TIMEOUT_SECONDS,
      maxSeconds: BASH_MAX_TIMEOUT_SECONDS,
    });
  });

  it("raises max up to default when max is lower", () => {
    const result = resolveBashTimeoutConfig({ default: "500", max: "100" }, {});
    expect(result).toEqual({ defaultSeconds: 500, maxSeconds: 500 });
  });
});

describe("buildBashTimeoutPrompt", () => {
  it("includes configured default and maximum values", () => {
    const prompt = buildBashTimeoutPrompt({ defaultSeconds: 120, maxSeconds: 600 });
    expect(prompt).toContain("Default timeout: 120s");
    expect(prompt).toContain("Maximum timeout: 600s");
  });

  it("states that values above the maximum are capped", () => {
    const prompt = buildBashTimeoutPrompt({ defaultSeconds: 120, maxSeconds: 600 });
    expect(prompt).toContain("Larger values are capped automatically");
  });

  it("includes long-running command guidance", () => {
    const prompt = buildBashTimeoutPrompt({ defaultSeconds: 120, maxSeconds: 600 });
    expect(prompt).toMatch(/long-running commands/i);
    expect(prompt).toContain("tmux");
  });
});

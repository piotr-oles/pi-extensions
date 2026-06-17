import { describe, expect, it } from "vitest";
import { formatDuration, formatSi, formatUsage } from "./format.js";

describe("formatUsage", () => {
  it("returns plain number for zero tokens", () => {
    expect(formatUsage({ tokens: 0, contextWindow: 0, percent: null })).toBe("0");
  });

  it("formats counts below 1000 as plain numbers", () => {
    expect(formatUsage({ tokens: 300, contextWindow: 0, percent: null })).toBe("300");
  });

  it("formats counts >= 1000 with K suffix", () => {
    expect(formatUsage({ tokens: 10_000, contextWindow: 0, percent: null })).toBe("10.0K");
  });

  it("includes context percentage when percent is set", () => {
    expect(formatUsage({ tokens: 999, contextWindow: 3996, percent: 25 })).toBe("999 (25.0%)");
  });

  it("omits percentage when percent is 0", () => {
    expect(formatUsage({ tokens: 500, contextWindow: 0, percent: 0 })).toBe("500");
  });

  it("omits percentage when percent is null", () => {
    expect(formatUsage({ tokens: 500, contextWindow: 0, percent: null })).toBe("500");
  });

  it("formats percentage with one decimal place", () => {
    expect(formatUsage({ tokens: 1, contextWindow: 3, percent: 33.3 })).toBe("1 (33.3%)");
  });
});

describe("formatSi", () => {
  it("returns plain number below 1000", () => {
    expect(formatSi(0)).toBe("0");
    expect(formatSi(1)).toBe("1");
    expect(formatSi(999)).toBe("999");
  });

  it("formats thousands as K", () => {
    expect(formatSi(1_000)).toBe("1.0K");
    expect(formatSi(1_400)).toBe("1.4K");
    expect(formatSi(999_999)).toBe("1000.0K");
  });

  it("formats millions as M", () => {
    expect(formatSi(1_000_000)).toBe("1.0M");
    expect(formatSi(1_200_000)).toBe("1.2M");
  });

  it("formats billions as G", () => {
    expect(formatSi(5_300_000_000)).toBe("5.3G");
  });

  it("formats trillions as T", () => {
    expect(formatSi(1e12)).toBe("1.0T");
  });

  it("formats peta as P", () => {
    expect(formatSi(1e15)).toBe("1.0P");
  });

  it("formats exa as E", () => {
    expect(formatSi(1e18)).toBe("1.0E");
  });

  it("respects custom precision", () => {
    expect(formatSi(1_234, 2)).toBe("1.23K");
    expect(formatSi(1_234, 0)).toBe("1K");
  });

  it("handles negative numbers", () => {
    expect(formatSi(-1_400)).toBe("-1.4K");
    expect(formatSi(-500)).toBe("-500");
  });
});

describe("formatDuration", () => {
  it("formats zero as 0.0s", () => {
    expect(formatDuration(0)).toBe("0.0s");
  });

  it("formats sub-minute durations in seconds", () => {
    expect(formatDuration(1500)).toBe("1.5s");
    expect(formatDuration(30000)).toBe("30.0s");
  });

  it("formats exactly 60 seconds as 1m0s", () => {
    expect(formatDuration(60_000)).toBe("1m0s");
  });

  it("formats minute+ durations as MmSs", () => {
    expect(formatDuration(90_000)).toBe("1m30s");
    expect(formatDuration(125_000)).toBe("2m5s");
  });

  it("handles large durations correctly", () => {
    expect(formatDuration(3_661_000)).toBe("61m1s");
  });
});

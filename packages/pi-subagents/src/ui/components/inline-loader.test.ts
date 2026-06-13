import type { TUI } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InlineLoader } from "./inline-loader.js";

const mockTui = { requestRender: vi.fn() } as unknown as TUI;

function render(loader: InlineLoader): string {
  return stripAnsi(loader.render(80).join("\n"));
}

describe("InlineLoader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders spinner frame on initial render", () => {
    const loader = new InlineLoader(mockTui, (s) => s);
    expect(render(loader)).toMatchInlineSnapshot(`"⠋"`);
    loader.stop();
  });

  it("renders trimmed output (no leading or trailing whitespace)", () => {
    const loader = new InlineLoader(mockTui, (s) => s);
    const lines = loader.render(80);
    for (const line of lines) {
      expect(stripAnsi(line)).toBe(stripAnsi(line).trim());
    }
    loader.stop();
  });

  it("filters out blank lines from output", () => {
    const loader = new InlineLoader(mockTui, (s) => s);
    const lines = loader.render(80);
    for (const line of lines) {
      expect(stripAnsi(line).trim()).not.toBe("");
    }
    loader.stop();
  });

  it("advances spinner frame as time passes after start()", () => {
    const loader = new InlineLoader(mockTui, (s) => s);
    loader.start();
    expect(render(loader)).toMatchInlineSnapshot(`"⠋"`);
    vi.advanceTimersByTime(80);
    expect(render(loader)).toMatchInlineSnapshot(`"⠙"`);
    loader.stop();
  });

  it("stops animation after stop()", () => {
    const loader = new InlineLoader(mockTui, (s) => s);
    loader.start();
    vi.advanceTimersByTime(80);
    const frameBefore = render(loader);
    loader.stop();
    vi.advanceTimersByTime(500);
    expect(render(loader)).toBe(frameBefore);
  });

  it("applies spinnerColorFn to the spinner", () => {
    const colored = (s: string) => `\x1b[32m${s}\x1b[0m`;
    const loader = new InlineLoader(mockTui, colored);
    const raw = loader.render(80)[0];
    expect(raw).toContain("\x1b[32m");
    loader.stop();
  });

  it("does not throw after invalidate()", () => {
    const loader = new InlineLoader(mockTui, (s) => s);
    loader.invalidate();
    expect(() => render(loader)).not.toThrow();
    loader.stop();
  });
});

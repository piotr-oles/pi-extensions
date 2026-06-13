import type { Component } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { describe, expect, it, vi } from "vitest";
import { InlineContainer } from "./inline-container.js";

function makeComponent(text: string): Component {
  return {
    render: (_width: number) => [text],
    invalidate: vi.fn(),
  };
}

function makeMultiLineComponent(lines: string[]): Component {
  return {
    render: (_width: number) => lines,
    invalidate: vi.fn(),
  };
}

function makeEmptyComponent(): Component {
  return {
    render: (_width: number) => [],
    invalidate: vi.fn(),
  };
}

describe("InlineContainer", () => {
  it("renders empty string when no children", () => {
    const container = new InlineContainer();
    expect(container.render(80)).toEqual([""]);
  });

  it("renders single child trimmed", () => {
    const container = new InlineContainer();
    container.addChild(makeComponent("  hello  "));
    expect(container.render(80)).toEqual(["hello"]);
  });

  it("renders multiple children joined with default gap (space)", () => {
    const container = new InlineContainer();
    container.addChild(makeComponent("foo"));
    container.addChild(makeComponent("bar"));
    container.addChild(makeComponent("baz"));
    expect(container.render(80)).toEqual(["foo bar baz"]);
  });

  it("renders children joined with custom gap", () => {
    const container = new InlineContainer(" · ");
    container.addChild(makeComponent("foo"));
    container.addChild(makeComponent("bar"));
    expect(container.render(80)).toEqual(["foo · bar"]);
  });

  it("skips children that render empty array", () => {
    const container = new InlineContainer();
    container.addChild(makeEmptyComponent());
    container.addChild(makeComponent("visible"));
    container.addChild(makeEmptyComponent());
    expect(container.render(80)).toEqual(["visible"]);
  });

  it("truncates output to given width", () => {
    const container = new InlineContainer();
    container.addChild(makeComponent("hello world"));
    expect(stripAnsi(container.render(5)[0])).toMatchInlineSnapshot(`"he..."`)
  });

  it("stops adding children once width is exhausted", () => {
    const container = new InlineContainer(" ");
    container.addChild(makeComponent("12345"));
    container.addChild(makeComponent("67890"));
    container.addChild(makeComponent("never"));
    // width 11 = "12345 67890" exactly, "never" gets cut
    expect(container.render(11)).toEqual(["12345 67890"]);
  });

  it("throws when a child renders multiple lines", () => {
    const container = new InlineContainer();
    container.addChild(makeMultiLineComponent(["line one", "line two"]));
    expect(() => container.render(80)).toThrow(/multi-line/i);
  });

  it("throws when a child renders a line containing newline character", () => {
    const container = new InlineContainer();
    container.addChild(makeComponent("line\nnewline"));
    expect(() => container.render(80)).toThrow(/multi-line/i);
  });

  it("removes a child after removeChild()", () => {
    const container = new InlineContainer();
    const child = makeComponent("gone");
    container.addChild(makeComponent("stays"));
    container.addChild(child);
    container.removeChild(child);
    expect(container.render(80)).toEqual(["stays"]);
  });

  it("passes remaining width to each child", () => {
    const widths: number[] = [];
    const trackingComponent = (text: string): Component => ({
      render: (w: number) => {
        widths.push(w);
        return [text];
      },
      invalidate: vi.fn(),
    });
    const container = new InlineContainer(" ");
    container.addChild(trackingComponent("abc"));
    container.addChild(trackingComponent("de"));
    container.render(20);
    expect(widths[0]).toBe(20);
    expect(widths[1]).toBe(20 - "abc ".length);
  });

  it("does not throw after invalidate()", () => {
    const container = new InlineContainer();
    container.addChild(makeComponent("ok"));
    container.invalidate();
    expect(container.render(80)).toEqual(["ok"]);
  });
});

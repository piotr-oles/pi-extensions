import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import type { ReviewComment } from "../types";
import { useTextHighlighter } from "./useTextHighlighter";

function makeComment(id: string, quote: string): ReviewComment {
  return {
    id,
    quote,
    comment: "a comment",
    timestamp: "2024-01-01T00:00:00.000Z",
    sent: false,
    error: false,
  };
}

function makeContainerWithText(text: string): HTMLDivElement {
  const div = document.createElement("div");
  div.textContent = text;
  document.body.appendChild(div);
  return div;
}

describe("useTextHighlighter", () => {
  it("does nothing when contentRef is null", () => {
    renderHook(() => {
      const ref = useRef<HTMLElement>(null);
      useTextHighlighter(ref, []);
    });
    expect(true).toBe(true);
  });

  it("wraps found quote in mark element", () => {
    const container = makeContainerWithText("Hello world this is text");

    renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      useTextHighlighter(ref, [makeComment("c1", "world")]);
    });

    const marks = container.querySelectorAll("mark[data-comment-id]");
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0]?.getAttribute("data-comment-id")).toBe("c1");
  });

  it("does not add marks for unknown quotes", () => {
    const container = makeContainerWithText("Hello world");

    renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      useTextHighlighter(ref, [makeComment("c1", "xyz missing text")]);
    });

    const marks = container.querySelectorAll("mark[data-comment-id]");
    expect(marks.length).toBe(0);
  });

  it("wraps cross-element selection in multiple mark elements", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>foo <em>bar</em> baz</p>";
    document.body.appendChild(container);

    renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      useTextHighlighter(ref, [makeComment("cross", "foo bar")]);
    });

    const marks = container.querySelectorAll("mark[data-comment-id='cross']");
    expect(marks.length).toBe(2);
    expect(
      Array.from(marks)
        .map((m) => m.textContent)
        .join(""),
    ).toBe("foo bar");
  });

  it("removes existing marks before re-anchoring", () => {
    const container = makeContainerWithText("Test content here");

    const { rerender } = renderHook(
      ({ comments }: { comments: ReviewComment[] }) => {
        const ref = useRef<HTMLElement>(container);
        useTextHighlighter(ref, comments);
      },
      { initialProps: { comments: [makeComment("c1", "Test")] } },
    );

    expect(container.querySelectorAll("mark").length).toBeGreaterThan(0);

    rerender({ comments: [] });

    expect(container.querySelectorAll("mark").length).toBe(0);
  });
});

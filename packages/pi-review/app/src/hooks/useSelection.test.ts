import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectionInfo } from "../types";
import { useSelection } from "./useSelection";

function makeContainer(): HTMLDivElement {
  const div = document.createElement("div");
  div.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  });
  document.body.appendChild(div);
  return div;
}

describe("useSelection", () => {
  let container: HTMLDivElement;
  let onSelect: (info: SelectionInfo | null) => void;

  beforeEach(() => {
    container = makeContainer();
    onSelect = vi.fn<(info: SelectionInfo | null) => void>();
    window.getSelection()?.removeAllRanges();
  });

  it("returns null on collapsed selection", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useSelection(ref, onSelect);
    });
    result.current.handleMouseUp();
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("returns null for short selection (< 2 chars)", () => {
    const text = document.createTextNode("x");
    container.appendChild(text);

    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    window.getSelection()?.addRange(range);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useSelection(ref, onSelect);
    });
    result.current.handleMouseUp();
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("returns SelectionInfo for valid selection inside container", () => {
    const text = document.createTextNode("Hello world selection");
    container.appendChild(text);

    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 11);
    range.getBoundingClientRect = () => ({
      left: 50,
      top: 10,
      right: 100,
      bottom: 20,
      width: 50,
      height: 10,
      x: 50,
      y: 10,
      toJSON() {
        return {};
      },
    });
    window.getSelection()?.addRange(range);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement>(container);
      return useSelection(ref, onSelect);
    });
    result.current.handleMouseUp();

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ quote: "world" }));
  });
});

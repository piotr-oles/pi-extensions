import type { RefObject } from "react";
import { useCallback } from "react";
import type { SelectionInfo } from "../types";

const MIN_SELECTION_LENGTH = 2;

export function useSelection(
  containerRef: RefObject<HTMLElement | null>,
  onSelect: (info: SelectionInfo | null) => void,
) {
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      onSelect(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH) {
      onSelect(null);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      onSelect(null);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      onSelect(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;

    const relativeRect = new DOMRect(
      rect.left - containerRect.left,
      rect.top - containerRect.top + scrollTop,
      rect.width,
      rect.height,
    );

    onSelect({ quote: text, rect: relativeRect });
  }, [containerRef, onSelect]);

  return { handleMouseUp };
}

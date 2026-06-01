import type { RefObject } from "react";
import { useLayoutEffect } from "react";
import type { ReviewComment } from "../types";

interface TextNodeSegment {
  node: Text;
  start: number;
  end: number;
}

function getTextNodesInRange(range: Range): TextNodeSegment[] {
  const segments: TextNodeSegment[] = [];
  const walker = document.createTreeWalker(
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? (range.commonAncestorContainer.parentNode ?? range.commonAncestorContainer)
      : range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
  );

  for (;;) {
    const node = walker.nextNode() as Text | null;
    if (!node) {
      break;
    }
    if (!range.intersectsNode(node)) {
      continue;
    }

    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;

    if (start < end) {
      segments.push({ node, start, end });
    }
  }
  return segments;
}

function wrapRangeInMarks(range: Range, commentId: string): void {
  const segments = getTextNodesInRange(range);
  for (const { node, start, end } of segments) {
    const subRange = document.createRange();
    subRange.setStart(node, start);
    subRange.setEnd(node, end);
    const mark = document.createElement("mark");
    mark.dataset.commentId = commentId;
    mark.className = "bg-yellow-200/70 dark:bg-yellow-700/50 rounded-sm cursor-pointer";
    subRange.surroundContents(mark);
  }
}

function removeMarks(container: HTMLElement): void {
  const marks = Array.from(container.querySelectorAll("mark[data-comment-id]"));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) {
      continue;
    }
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

function findQuoteRange(container: HTMLElement, quote: string): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (;;) {
    const node = walker.nextNode() as Text | null;
    if (!node) {
      break;
    }
    nodes.push(node);
  }

  const fullText = nodes.map((n) => n.textContent ?? "").join("");
  const idx = fullText.indexOf(quote);
  if (idx === -1) {
    return null;
  }

  let offset = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;

  for (const n of nodes) {
    const len = n.textContent?.length ?? 0;
    if (startNode === null && offset + len > idx) {
      startNode = n;
      startOffset = idx - offset;
    }
    if (endNode === null && offset + len >= idx + quote.length) {
      endNode = n;
      endOffset = idx + quote.length - offset;
    }
    if (startNode && endNode) {
      break;
    }
    offset += len;
  }

  if (!startNode || !endNode) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

export function useTextHighlighter(
  contentRef: RefObject<HTMLElement | null>,
  comments: ReviewComment[],
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: contentRef is a stable ref, intentionally omitted
  useLayoutEffect(() => {
    const container = contentRef.current;
    if (!container) {
      return;
    }

    removeMarks(container);

    for (const comment of comments) {
      try {
        const range = findQuoteRange(container, comment.quote);
        if (!range) {
          continue;
        }
        wrapRangeInMarks(range, comment.id);
      } catch {
        // skip if DOM is in inconsistent state
      }
    }
  }, [comments]);
}

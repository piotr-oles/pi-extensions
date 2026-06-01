import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useComments } from "./useComments";

vi.mock("../api");

const mockSendComments = vi.mocked(api.sendComments);

const FILE = "/test/file.md";

function clearStorage() {
  localStorage.clear();
}

describe("useComments", () => {
  beforeEach(() => {
    clearStorage();
    vi.clearAllMocks();
  });

  it("starts empty for new file", () => {
    const { result } = renderHook(() => useComments(FILE));
    expect(result.current.comments).toHaveLength(0);
  });

  it("addComment appends a comment", () => {
    const { result } = renderHook(() => useComments(FILE));
    act(() => {
      result.current.addComment("quote text", "my comment");
    });
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0]).toMatchObject({
      quote: "quote text",
      comment: "my comment",
      sent: false,
      error: false,
    });
  });

  it("deleteComment removes the comment", () => {
    const { result } = renderHook(() => useComments(FILE));
    act(() => {
      result.current.addComment("quote", "text");
    });
    const first = result.current.comments[0] as (typeof result.current.comments)[0];
    act(() => {
      result.current.deleteComment(first.id);
    });
    expect(result.current.comments).toHaveLength(0);
  });

  it("persists to localStorage and restores on remount", () => {
    const { result, unmount } = renderHook(() => useComments(FILE));
    act(() => {
      result.current.addComment("q", "c");
    });
    unmount();

    const { result: result2 } = renderHook(() => useComments(FILE));
    expect(result2.current.comments).toHaveLength(1);
    expect(result2.current.comments[0]).toMatchObject({ quote: "q", comment: "c" });
  });

  it("sendOne calls sendComments with single comment and marks sent", async () => {
    mockSendComments.mockResolvedValue(undefined);
    const { result } = renderHook(() => useComments(FILE));
    act(() => {
      result.current.addComment("q", "c");
    });
    const first = result.current.comments[0] as (typeof result.current.comments)[0];
    await act(async () => {
      await result.current.sendOne(first.id);
    });
    expect(mockSendComments).toHaveBeenCalledOnce();
    expect(result.current.comments[0]).toMatchObject({ sent: true, error: false });
  });

  it("sendOne marks error on failure", async () => {
    mockSendComments.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useComments(FILE));
    act(() => {
      result.current.addComment("q", "c");
    });
    const first = result.current.comments[0] as (typeof result.current.comments)[0];
    await act(async () => {
      await result.current.sendOne(first.id);
    });
    expect(result.current.comments[0]).toMatchObject({ sent: false, error: true });
  });

  it("sendAll batches all unsent into one call", async () => {
    mockSendComments.mockResolvedValue(undefined);
    const { result } = renderHook(() => useComments(FILE));
    act(() => {
      result.current.addComment("q1", "c1");
      result.current.addComment("q2", "c2");
    });
    await act(async () => {
      await result.current.sendAll();
    });
    expect(mockSendComments).toHaveBeenCalledOnce();
    const [, sentComments] = mockSendComments.mock.calls[0] as Parameters<typeof mockSendComments>;
    expect(sentComments).toHaveLength(2);
    expect(result.current.comments.every((c) => c.sent)).toBe(true);
  });

  it("sendAll does not mark comments added mid-flight as sent", async () => {
    let resolvePromise!: () => void;
    mockSendComments.mockReturnValue(
      new Promise<void>((r) => {
        resolvePromise = r;
      }),
    );
    const { result } = renderHook(() => useComments(FILE));
    act(() => {
      result.current.addComment("q1", "c1");
    });

    let sendAllDone = false;
    act(() => {
      void result.current.sendAll().then(() => {
        sendAllDone = true;
      });
    });

    act(() => {
      result.current.addComment("q2-new", "c2-new");
    });

    await act(async () => {
      resolvePromise();
    });

    expect(sendAllDone).toBe(true);

    const q1 = result.current.comments.find((c) => c.quote === "q1");
    const q2 = result.current.comments.find((c) => c.quote === "q2-new");
    expect(q1).toMatchObject({ sent: true, error: false });
    expect(q2).toMatchObject({ sent: false, error: false });
  });

  it("uses per-file localStorage key isolation", () => {
    const FILE_B = "/test/other.md";
    const { result: a } = renderHook(() => useComments(FILE));
    act(() => {
      a.current.addComment("a-quote", "a-comment");
    });
    const { result: b } = renderHook(() => useComments(FILE_B));
    expect(b.current.comments).toHaveLength(0);
  });
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useMarkdown } from "./useMarkdown";

vi.mock("../api");

const mockFetchContent = vi.mocked(api.fetchContent);

describe("useMarkdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sample markdown when file is null", () => {
    const { result } = renderHook(() => useMarkdown(null));
    expect(result.current.markdown).toContain("# Markdown Reviewer");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches content when file is provided", async () => {
    mockFetchContent.mockResolvedValue("# Fetched Content");
    const { result } = renderHook(() => useMarkdown("/test/file.md"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markdown).toBe("# Fetched Content");
    expect(result.current.error).toBeNull();
    expect(mockFetchContent).toHaveBeenCalledWith("/test/file.md", expect.any(AbortSignal));
  });

  it("passes AbortSignal to fetchContent and aborts on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockFetchContent.mockImplementation(
      (_file: string, signal?: AbortSignal) =>
        new Promise<string>((resolve) => {
          capturedSignal = signal;
          signal?.addEventListener("abort", () => resolve(""));
        }),
    );
    const { unmount } = renderHook(() => useMarkdown("/file.md"));
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
    expect(capturedSignal?.aborted).toBe(false);
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("ignores AbortError on file change", async () => {
    mockFetchContent
      .mockRejectedValueOnce(Object.assign(new Error("AbortError"), { name: "AbortError" }))
      .mockResolvedValueOnce("# File B");

    const { result, rerender } = renderHook(({ file }: { file: string }) => useMarkdown(file), {
      initialProps: { file: "/a.md" },
    });

    rerender({ file: "/b.md" });

    await waitFor(() => expect(result.current.markdown).toBe("# File B"));
    expect(result.current.error).toBeNull();
  });

  it("sets loading to true while fetching", async () => {
    let resolve: (value: string) => void;
    mockFetchContent.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHook(() => useMarkdown("/test/file.md"));

    expect(result.current.loading).toBe(true);

    act(() => {
      resolve!("# Done");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("sets error on fetch failure", async () => {
    mockFetchContent.mockRejectedValue(new Error("File not found"));
    const { result } = renderHook(() => useMarkdown("/missing.md"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("File not found");
    expect(result.current.markdown).toContain("# Markdown Reviewer");
  });

  it("re-fetches when file changes", async () => {
    mockFetchContent.mockResolvedValueOnce("# File A").mockResolvedValueOnce("# File B");

    const { result, rerender } = renderHook(({ file }: { file: string }) => useMarkdown(file), {
      initialProps: { file: "/a.md" },
    });

    await waitFor(() => expect(result.current.markdown).toBe("# File A"));

    rerender({ file: "/b.md" });

    await waitFor(() => expect(result.current.markdown).toBe("# File B"));

    expect(mockFetchContent).toHaveBeenCalledTimes(2);
  });
});

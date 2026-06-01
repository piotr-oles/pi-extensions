import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchContent, sendComments } from "./api";
import type { ReviewComment } from "./types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: "1",
    quote: "selected text",
    comment: "a comment",
    timestamp: "2024-01-01T00:00:00.000Z",
    sent: false,
    error: false,
    ...overrides,
  };
}

describe("fetchContent", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns content on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: "# Hello" }),
    });
    const result = await fetchContent("/tmp/test.md");
    expect(result).toBe("# Hello");
    expect(mockFetch).toHaveBeenCalledWith("/api/content", expect.objectContaining({}));
  });

  it("does not include file path in URL (server ignores query param)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: "# Hello" }),
    });
    await fetchContent("/tmp/test.md");
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/content");
  });

  it("passes abort signal to fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: "ok" }),
    });
    const controller = new AbortController();
    await fetchContent("/file.md", controller.signal);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });
    await expect(fetchContent("/missing.md")).rejects.toThrow("404");
  });
});

describe("sendComments", () => {
  beforeEach(() => mockFetch.mockReset());

  it("posts correct payload shape", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const comment = makeComment();
    await sendComments("/file.md", [comment]);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/comments");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as {
      file: string;
      comments: Array<{ quote: string; comment: string; timestamp: string }>;
    };
    expect(body.file).toBe("/file.md");
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0]).toMatchObject({ quote: "selected text", comment: "a comment" });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });
    await expect(sendComments("/file.md", [makeComment()])).rejects.toThrow("500");
  });
});

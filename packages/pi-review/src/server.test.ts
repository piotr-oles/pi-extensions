import fs from "node:fs/promises";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReviewServer } from "./server.js";

async function startServer(options: Parameters<typeof createReviewServer>[0]) {
  const srv = createReviewServer(options);
  await new Promise<void>((resolve) => srv.server.listen(0, resolve));
  const port = (srv.server.address() as AddressInfo).port;
  return { ...srv, port };
}

async function request(
  port: number,
  reqPath: string,
  opts?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://localhost:${port}${reqPath}`, opts);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe("createReviewServer", () => {
  let filePath: string;
  let server: Awaited<ReturnType<typeof startServer>>;
  const appDistPath = os.tmpdir();

  beforeEach(async () => {
    filePath = path.join(os.tmpdir(), `review-test-${Date.now()}.md`);
    await fs.writeFile(filePath, "# Test content", "utf8");
  });

  afterEach(async () => {
    await server?.shutdown();
    await fs.unlink(filePath).catch(() => undefined);
  });

  it("GET /health returns 200 {ok:true}", async () => {
    server = await startServer({
      filePath,
      appDistPath,
      allowedOrigin: "http://localhost:5173",
      onComments: vi.fn(),
    });
    const res = await request(server.port, "/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it("GET /api/content returns file content", async () => {
    server = await startServer({
      filePath,
      appDistPath,
      allowedOrigin: "http://localhost:5173",
      onComments: vi.fn(),
    });
    const res = await request(server.port, "/api/content");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ content: "# Test content" });
  });

  it("GET /api/content returns 404 for missing file", async () => {
    server = await startServer({
      filePath: "/nonexistent/path/file.md",
      appDistPath,
      onComments: vi.fn(),
    });
    const res = await request(server.port, "/api/content");
    expect(res.status).toBe(404);
  });

  it("POST /api/comments calls onComments callback", async () => {
    const onComments = vi.fn();
    server = await startServer({
      filePath,
      appDistPath,
      allowedOrigin: "http://localhost:5173",
      onComments,
    });
    const payload = {
      file: filePath,
      comments: [
        { quote: "some text", comment: "a comment", timestamp: "2024-01-01T00:00:00.000Z" },
      ],
    };
    const res = await request(server.port, "/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, received: 1 });
    expect(onComments).toHaveBeenCalledWith(payload.comments);
  });

  it("POST /api/comments returns 400 for non-array body", async () => {
    server = await startServer({ filePath, appDistPath, onComments: vi.fn() });
    const res = await request(server.port, "/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: "not-an-array" }),
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "comments must be an array" });
  });

  it("POST /api/comments filters items missing quote field", async () => {
    const onComments = vi.fn();
    server = await startServer({ filePath, appDistPath, onComments });
    const payload = {
      comments: [
        { quote: "valid", comment: "ok", timestamp: "2024-01-01T00:00:00Z" },
        { comment: "no quote field", timestamp: "2024-01-01T00:00:00Z" },
      ],
    };
    const res = await request(server.port, "/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: 1 });
    expect(onComments).toHaveBeenCalledWith([expect.objectContaining({ quote: "valid" })]);
  });

  it("works without allowedOrigin (no cors header)", async () => {
    server = await startServer({ filePath, appDistPath, onComments: vi.fn() });
    const res = await request(server.port, "/health");
    expect(res.status).toBe(200);
  });

  it("graceful shutdown resolves", async () => {
    server = await startServer({
      filePath,
      appDistPath,
      allowedOrigin: "http://localhost:5173",
      onComments: vi.fn(),
    });
    await expect(server.shutdown()).resolves.toBeUndefined();
  });
});

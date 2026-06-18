import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { makeQueued, mockSession } from "../test-helpers.js";
import { SubagentStore } from "./subagent-store.js";

async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((res) => setImmediate(res));
}

function makeBlockingSession(): AgentSession {
  return { ...mockSession, prompt: () => new Promise<void>(() => {}) } as unknown as AgentSession;
}

describe("SubagentStore", () => {
  it("starts item immediately when slots are free", () => {
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    expect(store.get("a")?.status).toBe("running");
  });

  it("queues item when at capacity", () => {
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    expect(store.get("a")?.status).toBe("running");
    expect(store.get("b")?.status).toBe("queued");
  });

  it("starts next queued item when running agent completes", async () => {
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a" }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });

    expect(store.get("b")?.status).toBe("queued");
    await flushMicrotasks();

    expect(store.get("a")?.status).toBe("done");
    expect(store.get("b")?.status).toBe("running");
  });

  it("drains queued items in FIFO order", async () => {
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a" }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "c", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });

    await flushMicrotasks();

    expect(store.get("a")?.status).toBe("done");
    expect(store.get("b")?.status).toBe("running");
    expect(store.get("c")?.status).toBe("queued");
  });

  it("does not start more items than maxConcurrent while draining", async () => {
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a" }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "c", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });

    await flushMicrotasks();
    expect(store.get("b")?.status).toBe("running");
    expect(store.get("c")?.status).toBe("queued");
  });

  it("respects maxConcurrent > 1", () => {
    const store = new SubagentStore({ maxConcurrent: 2 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "c", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });

    expect(store.get("a")?.status).toBe("running");
    expect(store.get("b")?.status).toBe("running");
    expect(store.get("c")?.status).toBe("queued");
  });

  it("calls onDone with done instance when session completes", async () => {
    const onDone = vi.fn();
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a" }),
      onUpdate: vi.fn(),
      onDone,
    });

    await flushMicrotasks();

    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ status: "done" }));
  });

  it("signal abort transitions queued item to done with aborted status", async () => {
    const controller = new AbortController();
    const onDone = vi.fn();
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: controller.signal,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone,
    });

    controller.abort();
    await flushMicrotasks();

    expect(store.get("b")).toMatchObject({ status: "done", result: { status: "aborted" } });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", result: { status: "aborted" } }),
    );
  });

  it("aborted queued item does not start when slot opens", async () => {
    const controller = new AbortController();
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a" }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: controller.signal,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });

    controller.abort();
    await flushMicrotasks();

    expect(store.get("a")?.status).toBe("done");
    expect(store.get("b")).toMatchObject({ status: "done", result: { status: "aborted" } });
  });

  it("has() returns correct status for each state", async () => {
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });

    expect(store.has("a")).toBe(true);
    expect(store.has("a", "running")).toBe(true);
    expect(store.has("a", "queued")).toBe(false);
    expect(store.has("b")).toBe(true);
    expect(store.has("b", "queued")).toBe(true);
    expect(store.has("b", "running")).toBe(false);
    expect(store.has("z")).toBe(false);
  });

  it("list() returns all instances across all states", async () => {
    const store = new SubagentStore({ maxConcurrent: 1 });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "a" }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });
    store.enqueue({
      signal: undefined,
      queued: makeQueued({ id: "b", session: makeBlockingSession() }),
      onUpdate: vi.fn(),
      onDone: vi.fn(),
    });

    await flushMicrotasks();

    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });
});

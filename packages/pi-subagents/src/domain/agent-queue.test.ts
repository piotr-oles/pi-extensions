import { describe, expect, it, vi } from "vitest";
import { AgentQueue } from "./agent-queue.js";

function makeItem(id: string) {
  return { id };
}

describe("AgentQueue", () => {
  it("starts item immediately when slots are free", () => {
    const onStart = vi.fn();
    const queue = new AgentQueue(2, onStart);

    queue.enqueue(makeItem("a"));

    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("queues item when at capacity", () => {
    const onStart = vi.fn();
    const queue = new AgentQueue(1, onStart);

    queue.enqueue(makeItem("a"));
    queue.enqueue(makeItem("b"));

    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("starts next queued item on release", () => {
    const onStart = vi.fn();
    const queue = new AgentQueue(1, onStart);

    queue.enqueue(makeItem("a"));
    queue.enqueue(makeItem("b"));
    queue.release();

    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: "b" }));
  });

  it("starts multiple queued items on release when slots open", () => {
    const onStart = vi.fn();
    const queue = new AgentQueue(1, onStart);

    queue.enqueue(makeItem("a"));
    queue.enqueue(makeItem("b"));
    queue.enqueue(makeItem("c"));

    // only "a" started so far
    expect(onStart).toHaveBeenCalledOnce();

    queue.release();
    // "b" starts, "c" still queued
    expect(onStart).toHaveBeenCalledTimes(2);

    queue.release();
    // "c" starts
    expect(onStart).toHaveBeenCalledTimes(3);
    expect(onStart).toHaveBeenNthCalledWith(3, expect.objectContaining({ id: "c" }));
  });

  it("drains FIFO order", () => {
    const started: string[] = [];
    const queue = new AgentQueue(1, (it) => started.push(it.id));

    queue.enqueue(makeItem("a"));
    queue.enqueue(makeItem("b"));
    queue.enqueue(makeItem("c"));
    queue.release();
    queue.release();

    expect(started).toEqual(["a", "b", "c"]);
  });

  it("release is a no-op when queue is empty", () => {
    const onStart = vi.fn();
    const queue = new AgentQueue(2, onStart);

    queue.enqueue(makeItem("a"));
    queue.release();
    // no pending items, no error, no extra onStart calls
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("respects maxConcurrent > 1", () => {
    const onStart = vi.fn();
    const queue = new AgentQueue(2, onStart);

    queue.enqueue(makeItem("a"));
    queue.enqueue(makeItem("b"));
    queue.enqueue(makeItem("c"));

    // two slots → "a" and "b" start, "c" queued
    expect(onStart).toHaveBeenCalledTimes(2);

    queue.release();
    expect(onStart).toHaveBeenCalledTimes(3);
  });

  it("passes full QueueItem including callbacks to onStart", () => {
    const onStart = vi.fn();
    const queue = new AgentQueue(1, onStart);
    const onUpdate = vi.fn();
    const onDone = vi.fn();

    queue.enqueue({ id: "x", onUpdate, onDone });

    expect(onStart).toHaveBeenCalledWith({ id: "x", onUpdate, onDone });
  });
});

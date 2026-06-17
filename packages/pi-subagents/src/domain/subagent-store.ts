import type { DoneSubagent } from "./instance/done-subagent.js";
import type { QueuedSubagent } from "./instance/queued-subagent.js";
import type { RunningSubagent } from "./instance/running-subagent.js";
import type { Subagent, SubagentId, SubagentStatus } from "./types.js";

export interface EnqueueSubagentParams {
  signal: AbortSignal | undefined;
  queued: QueuedSubagent;
  onUpdate: (running: RunningSubagent) => void;
  onDone: (done: DoneSubagent) => void;
}

interface SubagentEntry {
  instance: Subagent;
  start: () => void;
  steer: (message: string) => Promise<void>;
  abort: () => void;
}

interface SubagentStoreParams {
  maxConcurrent: number;
}

export class SubagentStore {
  private readonly queued: SubagentQueue = new SubagentQueue();
  private readonly running: SubagentMap = new Map();
  private readonly done: SubagentMap = new Map();
  private readonly maxConcurrent: number;

  constructor({ maxConcurrent }: SubagentStoreParams) {
    this.maxConcurrent = maxConcurrent;
  }

  has(id: string, status?: SubagentStatus): boolean {
    switch (status) {
      case "queued":
        return this.queued.has(id);
      case "running":
        return this.running.has(id);
      case "done":
        return this.done.has(id);
      case undefined:
        return this.queued.has(id) || this.running.has(id) || this.done.has(id);
      default:
        return false;
    }
  }

  get(id: string): Subagent | undefined {
    return (
      this.queued.get(id)?.instance ?? this.running.get(id)?.instance ?? this.done.get(id)?.instance
    );
  }

  list(): Subagent[] {
    return [
      ...Array.from(this.queued.values()).map((entry) => entry.instance),
      ...Array.from(this.running.values()).map((entry) => entry.instance),
      ...Array.from(this.done.values()).map((entry) => entry.instance),
    ];
  }

  async steer(id: string, message: string): Promise<void> {
    const running = this.running.get(id);
    if (running) {
      await running.steer(message);
    }
  }

  enqueue(params: EnqueueSubagentParams): void {
    const entry: SubagentEntry = {
      instance: params.queued,
      start: () => {
        this.queued.delete(entry.instance.id);
        if (entry.instance.status !== "queued") {
          throw new Error(`Cannot start non-queued (${entry.instance.status}) subagent.`);
        }
        entry.instance = entry.instance.run({
          onUpdate: (running: RunningSubagent) => {
            if (entry.instance.status !== "running") {
              throw new Error(`Cannot update non-running (${entry.instance.status}) subagent.`);
            }
            params.onUpdate(running);
            entry.instance = running;
          },
          onDone: (done: DoneSubagent) => {
            if (entry.instance.status === "done") {
              return; // noop
            }
            if (entry.instance.status !== "running") {
              throw new Error(`Cannot mark done non-running (${entry.instance.status}) subagent.`);
            }
            this.running.delete(entry.instance.id);
            params.onDone(done);
            entry.instance = done;
            this.done.set(entry.instance.id, entry);
            params.signal?.removeEventListener("abort", entry.abort);
            this.notify();
          },
        });
        this.running.set(entry.instance.id, entry);
      },
      steer: async (message: string) => {
        if (entry.instance.status !== "running") {
          throw new Error("Cannot steer non-running subagent.");
        }
        const running = await entry.instance.steer(message);
        params.onUpdate(running);
        entry.instance = running;
      },
      abort: async () => {
        if (entry.instance.status === "done") {
          throw new Error("Cannot abort done subagent.");
        }
        this.queued.delete(entry.instance.id);
        this.running.delete(entry.instance.id);
        const done = await entry.instance.abort();
        params.onDone(done);
        entry.instance = done;
        this.done.set(entry.instance.id, entry);
        this.notify();
      },
    };
    if (params.signal?.aborted) {
      const done = params.queued.abort();
      params.onDone(done);
      entry.instance = done;
      this.done.set(done.id, entry);
      return;
    }

    params.signal?.addEventListener("abort", entry.abort, { once: true });

    if (this.running.size < this.maxConcurrent) {
      entry.start();
    } else {
      this.queued.push(entry);
    }
  }

  private notify(): void {
    while (this.running.size < this.maxConcurrent) {
      const entry = this.queued.pop();
      if (entry === undefined) {
        break;
      }
      entry.start();
    }
  }
}

type SubagentMap = Map<SubagentId, SubagentEntry>;

// simple implementation of a queue
class SubagentQueue {
  private readonly queue: Map<SubagentId, SubagentEntry> = new Map();
  // private readonly queue: SubagentEntry[] = [];

  get size(): number {
    return this.queue.size;
  }

  has(id: SubagentId): boolean {
    return this.queue.has(id);
  }

  get(id: SubagentId): SubagentEntry | undefined {
    return this.queue.get(id);
  }

  delete(id: SubagentId): void {
    // const entry = this.queued.get(id);
    // if (entry) {
    //   const index = this.queue.indexOf(entry);
    //   if (index === -1) {
    //     throw new Error('Unexpected SubagentQueue state.');
    //   }
    //   this.queue.splice(index, 1);
    this.queue.delete(id);
    // }
  }

  keys() {
    return this.queue.keys();
  }

  values() {
    return this.queue.values();
  }

  entries() {
    return this.queue.entries();
  }

  [Symbol.iterator]() {
    return this.queue[Symbol.iterator]();
  }

  push(entry: SubagentEntry): void {
    if (this.queue.has(entry.instance.id)) {
      throw new Error("Cannot push the same subagent to the queue twice.");
    }
    this.queue.set(entry.instance.id, entry);
    // this.queue.push(entry);
  }

  pop(): SubagentEntry | undefined {
    const iterator = this.queue[Symbol.iterator]();
    // map iteration order is insertion order so it behaves like queue
    const result = iterator.next();
    if (result.done) {
      return undefined;
    }
    const [id, entry] = result.value;
    this.queue.delete(id);
    // if ()
    //   const entry = this.queue.shift();
    // if (!entry) {
    //   return undefined;
    // }
    // if (!this.queued.has(entry.instance.id)) {
    //   throw new Error('Unexpected SubagentQueue state.');
    // }
    // this.queued.delete(entry.instance.id)
    return entry;
  }
}

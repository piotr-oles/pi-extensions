import type { DoneAgentInstance, RunningAgentInstance } from "./instance/index.js";

export interface QueueItem {
  id: string;
  onUpdate?: (running: RunningAgentInstance) => void;
  onDone?: (instance: DoneAgentInstance) => void;
}

export class AgentQueue {
  private readonly pending: QueueItem[] = [];
  private running = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly onStart: (item: QueueItem) => void,
  ) {}

  enqueue(item: QueueItem): void {
    if (this.running < this.maxConcurrent) {
      this.running++;
      this.onStart(item);
    } else {
      this.pending.push(item);
    }
  }

  cancel(id: string): QueueItem | undefined {
    const index = this.pending.findIndex((item) => item.id === id);
    if (index === -1) {
      return undefined;
    }
    const [item] = this.pending.splice(index, 1);
    return item;
  }

  release(): void {
    this.running--;
    while (this.running < this.maxConcurrent) {
      const item = this.pending.shift();
      if (item === undefined) {
        break;
      }
      this.running++;
      this.onStart(item);
    }
  }
}

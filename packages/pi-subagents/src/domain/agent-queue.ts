import type { DoneAgentInstance, RunningAgentInstance } from "./instance/index.js";

interface QueueItem {
  id: string;
  onUpdate?: (running: RunningAgentInstance) => void;
  onComplete?: (instance: DoneAgentInstance) => void;
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

  release(): void {
    this.running--;
    while (this.pending.length > 0 && this.running < this.maxConcurrent) {
      const item = this.pending.shift()!;
      this.running++;
      this.onStart(item);
    }
  }
}

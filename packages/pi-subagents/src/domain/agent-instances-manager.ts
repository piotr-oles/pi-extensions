import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getMaxConcurrent } from "../flags.js";
import { createAgentSessionFromConfig } from "../infrastructure/session-factory.js";
import { AgentConfig, type AgentConfigOverrides } from "./agent-config.js";
import { AgentQueue, type QueueItem } from "./agent-queue.js";
import {
  type AgentInstance,
  type DoneAgentInstance,
  QueuedAgentInstance,
} from "./instance/index.js";
import type { AgentId, AgentTemplate, RunningAgentInstance } from "./types.js";

export interface SpawnOptions {
  prompt: string;
  description: string;
  overrides?: AgentConfigOverrides;
  signal?: AbortSignal;
  onUpdate?: (running: RunningAgentInstance) => void;
  onComplete?: (instance: DoneAgentInstance) => void;
}

export class AgentInstancesManager {
  private lastId = 1;
  private readonly instances = new Map<AgentId, AgentInstance>();
  private readonly queue: AgentQueue;

  constructor(private readonly pi: ExtensionAPI) {
    this.queue = new AgentQueue(getMaxConcurrent(pi), (item) => this.startQueuedAgent(item));
  }

  async spawn(
    ctx: ExtensionContext,
    template: AgentTemplate,
    { description, prompt, overrides, signal, onUpdate, onComplete }: SpawnOptions,
  ): Promise<string> {
    // use integers so it's easier for agent to replicate
    const id = String(this.lastId++);
    const config = new AgentConfig({
      template,
      overrides,
      description,
      prompt,
      activeTools: this.pi.getActiveTools(),
    });
    // we create a session right away, so it's ready to start.
    const session = await createAgentSessionFromConfig(config, ctx);
    const queued = new QueuedAgentInstance({ id, config, session, signal });
    this.instances.set(id, queued);
    this.queue.enqueue({ id, onUpdate, onComplete });
    return id;
  }

  async steer(id: string, message: string): Promise<boolean> {
    const running = this.getRunningInstance(id);
    return running?.steer(message) ?? false;
  }

  abort(id: string): boolean {
    const instance = this.instances.get(id);
    if (!instance) {
      return false;
    }
    if (instance.status === "running") {
      this.instances.set(id, instance.abort());
      return true;
    }
    if (instance.status === "queued") {
      const item = this.queue.cancel(id);
      const done = instance.abort();
      this.instances.set(id, done);
      item?.onComplete?.(done);
      return true;
    }
    return false;
  }

  getInstance(id: string): AgentInstance | undefined {
    return this.instances.get(id);
  }

  getRunningInstance(id: string): RunningAgentInstance | undefined {
    const instance = this.instances.get(id);
    return instance?.status === "running" ? instance : undefined;
  }

  listInstances(): AgentInstance[] {
    // TODO: find better sorting mechanism
    return [...this.instances.values()].sort(
      (instanceA, instanceB) => Number(instanceA.id) - Number(instanceB.id),
    );
  }

  private startQueuedAgent({ id, onUpdate, onComplete }: QueueItem): void {
    const instance = this.instances.get(id);
    if (!instance || instance.status !== "queued") {
      this.queue.release();
      return;
    }

    try {
      const running = instance.run({
        onUpdate,
        onDone: (done) => {
          try {
            this.instances.set(id, done);
            onComplete?.(done);
          } finally {
            this.queue.release();
          }
        },
      });
      this.instances.set(id, running);
    } catch (_error) {
      this.queue.release();
      // TODO: log this?
    }
  }
}

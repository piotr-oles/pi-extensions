import type { Api, Model } from "@earendil-works/pi-ai";
import {
  createAgentSession,
  type ExtensionContext,
  type ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { SubagentsResourceLoader } from "../infrastructure/subagents-resource-loader.js";
import { AgentConfig, type AgentConfigOverrides } from "./agent-config.js";
import { AgentQueue, type QueueItem } from "./agent-queue.js";
import {
  type AgentInstance,
  type AgentInstanceByStatus,
  type AgentInstanceStatus,
  type DoneAgentInstance,
  QueuedAgentInstance,
} from "./instance/index.js";
import type { AgentId, AgentTemplate, RunningAgentInstance } from "./types.js";

export interface SpawnOptions {
  prompt: string;
  description: string;
  availableTools: string[];
  overrides?: AgentConfigOverrides;
  signal?: AbortSignal;
}

export class AgentInstancesManager {
  private lastId = 1;
  private readonly instances = new Map<AgentId, AgentInstance>();
  private readonly queue: AgentQueue;

  constructor(maxConcurrent: number) {
    this.queue = new AgentQueue(maxConcurrent, (item) => this.startQueuedAgent(item));
  }

  spawn(
    ctx: ExtensionContext,
    template: AgentTemplate,
    { description, prompt, availableTools, overrides, signal }: SpawnOptions,
  ): AsyncIterable<AgentInstance> {
    // use integers so it's easier for agent to replicate
    const id = String(this.lastId++);
    const model = this.findModel(ctx.modelRegistry, template.model) ?? ctx.model;
    const config = new AgentConfig({
      template,
      model: model?.name,
      overrides,
      description,
      prompt,
      availableTools,
    });

    const stream = new ReadableStream<AgentInstance>({
      start: async (controller) => {
        const resourceLoader = new SubagentsResourceLoader(ctx.cwd, config);
        const { session } = await createAgentSession({
          cwd: ctx.cwd,
          sessionManager: SessionManager.create(ctx.cwd),
          settingsManager: SettingsManager.create(ctx.cwd),
          modelRegistry: ctx.modelRegistry,
          model,
          tools: config.enabledTools,
          resourceLoader,
          thinkingLevel: config.thinkingLevel,
        });

        const queued = new QueuedAgentInstance({ id, config, session, signal });
        this.instances.set(id, queued);
        this.queue.enqueue({
          id,
          onUpdate: (running) => {
            controller.enqueue(running);
          },
          onDone: (done) => {
            controller.enqueue(done);
            controller.close();
          },
        });
      },
    });

    return stream;
  }

  async steer(id: string, message: string): Promise<RunningAgentInstance | undefined> {
    const instance = this.instances.get(id);
    if (instance && instance.status === "running") {
      await instance.steer(message);
      return instance;
    }
    return undefined;
  }

  async abort(id: string): Promise<DoneAgentInstance | undefined> {
    const instance = this.instances.get(id);
    if (!instance) {
      return undefined;
    }
    if (instance.status === "running") {
      const done = instance.abort();
      this.instances.set(id, done);
      return done;
    }
    if (instance.status === "queued") {
      const item = this.queue.cancel(id);
      const done = instance.abort();
      this.instances.set(id, done);
      item?.onDone?.(done);
      return done;
    }
    return undefined;
  }

  getInstance<TStatus extends AgentInstanceStatus>(
    id: string,
    status: TStatus,
  ): AgentInstanceByStatus<TStatus> | undefined;
  getInstance(id: string): AgentInstance | undefined;
  getInstance(id: string, status?: AgentInstanceStatus): AgentInstance | undefined {
    const instance = this.instances.get(id);
    if (status && instance?.status !== status) {
      return undefined;
    }
    return instance;
  }

  listInstances<TStatus extends AgentInstanceStatus>(
    status: TStatus,
  ): AgentInstanceByStatus<TStatus>[];
  listInstances(): AgentInstance[];
  listInstances(status?: AgentInstanceStatus): AgentInstance[] {
    const allInstances = [...this.instances.values()];
    const selectedInstances = status
      ? allInstances.filter((instance) => instance.status === status)
      : allInstances;

    // TODO: find better sorting mechanism
    return selectedInstances.sort(
      (instanceA, instanceB) => Number(instanceA.id) - Number(instanceB.id),
    );
  }

  private startQueuedAgent({ id, onUpdate, onDone }: QueueItem): void {
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
            onDone?.(done);
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

  private findModel(registry: ModelRegistry, name: string | undefined): Model<Api> | undefined {
    if (!name) {
      return undefined;
    }
    const models = registry.getAvailable();
    if (!models || models.length === 0) {
      return undefined;
    }

    const exact = models.find(
      (model) => `${model.provider} / ${model.id}` === name || model.id === name,
    );
    if (exact) {
      return exact;
    }

    const lower = name.toLowerCase();
    return models.find(
      (model) => model.id.toLowerCase().includes(lower) || model.name.toLowerCase().includes(lower),
    );
  }
}

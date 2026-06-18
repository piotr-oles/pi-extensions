import type { AgentSessionEvent, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAgentTemplate } from "../test-helpers.js";
import type { DoneSubagent } from "./instance/done-subagent.js";
import { SubagentInstancesManager } from "./subagent-instances-manager.js";
import type { Subagent } from "./types.js";

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
  return {
    ...original,
    createAgentSession: vi.fn(),
    SessionManager: { create: vi.fn().mockReturnValue({ appendCustomEntry: vi.fn() }) },
    SettingsManager: { create: vi.fn().mockReturnValue({}) },
    DefaultResourceLoader: vi
      .fn()
      .mockImplementation(() => ({ reload: vi.fn().mockResolvedValue(undefined) })),
  };
});

vi.mock("../infrastructure/subagents-resource-loader.js", () => ({
  SubagentsResourceLoader: vi.fn().mockImplementation(() => ({})),
}));

import { createAgentSession } from "@earendil-works/pi-coding-agent";

type EventHandler = (event: AgentSessionEvent) => void | Promise<void>;

interface MockSessionOptions {
  promptImpl?: () => Promise<void>;
  captureSubscribe?: { handler: EventHandler | null };
}

function makeMockSession({ promptImpl, captureSubscribe }: MockSessionOptions = {}) {
  return {
    sessionId: "mock",
    steer: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
    prompt: vi.fn().mockImplementation(promptImpl ?? (() => new Promise<void>(() => {}))),
    subscribe: vi.fn().mockImplementation((cb: EventHandler) => {
      if (captureSubscribe) {
        captureSubscribe.handler = cb;
      }
      return () => {};
    }),
    getLastAssistantText: vi.fn().mockReturnValue("done result"),
    getContextUsage: vi.fn().mockReturnValue(undefined),
  };
}

function makeMockCtx(): ExtensionContext {
  return {
    cwd: "/tmp",
    model: undefined,
    modelRegistry: {
      getAvailable: vi.fn().mockReturnValue([]),
    },
  } as unknown as ExtensionContext;
}

const template = makeAgentTemplate({ name: "tester", instructions: "do stuff" });

async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((res) => setImmediate(res));
}

describe("AgentInstancesManager", () => {
  let session: ReturnType<typeof makeMockSession>;
  let ctx: ExtensionContext;
  let manager: SubagentInstancesManager;
  let tcCounter: number;

  beforeEach(() => {
    session = makeMockSession();
    ctx = makeMockCtx();
    vi.mocked(createAgentSession).mockResolvedValue({ session } as never);
    manager = new SubagentInstancesManager(4);
    tcCounter = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  interface SpawnOptions {
    description: string;
    prompt: string;
    availableTools: string[];
    model?: string;
    maxTurns?: number;
    signal?: AbortSignal;
  }

  interface SpawnHandle {
    done: Promise<DoneSubagent>;
    abort: () => void;
  }

  function spawn(options: SpawnOptions): SpawnHandle {
    const controller = new AbortController();
    const signal = options.signal ?? controller.signal;
    const done = manager.spawn({
      id: manager.id(`tc-${tcCounter++}`),
      ctx,
      template,
      signal,
      onUpdate: () => {},
      description: options.description,
      prompt: options.prompt,
      availableTools: options.availableTools,
      model: options.model,
      maxTurns: options.maxTurns,
    });
    return { done, abort: () => controller.abort() };
  }

  describe("spawn", () => {
    it("returns distinct instances that can each be retrieved", async () => {
      spawn({ description: "a", prompt: "go", availableTools: [] });
      spawn({ description: "b", prompt: "go", availableTools: [] });
      await flushMicrotasks();

      const instances = manager.listInstances();
      expect(instances).toHaveLength(2);
      expect(instances[0].id).not.toBe(instances[1].id);
      expect(manager.getInstance(instances[0].id)?.id).toBe(instances[0].id);
      expect(manager.getInstance(instances[1].id)?.id).toBe(instances[1].id);
    });

    it("spawned instance config reflects description and prompt", async () => {
      spawn({ description: "task", prompt: "work", availableTools: [] });
      await flushMicrotasks();

      const instance = manager.listInstances()[0];
      expect(instance?.description).toBe("task");
      expect(instance?.prompt).toBe("work");
    });

    it("instance is 'running' after spawn when capacity is available", async () => {
      spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      expect(manager.listInstances()[0]?.status).toBe("running");
    });

    it("instance is 'queued' when at max capacity", async () => {
      manager = new SubagentInstancesManager(1);

      spawn({ description: "a", prompt: "p1", availableTools: [] });
      spawn({ description: "b", prompt: "p2", availableTools: [] });
      await flushMicrotasks();

      expect(manager.listInstances()[1]?.status).toBe("queued");
    });

    it("spawned instance config includes active tools from pi", async () => {
      spawn({
        description: "d",
        prompt: "p",
        availableTools: ["bash", "read"],
      });
      await flushMicrotasks();

      const instance = manager.listInstances()[0];
      expect(instance?.config.includedTools).toContain("bash");
      expect(instance?.config.includedTools).toContain("read");
    });

    it("excludes subagent tool when includedSubagents not set", async () => {
      spawn({ description: "d", prompt: "p", availableTools: ["bash", "subagent"] });
      await flushMicrotasks();

      expect(manager.listInstances()[0]?.config.includedTools).not.toContain("subagent");
    });

    it("restricts tools to includedTools whitelist", async () => {
      const t = makeAgentTemplate({ includedTools: ["bash"] });
      manager.spawn({
        id: manager.id(`tc-${tcCounter++}`),
        ctx,
        template: t,
        description: "d",
        prompt: "p",
        availableTools: ["bash", "read", "edit"],
        signal: undefined,
        onUpdate: () => {},
      });
      await flushMicrotasks();

      expect(manager.listInstances()[0]?.config.includedTools).toEqual(["bash"]);
    });

    it("keeps subagent tool when includedSubagents is non-empty", async () => {
      const t = makeAgentTemplate({ includedSubagents: ["explorer"] });
      manager.spawn({
        id: manager.id(`tc-${tcCounter++}`),
        ctx,
        template: t,
        description: "d",
        prompt: "p",
        availableTools: ["bash", "subagent"],
        signal: undefined,
        onUpdate: () => {},
      });
      await flushMicrotasks();

      expect(manager.listInstances()[0]?.config.includedTools).toContain("subagent");
    });

    it("config carries includedSubagents from template", async () => {
      const t = makeAgentTemplate({ includedSubagents: ["reviewer"] });
      manager.spawn({
        id: manager.id(`tc-${tcCounter++}`),
        ctx,
        template: t,
        description: "d",
        prompt: "p",
        availableTools: [],
        signal: undefined,
        onUpdate: () => {},
      });
      await flushMicrotasks();

      expect(manager.listInstances()[0]?.config.includedSubagents).toEqual(["reviewer"]);
    });

    it("spawned instance config reflects model and maxTurns", async () => {
      const mockModel = { id: "gpt-4o", name: "gpt-4o", provider: "openai" };
      const ctxWithModels = {
        ...ctx,
        modelRegistry: { getAvailable: vi.fn().mockReturnValue([mockModel]) },
      } as unknown as ExtensionContext;

      manager.spawn({
        id: manager.id(`tc-${tcCounter++}`),
        ctx: ctxWithModels,
        template,
        description: "d",
        prompt: "p",
        availableTools: [],
        model: "gpt-4o",
        maxTurns: 20,
        signal: undefined,
        onUpdate: () => {},
      });
      await flushMicrotasks();

      const instance = manager.listInstances()[0];
      expect(instance?.config.model).toBe("gpt-4o");
      expect(instance?.config.maxTurns).toBe(20);
    });
  });

  describe("getInstance", () => {
    it("returns undefined for unknown id", () => {
      expect(manager.getInstance("99")).toBeUndefined();
    });

    it("returns instance matching the spawned id", async () => {
      spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const instance = manager.listInstances()[0];
      expect(instance).toBeDefined();
      expect(manager.getInstance(instance.id)?.id).toBe(instance.id);
    });

    it("returns undefined for unknown id with status filter", () => {
      expect(manager.getInstance("99", "running")).toBeUndefined();
    });

    it("returns running instance when status matches", async () => {
      spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const instance = manager.listInstances()[0];
      const running = manager.getInstance(instance.id, "running");
      expect(running).toBeDefined();
      expect(running?.status).toBe("running");
    });

    it("returns undefined for queued instance when filtering by running", async () => {
      manager = new SubagentInstancesManager(1);

      spawn({ description: "a", prompt: "p", availableTools: [] });
      spawn({ description: "b", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const queued2 = manager.listInstances()[1];
      expect(manager.getInstance(queued2.id, "running")).toBeUndefined();
    });

    it("returns undefined after instance is done when filtering by running", async () => {
      const handle = spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      handle.abort();
      await handle.done;

      expect(manager.getInstance(id, "running")).toBeUndefined();
    });
  });

  describe("listInstances", () => {
    it("returns empty array before any spawn", () => {
      expect(manager.listInstances()).toEqual([]);
    });

    it("returns all spawned instances", async () => {
      spawn({ description: "a", prompt: "p", availableTools: [] });
      spawn({ description: "b", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      expect(manager.listInstances()).toHaveLength(2);
    });

    it("sorts by numeric id ascending", async () => {
      spawn({ description: "a", prompt: "p", availableTools: [] });
      spawn({ description: "b", prompt: "p", availableTools: [] });
      spawn({ description: "c", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      expect(manager.listInstances().map((i) => i.id)).toEqual(["1", "2", "3"]);
    });
  });

  describe("abort via signal", () => {
    it("transitions queued instance to done with aborted status", async () => {
      manager = new SubagentInstancesManager(1);

      spawn({ description: "a", prompt: "p", availableTools: [] });
      const handle2 = spawn({ description: "b", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const queued2Id = manager.listInstances()[1].id;
      handle2.abort();
      const done = await handle2.done;

      expect(done).toMatchObject({ status: "done", result: { status: "aborted" } });
      expect(manager.getInstance(queued2Id)).toMatchObject({
        status: "done",
        result: { status: "aborted" },
      });
    });

    it("aborted queued instance does not start when slot opens", async () => {
      let resolveFirst!: () => void;
      const firstSession = makeMockSession({
        promptImpl: () =>
          new Promise<void>((res) => {
            resolveFirst = res;
          }),
      });
      vi.mocked(createAgentSession)
        .mockResolvedValueOnce({ session: firstSession } as never)
        .mockResolvedValueOnce({ session } as never);

      manager = new SubagentInstancesManager(1);

      const handle1 = spawn({ description: "a", prompt: "p1", availableTools: [] });
      const handle2 = spawn({ description: "b", prompt: "p2", availableTools: [] });
      await flushMicrotasks();

      const [id1, id2] = manager.listInstances().map((i) => i.id);

      handle2.abort();
      await handle2.done;
      resolveFirst();
      await handle1.done;

      expect(manager.getInstance(id1)?.status).toBe("done");
      expect(manager.getInstance(id2)).toMatchObject({
        status: "done",
        result: { status: "aborted" },
      });
    });

    it("transitions running instance to done with aborted status", async () => {
      const handle = spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      handle.abort();
      const done = await handle.done;

      expect(done).toBeDefined();
      expect(manager.getInstance(id)?.status).toBe("done");
    });

    it("done instance has reason 'aborted' when signal fires on running instance", async () => {
      const handle = spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      handle.abort();
      await handle.done;

      expect(manager.getInstance(id)).toMatchObject({
        status: "done",
        result: { status: "aborted" },
      });
    });

    it("externally provided AbortSignal aborts queued instance", async () => {
      const controller = new AbortController();
      manager = new SubagentInstancesManager(1);

      spawn({ description: "a", prompt: "p1", availableTools: [] });
      const done2 = manager.spawn({
        id: manager.id(`tc-${tcCounter++}`),
        ctx,
        template,
        description: "b",
        prompt: "p2",
        availableTools: [],
        signal: controller.signal,
        onUpdate: () => {},
      });
      await flushMicrotasks();

      const queued2Id = manager.listInstances()[1].id;
      expect(manager.getInstance(queued2Id)?.status).toBe("queued");

      controller.abort();
      const done = await done2;

      expect(done).toMatchObject({ status: "done", result: { status: "aborted" } });
      expect(manager.getInstance(queued2Id)).toMatchObject({
        status: "done",
        result: { status: "aborted" },
      });
    });

    it("already-aborted signal prevents queued instance from starting when slot opens", async () => {
      const controller = new AbortController();
      controller.abort();

      let resolveFirst!: () => void;
      const firstSession = makeMockSession({
        promptImpl: () =>
          new Promise<void>((res) => {
            resolveFirst = res;
          }),
      });
      vi.mocked(createAgentSession)
        .mockResolvedValueOnce({ session: firstSession } as never)
        .mockResolvedValueOnce({ session } as never);

      manager = new SubagentInstancesManager(1);

      const handle1 = spawn({ description: "a", prompt: "p1", availableTools: [] });
      const done2 = manager.spawn({
        id: manager.id(`tc-${tcCounter++}`),
        ctx,
        template,
        description: "b",
        prompt: "p2",
        availableTools: [],
        signal: controller.signal,
        onUpdate: () => {},
      });
      await flushMicrotasks();

      resolveFirst();
      const [, done] = await Promise.all([handle1.done, done2]);

      expect(manager.getInstance(manager.listInstances()[0].id)?.status).toBe("done");
      expect(done).toMatchObject({ status: "done", result: { status: "aborted" } });
    });
  });

  describe("steer", () => {
    it("is a no-op for unknown id", async () => {
      await expect(manager.steer("99", "hello")).resolves.toBeUndefined();
    });

    it("is a no-op for queued instance", async () => {
      manager = new SubagentInstancesManager(1);

      spawn({ description: "a", prompt: "p", availableTools: [] });
      spawn({ description: "b", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const queued2Id = manager.listInstances()[1].id;
      await expect(manager.steer(queued2Id, "message")).resolves.toBeUndefined();
      expect(session.steer).not.toHaveBeenCalled();
    });

    it("calls session.steer on running instance", async () => {
      spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      await manager.steer(id, "pivot now");

      expect(session.steer).toHaveBeenCalledWith("pivot now");
    });

    it("is a no-op after instance is done", async () => {
      const handle = spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      handle.abort();
      await handle.done;

      await expect(manager.steer(id, "too late")).resolves.toBeUndefined();
      expect(session.steer).not.toHaveBeenCalled();
    });
  });

  describe("queue drain", () => {
    it("starts queued agent when running agent completes", async () => {
      let resolveFirst!: () => void;
      const firstSession = makeMockSession({
        promptImpl: () =>
          new Promise<void>((res) => {
            resolveFirst = res;
          }),
      });
      const secondSession = makeMockSession();
      vi.mocked(createAgentSession)
        .mockResolvedValueOnce({ session: firstSession } as never)
        .mockResolvedValueOnce({ session: secondSession } as never);

      manager = new SubagentInstancesManager(1);

      spawn({ description: "a", prompt: "p1", availableTools: [] });
      spawn({ description: "b", prompt: "p2", availableTools: [] });
      await flushMicrotasks();

      const [id1, id2] = manager.listInstances().map((i) => i.id);

      expect(manager.getInstance(id1)?.status).toBe("running");
      expect(manager.getInstance(id2)?.status).toBe("queued");

      resolveFirst();
      await flushMicrotasks();

      expect(manager.getInstance(id1)?.status).toBe("done");
      expect(manager.getInstance(id2)?.status).toBe("running");
    });

    it("spawn promise resolves with done when agent finishes", async () => {
      let resolvePrompt!: () => void;
      const controllableSession = makeMockSession({
        promptImpl: () =>
          new Promise<void>((res) => {
            resolvePrompt = res;
          }),
      });
      vi.mocked(createAgentSession).mockResolvedValue({ session: controllableSession } as never);

      manager = new SubagentInstancesManager(1);
      const handle = spawn({ description: "d", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      expect(manager.listInstances()[0]?.status).toBe("running");
      resolvePrompt();
      const done = await handle.done;

      expect(done).toMatchObject({ status: "done", result: { status: "completed" } });
    });

    it("starts multiple agents in parallel when maxConcurrent > 1", async () => {
      manager = new SubagentInstancesManager(2);

      spawn({ description: "a", prompt: "p1", availableTools: [] });
      spawn({ description: "b", prompt: "p2", availableTools: [] });
      spawn({ description: "c", prompt: "p3", availableTools: [] });
      await flushMicrotasks();

      const instances = manager.listInstances();
      expect(instances[0]?.status).toBe("running");
      expect(instances[1]?.status).toBe("running");
      expect(instances[2]?.status).toBe("queued");
    });
  });

  describe("followUp", () => {
    it("throws for unknown id", async () => {
      await expect(
        manager.followUp({
          id: "99",
          prompt: "p",
          description: "d",
          signal: undefined,
          onUpdate: () => {},
        }),
      ).rejects.toThrow();
    });

    it("throws for queued instance", async () => {
      manager = new SubagentInstancesManager(1);

      spawn({ description: "a", prompt: "p", availableTools: [] });
      spawn({ description: "b", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const queued2Id = manager.listInstances()[1].id;
      await expect(
        manager.followUp({
          id: queued2Id,
          prompt: "p",
          description: "d",
          signal: undefined,
          onUpdate: () => {},
        }),
      ).rejects.toThrow();
    });

    it("throws for running instance", async () => {
      spawn({ description: "a", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      await expect(
        manager.followUp({
          id,
          prompt: "p",
          description: "d",
          signal: undefined,
          onUpdate: () => {},
        }),
      ).rejects.toThrow();
    });

    it("transitions instance from done to running then back to done", async () => {
      const handle = spawn({ description: "a", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      handle.abort();
      await handle.done;
      expect(manager.getInstance(id)?.status).toBe("done");

      manager.followUp({
        id,
        prompt: "follow",
        description: "d",
        signal: undefined,
        onUpdate: () => {},
      });
      await flushMicrotasks();

      expect(manager.getInstance(id)?.status).toBe("running");
    });

    it("resolves when follow-up completes", async () => {
      const completingSession = makeMockSession({ promptImpl: () => Promise.resolve() });
      vi.mocked(createAgentSession).mockResolvedValue({ session: completingSession } as never);

      spawn({ description: "a", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;
      expect(manager.getInstance(id)?.status).toBe("done");

      const done = await manager.followUp({
        id,
        prompt: "follow",
        description: "d",
        signal: undefined,
        onUpdate: () => {},
      });

      expect(done).toMatchObject({ status: "done" });
      expect(manager.getInstance(id)?.status).toBe("done");
    });

    it("done instance carries follow-up prompt and description", async () => {
      const completingSession = makeMockSession({ promptImpl: () => Promise.resolve() });
      vi.mocked(createAgentSession).mockResolvedValue({ session: completingSession } as never);

      spawn({ description: "original-desc", prompt: "original-prompt", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;

      await manager.followUp({
        id,
        prompt: "follow-prompt",
        description: "follow-desc",
        signal: undefined,
        onUpdate: () => {},
      });

      const done = manager.getInstance(id);
      expect(done?.prompt).toBe("follow-prompt");
      expect(done?.description).toBe("follow-desc");
    });

    it("can chain multiple follow-ups on the same id", async () => {
      const completingSession = makeMockSession({ promptImpl: () => Promise.resolve() });
      vi.mocked(createAgentSession).mockResolvedValue({ session: completingSession } as never);

      spawn({ description: "a", prompt: "p", availableTools: [] });
      await flushMicrotasks();

      const id = manager.listInstances()[0].id;

      await manager.followUp({
        id,
        prompt: "follow-1",
        description: "d",
        signal: undefined,
        onUpdate: () => {},
      });
      expect(manager.getInstance(id)?.status).toBe("done");

      await manager.followUp({
        id,
        prompt: "follow-2",
        description: "d",
        signal: undefined,
        onUpdate: () => {},
      });
      expect(manager.getInstance(id)?.prompt).toBe("follow-2");
    });
  });
});

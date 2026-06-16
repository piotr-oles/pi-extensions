import type { AgentSessionEvent, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAgentTemplate } from "../test-helpers.js";
import { AgentInstancesManager } from "./agent-instances-manager.js";

vi.mock("../infrastructure/session-factory.js");

import { createAgentSessionFromConfig } from "../infrastructure/session-factory.js";
import type { Session } from "./types.js";

type EventHandler = (event: AgentSessionEvent) => void | Promise<void>;

interface MockSessionOptions {
  promptImpl?: () => Promise<void>;
  captureSubscribe?: { handler: EventHandler | null };
}

function makeMockSession({ promptImpl, captureSubscribe }: MockSessionOptions = {}): Session {
  return {
    sessionId: "mock",
    steer: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn(),
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
    model: {},
    modelRegistry: {},
  } as unknown as ExtensionContext;
}

const template = makeAgentTemplate({ name: "tester", instructions: "do stuff" });

async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((res) => setImmediate(res));
}

describe("AgentInstancesManager", () => {
  let session: Session;
  let ctx: ExtensionContext;
  let manager: AgentInstancesManager;

  beforeEach(() => {
    session = makeMockSession();
    ctx = makeMockCtx();
    vi.mocked(createAgentSessionFromConfig).mockResolvedValue(session);
    manager = new AgentInstancesManager(4);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("spawn", () => {
    it("returns distinct instances that can each be retrieved", async () => {
      const queued1 = await manager.spawn(ctx, template, {
        description: "a",
        prompt: "go",
        availableTools: [],
      });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "go",
        availableTools: [],
      });

      expect(queued1.id).not.toBe(queued2.id);
      expect(manager.getInstance(queued1.id)?.id).toBe(queued1.id);
      expect(manager.getInstance(queued2.id)?.id).toBe(queued2.id);
    });

    it("spawned instance config reflects description and prompt", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "task",
        prompt: "work",
        availableTools: [],
      });

      expect(manager.getInstance(queued.id)?.config.description).toBe("task");
      expect(manager.getInstance(queued.id)?.config.prompt).toBe("work");
    });

    it("instance is 'running' after spawn when capacity is available", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });

      expect(manager.getInstance(queued.id)?.status).toBe("running");
    });

    it("instance is 'queued' when at max capacity", async () => {
      manager = new AgentInstancesManager(1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p1", availableTools: [] });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p2",
        availableTools: [],
      });

      expect(manager.getInstance(queued2.id)?.status).toBe("queued");
    });

    it("spawned instance config includes active tools from pi", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: ["bash", "read"],
      });

      expect(manager.getInstance(queued.id)?.config.enabledTools).toContain("bash");
      expect(manager.getInstance(queued.id)?.config.enabledTools).toContain("read");
    });

    it("spawned instance config reflects overrides", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
        overrides: { model: "gpt-4o", maxTurns: 20 },
      });

      expect(manager.getInstance(queued.id)?.config.model).toBe("gpt-4o");
      expect(manager.getInstance(queued.id)?.config.maxTurns).toBe(20);
    });
  });

  describe("getInstance", () => {
    it("returns undefined for unknown id", () => {
      expect(manager.getInstance("99")).toBeUndefined();
    });

    it("returns instance matching the spawned id", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });

      expect(manager.getInstance(queued.id)).toBeDefined();
      expect(manager.getInstance(queued.id)?.id).toBe(queued.id);
    });

    it("returns undefined for unknown id with status filter", () => {
      expect(manager.getInstance("99", "running")).toBeUndefined();
    });

    it("returns running instance when status matches", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });

      const running = manager.getInstance(queued.id, "running");
      expect(running).toBeDefined();
      expect(running?.status).toBe("running");
    });

    it("returns undefined for queued instance when filtering by running", async () => {
      manager = new AgentInstancesManager(1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p", availableTools: [] });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p",
        availableTools: [],
      });

      expect(manager.getInstance(queued2.id, "running")).toBeUndefined();
    });

    it("returns undefined after instance is done when filtering by running", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });
      await manager.abort(queued.id);

      expect(manager.getInstance(queued.id, "running")).toBeUndefined();
    });
  });

  describe("listInstances", () => {
    it("returns empty array before any spawn", () => {
      expect(manager.listInstances()).toEqual([]);
    });

    it("returns all spawned instances", async () => {
      await manager.spawn(ctx, template, { description: "a", prompt: "p", availableTools: [] });
      await manager.spawn(ctx, template, { description: "b", prompt: "p", availableTools: [] });

      expect(manager.listInstances()).toHaveLength(2);
    });

    it("sorts by numeric id ascending", async () => {
      const q1 = await manager.spawn(ctx, template, {
        description: "a",
        prompt: "p",
        availableTools: [],
      });
      const q2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p",
        availableTools: [],
      });
      const q3 = await manager.spawn(ctx, template, {
        description: "c",
        prompt: "p",
        availableTools: [],
      });

      expect(manager.listInstances().map((i) => i.id)).toEqual([q1.id, q2.id, q3.id]);
    });
  });

  describe("abort", () => {
    it("returns undefined for unknown id", async () => {
      expect(await manager.abort("99")).toBeUndefined();
    });

    it("returns done instance when aborting queued instance", async () => {
      manager = new AgentInstancesManager(1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p", availableTools: [] });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p",
        availableTools: [],
      });

      const done = await manager.abort(queued2.id);
      expect(done).toMatchObject({ status: "done", reason: "aborted" });
      expect(manager.getInstance(queued2.id)).toMatchObject({ status: "done", reason: "aborted" });
    });

    it("calls onDone when aborting queued instance", async () => {
      const onComplete = vi.fn();
      manager = new AgentInstancesManager(1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p", availableTools: [] });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p",
        availableTools: [],
        onDone: onComplete,
      });

      await manager.abort(queued2.id);

      expect(onComplete).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ status: "done", reason: "aborted" }),
      );
    });

    it("aborted queued instance does not start when slot opens", async () => {
      let resolveFirst!: () => void;
      const firstSession = makeMockSession({
        promptImpl: () =>
          new Promise<void>((res) => {
            resolveFirst = res;
          }),
      });
      vi.mocked(createAgentSessionFromConfig)
        .mockResolvedValueOnce(firstSession)
        .mockResolvedValueOnce(session);

      manager = new AgentInstancesManager(1);

      const queued1 = await manager.spawn(ctx, template, {
        description: "a",
        prompt: "p1",
        availableTools: [],
      });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p2",
        availableTools: [],
      });

      await manager.abort(queued2.id);
      resolveFirst();
      await flushMicrotasks();

      expect(manager.getInstance(queued1.id)?.status).toBe("done");
      expect(manager.getInstance(queued2.id)).toMatchObject({ status: "done", reason: "aborted" });
    });

    it("returns done instance and transitions running instance to done", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });

      const done = await manager.abort(queued.id);
      expect(done).toBeDefined();
      expect(manager.getInstance(queued.id)?.status).toBe("done");
    });

    it("done instance has reason 'aborted'", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });
      await manager.abort(queued.id);

      const done = manager.getInstance(queued.id);
      expect(done).toMatchObject({ status: "done", reason: "aborted" });
    });

    it("returns undefined on second abort call (already done)", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });
      await manager.abort(queued.id);

      expect(await manager.abort(queued.id)).toBeUndefined();
    });
  });

  describe("steer", () => {
    it("returns undefined for unknown id", async () => {
      expect(await manager.steer("99", "hello")).toBeUndefined();
    });

    it("returns undefined for queued instance", async () => {
      manager = new AgentInstancesManager(1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p", availableTools: [] });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p",
        availableTools: [],
      });

      expect(await manager.steer(queued2.id, "message")).toBeUndefined();
    });

    it("returns running instance", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });

      const result = await manager.steer(queued.id, "pivot now");

      expect(result).toBeDefined();
      expect(result?.status).toBe("running");
    });

    it("returns undefined after instance is done", async () => {
      const queued = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
      });
      await manager.abort(queued.id);

      expect(await manager.steer(queued.id, "too late")).toBeUndefined();
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
      vi.mocked(createAgentSessionFromConfig)
        .mockResolvedValueOnce(firstSession)
        .mockResolvedValueOnce(secondSession);

      manager = new AgentInstancesManager(1);

      const queued1 = await manager.spawn(ctx, template, {
        description: "a",
        prompt: "p1",
        availableTools: [],
      });
      const queued2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p2",
        availableTools: [],
      });

      expect(manager.getInstance(queued1.id)?.status).toBe("running");
      expect(manager.getInstance(queued2.id)?.status).toBe("queued");

      resolveFirst();
      await flushMicrotasks();

      expect(manager.getInstance(queued1.id)?.status).toBe("done");
      expect(manager.getInstance(queued2.id)?.status).toBe("running");
    });

    it("calls onDone when agent finishes", async () => {
      const onComplete = vi.fn();
      let resolvePrompt!: () => void;
      const controllableSession = makeMockSession({
        promptImpl: () =>
          new Promise<void>((res) => {
            resolvePrompt = res;
          }),
      });
      vi.mocked(createAgentSessionFromConfig).mockResolvedValue(controllableSession);

      manager = new AgentInstancesManager(1);
      await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
        onDone: onComplete,
      });

      resolvePrompt();
      await flushMicrotasks();

      expect(onComplete).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ status: "done", reason: "completed" }),
      );
    });

    it("calls onUpdate when tool_execution_start event fires", async () => {
      const onUpdate = vi.fn();
      const captureSubscribe: { handler: EventHandler | null } = { handler: null };
      const eventSession = makeMockSession({ captureSubscribe });
      vi.mocked(createAgentSessionFromConfig).mockResolvedValue(eventSession);

      manager = new AgentInstancesManager(1);
      await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        availableTools: [],
        onUpdate,
      });

      await captureSubscribe.handler?.({
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "bash",
      } as unknown as AgentSessionEvent);

      expect(onUpdate).toHaveBeenCalledOnce();
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "running" }));
    });

    it("starts multiple agents in parallel when maxConcurrent > 1", async () => {
      manager = new AgentInstancesManager(2);

      const q1 = await manager.spawn(ctx, template, {
        description: "a",
        prompt: "p1",
        availableTools: [],
      });
      const q2 = await manager.spawn(ctx, template, {
        description: "b",
        prompt: "p2",
        availableTools: [],
      });
      const q3 = await manager.spawn(ctx, template, {
        description: "c",
        prompt: "p3",
        availableTools: [],
      });

      expect(manager.getInstance(q1.id)?.status).toBe("running");
      expect(manager.getInstance(q2.id)?.status).toBe("running");
      expect(manager.getInstance(q3.id)?.status).toBe("queued");
    });
  });
});

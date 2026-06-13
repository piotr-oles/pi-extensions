import type { AgentSessionEvent, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentInstancesManager, type ManagerPi } from "./agent-instances-manager.js";
import { makeAgentTemplate } from "../test-helpers.js";

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
    prompt: vi.fn().mockImplementation(promptImpl ?? (() => new Promise<void>(() => { }))),
    subscribe: vi.fn().mockImplementation((cb: EventHandler) => {
      if (captureSubscribe) {
        captureSubscribe.handler = cb;
      }
      return () => { };
    }),
    getLastAssistantText: vi.fn().mockReturnValue("done result"),
    getContextUsage: vi.fn().mockReturnValue(undefined),
  };
}

function makeMockPi(): ManagerPi {
  return {
    getActiveTools: vi.fn().mockReturnValue(["read", "write"]),
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
  let pi: ManagerPi;
  let ctx: ExtensionContext;
  let manager: AgentInstancesManager;

  beforeEach(() => {
    session = makeMockSession();
    pi = makeMockPi();
    ctx = makeMockCtx();
    vi.mocked(createAgentSessionFromConfig).mockResolvedValue(session);
    manager = new AgentInstancesManager(pi, 4);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("spawn", () => {
    it("returns distinct ids that can each retrieve their instance", async () => {
      const id1 = await manager.spawn(ctx, template, { description: "a", prompt: "go" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "go" });

      expect(id1).not.toBe(id2);
      expect(manager.getInstance(id1)?.id).toBe(id1);
      expect(manager.getInstance(id2)?.id).toBe(id2);
    });

    it("spawned instance config reflects description and prompt", async () => {
      const id = await manager.spawn(ctx, template, { description: "task", prompt: "work" });

      expect(manager.getInstance(id)?.config.description).toBe("task");
      expect(manager.getInstance(id)?.config.prompt).toBe("work");
    });

    it("instance is 'running' after spawn when capacity is available", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });

      expect(manager.getInstance(id)?.status).toBe("running");
    });

    it("instance is 'queued' when at max capacity", async () => {
      manager = new AgentInstancesManager(pi, 1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p1" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p2" });

      expect(manager.getInstance(id2)?.status).toBe("queued");
    });

    it("spawned instance config includes active tools from pi", async () => {
      vi.mocked(pi.getActiveTools).mockReturnValue(["bash", "read"]);
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });

      expect(manager.getInstance(id)?.config.enabledTools).toContain("bash");
      expect(manager.getInstance(id)?.config.enabledTools).toContain("read");
    });

    it("spawned instance config reflects overrides", async () => {
      const id = await manager.spawn(ctx, template, {
        description: "d",
        prompt: "p",
        overrides: { model: "gpt-4o", maxTurns: 20 },
      });

      expect(manager.getInstance(id)?.config.model).toBe("gpt-4o");
      expect(manager.getInstance(id)?.config.maxTurns).toBe(20);
    });
  });

  describe("getInstance", () => {
    it("returns undefined for unknown id", () => {
      expect(manager.getInstance("99")).toBeUndefined();
    });

    it("returns instance matching the spawned id", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });

      expect(manager.getInstance(id)).toBeDefined();
      expect(manager.getInstance(id)?.id).toBe(id);
    });
  });

  describe("getRunningInstance", () => {
    it("returns undefined for unknown id", () => {
      expect(manager.getRunningInstance("99")).toBeUndefined();
    });

    it("returns running instance", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });

      const running = manager.getRunningInstance(id);
      expect(running).toBeDefined();
      expect(running?.status).toBe("running");
    });

    it("returns undefined for queued instance", async () => {
      manager = new AgentInstancesManager(pi, 1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p" });

      expect(manager.getRunningInstance(id2)).toBeUndefined();
    });

    it("returns undefined after instance is done", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });
      manager.abort(id);

      expect(manager.getRunningInstance(id)).toBeUndefined();
    });
  });

  describe("listInstances", () => {
    it("returns empty array before any spawn", () => {
      expect(manager.listInstances()).toEqual([]);
    });

    it("returns all spawned instances", async () => {
      await manager.spawn(ctx, template, { description: "a", prompt: "p" });
      await manager.spawn(ctx, template, { description: "b", prompt: "p" });

      expect(manager.listInstances()).toHaveLength(2);
    });

    it("sorts by numeric id ascending", async () => {
      const id1 = await manager.spawn(ctx, template, { description: "a", prompt: "p" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p" });
      const id3 = await manager.spawn(ctx, template, { description: "c", prompt: "p" });

      expect(manager.listInstances().map((i) => i.id)).toEqual([id1, id2, id3]);
    });
  });

  describe("abort", () => {
    it("returns false for unknown id", () => {
      expect(manager.abort("99")).toBe(false);
    });

    it("returns true and transitions queued instance to done", async () => {
      manager = new AgentInstancesManager(pi, 1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p" });

      expect(manager.abort(id2)).toBe(true);
      expect(manager.getInstance(id2)).toMatchObject({ status: "done", reason: "aborted" });
    });

    it("calls onComplete when aborting queued instance", async () => {
      const onComplete = vi.fn();
      manager = new AgentInstancesManager(pi, 1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p", onComplete });

      manager.abort(id2);

      expect(onComplete).toHaveBeenCalledOnce();
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({ status: "done", reason: "aborted" }),
      );
    });

    it("aborted queued instance does not start when slot opens", async () => {

      let resolveFirst!: () => void;
      const firstSession = makeMockSession({
        promptImpl: () => new Promise<void>((res) => { resolveFirst = res; }),
      });
      vi.mocked(createAgentSessionFromConfig)
        .mockResolvedValueOnce(firstSession)
        .mockResolvedValueOnce(session);

      manager = new AgentInstancesManager(pi, 1);

      const id1 = await manager.spawn(ctx, template, { description: "a", prompt: "p1" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p2" });

      manager.abort(id2);
      resolveFirst();
      await flushMicrotasks();

      expect(manager.getInstance(id1)?.status).toBe("done");
      expect(manager.getInstance(id2)).toMatchObject({ status: "done", reason: "aborted" });
    });

    it("returns true and transitions instance to done", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });

      expect(manager.abort(id)).toBe(true);
      expect(manager.getInstance(id)?.status).toBe("done");
    });

    it("done instance has reason 'aborted'", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });
      manager.abort(id);

      const done = manager.getInstance(id);
      expect(done).toMatchObject({ status: "done", reason: "aborted" });
    });

    it("returns false on second abort call (already done)", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });
      manager.abort(id);

      expect(manager.abort(id)).toBe(false);
    });
  });

  describe("steer", () => {
    it("returns false for unknown id", async () => {
      expect(await manager.steer("99", "hello")).toBe(false);
    });

    it("returns false for queued instance", async () => {
      manager = new AgentInstancesManager(pi, 1);

      await manager.spawn(ctx, template, { description: "a", prompt: "p" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p" });

      expect(await manager.steer(id2, "message")).toBe(false);
    });

    it("returns true for running instance", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });

      const result = await manager.steer(id, "pivot now");

      expect(result).toBe(true);
    });

    it("returns false after instance is done", async () => {
      const id = await manager.spawn(ctx, template, { description: "d", prompt: "p" });
      manager.abort(id);

      expect(await manager.steer(id, "too late")).toBe(false);
    });
  });

  describe("queue drain", () => {
    it("starts queued agent when running agent completes", async () => {

      let resolveFirst!: () => void;
      const firstSession = makeMockSession({
        promptImpl: () => new Promise<void>((res) => { resolveFirst = res; }),
      });
      const secondSession = makeMockSession();
      vi.mocked(createAgentSessionFromConfig)
        .mockResolvedValueOnce(firstSession)
        .mockResolvedValueOnce(secondSession);

      manager = new AgentInstancesManager(pi, 1);

      const id1 = await manager.spawn(ctx, template, { description: "a", prompt: "p1" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p2" });

      expect(manager.getInstance(id1)?.status).toBe("running");
      expect(manager.getInstance(id2)?.status).toBe("queued");

      resolveFirst();
      await flushMicrotasks();

      expect(manager.getInstance(id1)?.status).toBe("done");
      expect(manager.getInstance(id2)?.status).toBe("running");
    });

    it("calls onComplete when agent finishes", async () => {
      const onComplete = vi.fn();
      let resolvePrompt!: () => void;
      const controllableSession = makeMockSession({
        promptImpl: () => new Promise<void>((res) => { resolvePrompt = res; }),
      });
      vi.mocked(createAgentSessionFromConfig).mockResolvedValue(controllableSession);

      manager = new AgentInstancesManager(pi, 1);
      await manager.spawn(ctx, template, { description: "d", prompt: "p", onComplete });

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

      manager = new AgentInstancesManager(pi, 1);
      await manager.spawn(ctx, template, { description: "d", prompt: "p", onUpdate });

      await captureSubscribe.handler?.({
        type: "tool_execution_start",
        toolCallId: "tc1",
        toolName: "bash",
      } as unknown as AgentSessionEvent);

      expect(onUpdate).toHaveBeenCalledOnce();
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "running" }),
      );
    });

    it("starts multiple agents in parallel when maxConcurrent > 1", async () => {
      manager = new AgentInstancesManager(pi, 2);

      const id1 = await manager.spawn(ctx, template, { description: "a", prompt: "p1" });
      const id2 = await manager.spawn(ctx, template, { description: "b", prompt: "p2" });
      const id3 = await manager.spawn(ctx, template, { description: "c", prompt: "p3" });

      expect(manager.getInstance(id1)?.status).toBe("running");
      expect(manager.getInstance(id2)?.status).toBe("running");
      expect(manager.getInstance(id3)?.status).toBe("queued");
    });
  });
});

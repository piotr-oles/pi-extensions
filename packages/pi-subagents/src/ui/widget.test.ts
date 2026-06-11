import type { AgentSession, ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentConfig } from "../domain/agent-config.js";
import type { AgentInstancesManager } from "../domain/agent-instances-manager.js";
import { AgentTemplate } from "../domain/agent-template.js";
import type { AgentInstance } from "../domain/instance/index.js";
import { QueuedAgentInstance } from "../domain/instance/queued-agent.js";
import { RunningAgentInstance } from "../domain/instance/running-agent.js";
import { AgentWidget } from "./widget.js";

const mockTheme = {
  fg: (_: string, text: string) => text,
  bg: (_: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

const mockSession = {
  getContextUsage: () => undefined,
  getLastAssistantText: () => "",
  messages: [],
  steer: async () => {},
  abort: () => {},
  bindExtensions: async () => {},
  prompt: async () => {},
  subscribe: () => () => {},
} as unknown as AgentSession;

const mockTemplate = new AgentTemplate({
  name: "my-agent",
  description: "",
  instructions: "",
  source: "global",
});

const mockConfig = new AgentConfig({
  template: mockTemplate,
  description: "doing a task",
  prompt: "do something",
  activeTools: [],
});

function makeQueued(id: string) {
  return new QueuedAgentInstance({
    id,
    config: mockConfig,
    session: mockSession,
    signal: undefined,
  });
}

function makeRunning(id: string) {
  return new RunningAgentInstance({ queued: makeQueued(id), startedAt: 0, onDone: () => {} });
}

function makeDone(id: string, completedAt: number) {
  vi.setSystemTime(completedAt);
  return makeRunning(id).done({ reason: "completed" });
}

function makeManager(instances: AgentInstance[]): AgentInstancesManager {
  return { listInstances: () => instances } as unknown as AgentInstancesManager;
}

function makeMockUi() {
  const widgetFactories = new Map<string, ((tui: TUI, theme: Theme) => unknown) | undefined>();
  return {
    setWidget: vi.fn((key: string, factory: ((tui: TUI, theme: Theme) => unknown) | undefined) => {
      widgetFactories.set(key, factory);
    }),
    invokeFactory: (tui: TUI) => {
      const factory = widgetFactories.get("pi-subagents");
      return factory ? factory(tui, mockTheme) : null;
    },
  };
}

function makeMockTui() {
  return { requestRender: vi.fn() } as unknown as TUI;
}

describe("AgentWidget", () => {
  const MOUNT_TIME = 10_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOUNT_TIME);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("getVisibleInstances()", () => {
    it("includes running and queued instances", () => {
      const instances = [makeRunning("1"), makeQueued("2")];
      const widget = new AgentWidget(makeManager(instances));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(makeMockUi() as unknown as ExtensionUIContext);

      expect(widget.getVisibleInstances()).toHaveLength(2);
    });

    it("includes done instances completed after mount", () => {
      const done = makeDone("1", MOUNT_TIME + 1);
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(makeMockUi() as unknown as ExtensionUIContext);

      expect(widget.getVisibleInstances()).toHaveLength(1);
    });

    it("skips done instances completed before mount", () => {
      const done = makeDone("1", MOUNT_TIME - 1);
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(makeMockUi() as unknown as ExtensionUIContext);

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });

    it("skips done instances completed exactly at mount time", () => {
      const done = makeDone("1", MOUNT_TIME);
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(makeMockUi() as unknown as ExtensionUIContext);

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });
  });

  describe("done agent TTL", () => {
    it("keeps done instance visible before 30s", () => {
      const done = makeDone("1", MOUNT_TIME + 1);
      const ui = makeMockUi();
      const tui = makeMockTui();
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(ui as unknown as ExtensionUIContext);
      ui.invokeFactory(tui);

      widget.getVisibleInstances();
      vi.advanceTimersByTime(29_999);

      expect(widget.getVisibleInstances()).toHaveLength(1);
    });

    it("hides done instance after 30s", () => {
      const done = makeDone("1", MOUNT_TIME + 1);
      const ui = makeMockUi();
      const tui = makeMockTui();
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(ui as unknown as ExtensionUIContext);
      ui.invokeFactory(tui);

      widget.getVisibleInstances();
      vi.advanceTimersByTime(30_000);

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });

    it("auto-unmounts when last visible instance is hidden", () => {
      const done = makeDone("1", MOUNT_TIME + 1);
      const ui = makeMockUi();
      const tui = makeMockTui();
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(ui as unknown as ExtensionUIContext);
      ui.invokeFactory(tui);

      widget.getVisibleInstances();
      vi.advanceTimersByTime(30_000);

      expect(ui.setWidget).toHaveBeenLastCalledWith("pi-subagents", undefined);
    });

    it("does not auto-unmount while other instances remain", () => {
      const done = makeDone("1", MOUNT_TIME + 1);
      const running = makeRunning("2");
      const ui = makeMockUi();
      const tui = makeMockTui();
      const widget = new AgentWidget(makeManager([done, running]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(ui as unknown as ExtensionUIContext);
      ui.invokeFactory(tui);

      widget.getVisibleInstances();
      vi.advanceTimersByTime(30_000);

      const lastCall = ui.setWidget.mock.calls.at(-1);
      expect(lastCall?.[1]).not.toBeUndefined();
      expect(tui.requestRender).toHaveBeenCalled();
    });
  });

  describe("unmount()", () => {
    it("cancels pending cleanup timers", () => {
      const done = makeDone("1", MOUNT_TIME + 1);
      const ui = makeMockUi();
      const tui = makeMockTui();
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(ui as unknown as ExtensionUIContext);
      ui.invokeFactory(tui);

      widget.getVisibleInstances();
      widget.unmount(ui as unknown as ExtensionUIContext);

      vi.advanceTimersByTime(30_000);

      // setWidget was called with undefined by unmount, not by the timer
      const undefCalls = ui.setWidget.mock.calls.filter((c) => c[1] === undefined);
      expect(undefCalls).toHaveLength(1);
      expect(tui.requestRender).not.toHaveBeenCalled();
    });
  });

  describe("mount()", () => {
    it("does not reset mountTime on re-mount", () => {
      const done = makeDone("1", MOUNT_TIME - 1);
      const ui = makeMockUi();
      const widget = new AgentWidget(makeManager([done]));
      vi.setSystemTime(MOUNT_TIME);
      widget.mount(ui as unknown as ExtensionUIContext);

      vi.setSystemTime(MOUNT_TIME + 5_000);
      widget.mount(ui as unknown as ExtensionUIContext);

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });
  });
});

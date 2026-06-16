import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentInstance } from "../domain/instance/index.js";
import { makeDone, makeQueued, makeRunning, mockTheme } from "../test-helpers.js";
import type { WidgetUiContext } from "./agents-widget.js";
import { AgentsWidget } from "./agents-widget.js";

function makeMockUi(): WidgetUiContext & {
  setWidget: ReturnType<typeof vi.fn>;
  invokeFactory: (tui: TUI) => unknown;
} {
  const widgetFactories = new Map<
    string,
    ((tui: TUI, theme: typeof mockTheme) => unknown) | undefined
  >();
  return {
    setWidget: vi.fn(
      (key: string, factory: ((tui: TUI, theme: typeof mockTheme) => unknown) | undefined) => {
        widgetFactories.set(key, factory);
      },
    ),
    invokeFactory: (tui: TUI) => {
      const factory = widgetFactories.get("pi-subagents");
      return factory ? factory(tui, mockTheme) : null;
    },
  };
}

function makeMockTui() {
  const requestRender = vi.fn();
  const tui = { requestRender } as unknown as TUI;
  return { tui, requestRender };
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
      const instances: AgentInstance[] = [makeRunning({ id: "1" }), makeQueued({ id: "2" })];
      const widget = new AgentsWidget(() => instances);
      widget.mount(makeMockUi());

      expect(widget.getVisibleInstances()).toHaveLength(2);
    });

    it("includes done instances completed after mount", () => {
      vi.setSystemTime(MOUNT_TIME + 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const widget = new AgentsWidget(() => [done]);
      widget.mount(makeMockUi());

      expect(widget.getVisibleInstances()).toHaveLength(1);
    });

    it("skips done instances completed before mount", () => {
      vi.setSystemTime(MOUNT_TIME - 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const widget = new AgentsWidget(() => [done]);
      widget.mount(makeMockUi());

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });

    it("skips done instances completed exactly at mount time", () => {
      const done = makeDone({ id: "1" });
      const widget = new AgentsWidget(() => [done]);
      widget.mount(makeMockUi());

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });
  });

  describe("done agent TTL", () => {
    it("keeps done instance visible before 30s", () => {
      vi.setSystemTime(MOUNT_TIME + 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const ui = makeMockUi();
      const { tui } = makeMockTui();
      const widget = new AgentsWidget(() => [done]);
      widget.mount(ui);
      ui.invokeFactory(tui);

      widget.requestRender();
      vi.advanceTimersByTime(29_999);

      expect(widget.getVisibleInstances()).toHaveLength(1);
    });

    it("hides done instance after 30s", () => {
      vi.setSystemTime(MOUNT_TIME + 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const ui = makeMockUi();
      const { tui } = makeMockTui();
      const widget = new AgentsWidget(() => [done]);
      widget.mount(ui);
      ui.invokeFactory(tui);

      widget.requestRender();
      vi.advanceTimersByTime(30_000);

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });

    it("auto-unmounts when last visible instance is hidden", () => {
      vi.setSystemTime(MOUNT_TIME + 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const ui = makeMockUi();
      const { tui } = makeMockTui();
      const widget = new AgentsWidget(() => [done]);
      widget.mount(ui);
      ui.invokeFactory(tui);

      widget.requestRender();
      vi.advanceTimersByTime(30_000);

      expect(ui.setWidget).toHaveBeenLastCalledWith("pi-subagents", undefined);
    });

    it("does not auto-unmount while other instances remain", () => {
      vi.setSystemTime(MOUNT_TIME + 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const running = makeRunning({ id: "2" });
      const ui = makeMockUi();
      const { tui, requestRender } = makeMockTui();
      const widget = new AgentsWidget(() => [done, running]);
      widget.mount(ui);
      ui.invokeFactory(tui);

      widget.requestRender();
      vi.advanceTimersByTime(30_000);

      const lastCall = ui.setWidget.mock.calls.at(-1);
      expect(lastCall?.[1]).not.toBeUndefined();
      expect(requestRender).toHaveBeenCalled();
    });
  });

  describe("unmount()", () => {
    it("cancels pending cleanup timers", () => {
      vi.setSystemTime(MOUNT_TIME + 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const ui = makeMockUi();
      const { tui, requestRender } = makeMockTui();
      const widget = new AgentsWidget(() => [done]);
      widget.mount(ui);
      ui.invokeFactory(tui);

      widget.requestRender();
      widget.unmount(ui);
      requestRender.mockClear();

      vi.advanceTimersByTime(30_000);

      // setWidget called with undefined only by unmount, not by cancelled timer
      const undefCalls = ui.setWidget.mock.calls.filter((c) => c[1] === undefined);
      expect(undefCalls).toHaveLength(1);
      expect(requestRender).not.toHaveBeenCalled();
    });
  });

  describe("mount()", () => {
    it("does not reset mountTime on re-mount", () => {
      vi.setSystemTime(MOUNT_TIME - 1);
      const done = makeDone({ id: "1" });
      vi.setSystemTime(MOUNT_TIME);
      const ui = makeMockUi();
      const widget = new AgentsWidget(() => [done]);
      widget.mount(ui);

      vi.setSystemTime(MOUNT_TIME + 5_000);
      widget.mount(ui);

      expect(widget.getVisibleInstances()).toHaveLength(0);
    });
  });
});

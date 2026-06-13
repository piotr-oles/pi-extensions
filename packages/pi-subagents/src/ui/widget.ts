import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { AgentInstance } from "../domain/instance/index.js";

export interface WidgetUiContext {
  setWidget(
    key: string,
    factory: ((tui: TUI, theme: Theme) => Component & { dispose?(): void }) | undefined,
  ): void;
}
import { AgentListComponent } from "./components/agent-list-component.js";

const DONE_TTL_MS = 30_000;

export class AgentWidget {
  private mountTime = 0;
  private ui: WidgetUiContext | null = null;
  private tui: TUI | null = null;
  private list: AgentListComponent | null = null;

  private readonly hiddenDoneIds = new Set<string>();
  private readonly cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly getInstances: () => AgentInstance[]) { }

  getVisibleInstances(): AgentInstance[] {
    return this.getInstances().filter((inst) => {
      if (inst.status !== "done") {
        return true;
      }
      if (inst.doneAt <= this.mountTime) {
        return false;
      }
      return !this.hiddenDoneIds.has(inst.id);
    });
  }

  private scheduleDoneTtl(instances: AgentInstance[]): void {
    for (const inst of instances) {
      if (inst.status === "done" && !this.cleanupTimers.has(inst.id)) {
        const id = inst.id;
        const timer = setTimeout(() => {
          this.hiddenDoneIds.add(id);
          this.cleanupTimers.delete(id);
          this.onInstanceHidden();
        }, DONE_TTL_MS);
        this.cleanupTimers.set(inst.id, timer);
      }
    }
  }

  private onInstanceHidden(): void {
    if (this.getVisibleInstances().length === 0 && this.ui) {
      this.unmount(this.ui);
    } else {
      this.tui?.requestRender();
    }
  }

  mount(ui: WidgetUiContext): void {
    if (this.ui === null) {
      this.mountTime = Date.now();
    }
    this.ui = ui;
    ui.setWidget("pi-subagents", (tui: TUI, theme: Theme) => {
      const list = new AgentListComponent(() => this.getVisibleInstances(), tui, theme);
      this.tui = tui;
      this.list = list;
      return list;
    });
  }

  requestRender(): void {
    this.scheduleDoneTtl(this.getVisibleInstances());
    this.tui?.requestRender();
  }

  unmount(ui: WidgetUiContext): void {
    this.list?.dispose();
    ui.setWidget("pi-subagents", undefined);
    this.ui = null;
    this.tui = null;
    this.list = null;
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
  }
}

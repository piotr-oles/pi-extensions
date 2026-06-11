import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import type {
  AgentInstance,
  DoneAgentInstance,
  RunningAgentInstance,
} from "../../domain/instance/index.js";
import { DoneAgentRow } from "./done-agent-row.js";
import { RunningAgentRow } from "./running-agent-row.js";

export class AgentListComponent extends Container {
  private readonly headerText: Text;
  private readonly queuedText: Text;
  private readonly runningRows = new Map<string, RunningAgentRow>();
  private readonly doneRows = new Map<string, DoneAgentRow>();

  constructor(
    private readonly getInstances: () => AgentInstance[],
    private readonly tui: TUI,
    private readonly theme: Theme,
  ) {
    super();
    this.headerText = new Text(theme.fg("accent", "● Subagents"), 0, 0);
    this.queuedText = new Text("", 0, 0);
  }

  dispose(): void {
    for (const row of this.runningRows.values()) {
      row.stop();
    }
  }

  private sync(): void {
    const all = this.getInstances();

    if (all.length === 0) {
      this.clear();
      return;
    }

    const running = all.filter((i): i is RunningAgentInstance => i.status === "running");
    const done = all.filter((i): i is DoneAgentInstance => i.status === "done");
    const queuedCount = all.filter((i) => i.status === "queued").length;

    for (const inst of running) {
      const existing = this.runningRows.get(inst.id);
      if (existing) {
        existing.update(inst);
      } else {
        this.runningRows.set(inst.id, new RunningAgentRow(inst, this.tui, this.theme));
      }
    }

    for (const [id, row] of this.runningRows) {
      if (!running.some((i) => i.id === id)) {
        row.stop();
        this.runningRows.delete(id);
      }
    }

    for (const inst of done) {
      if (!this.doneRows.has(inst.id)) {
        this.doneRows.set(inst.id, new DoneAgentRow(inst, this.theme));
      }
    }

    this.clear();
    this.addChild(this.headerText);
    for (const inst of running) {
      const row = this.runningRows.get(inst.id);
      if (row) {
        this.addChild(row);
      }
    }
    for (const inst of done) {
      const row = this.doneRows.get(inst.id);
      if (row) {
        this.addChild(row);
      }
    }

    if (queuedCount > 0) {
      this.queuedText.setText(this.theme.fg("dim", `   ${queuedCount} queued`));
      this.addChild(this.queuedText);
    }
  }

  override render(width: number): string[] {
    this.sync();
    return super.render(width);
  }

  override invalidate(): void {
    this.headerText.setText(this.theme.fg("accent", "● Agents"));
    this.headerText.invalidate();
    for (const row of this.runningRows.values()) {
      row.invalidate();
    }
    for (const row of this.doneRows.values()) {
      row.invalidate();
    }
    super.invalidate();
  }
}

import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { DoneAgentInstance, DoneReason } from "../../domain/instance/index.js";
import { formatDuration, formatUsage } from "../format.js";

export class DoneAgentRow implements Component {
  private readonly text: Text;

  constructor(
    private instance: DoneAgentInstance,
    private theme: Theme,
  ) {
    this.text = new Text("", 0, 0);
    this.rebuild(instance);
  }

  render(width: number): string[] {
    return this.text.render(width);
  }

  invalidate(): void {
    this.rebuild(this.instance);
    this.text.invalidate();
  }

  private rebuild(instance: DoneAgentInstance): void {
    const usage = instance.session.getContextUsage();
    const description = truncateToWidth(instance.config.description, 25);
    const icon = this.doneIcon(this.instance.reason);
    const parts = [`${icon} #${instance.id} ${instance.name}`, this.theme.fg("dim", description)];
    if (usage?.tokens) {
      parts.push(this.theme.fg("dim", formatUsage(usage)));
    }
    parts.push(this.theme.fg("dim", formatDuration(this.instance.duration)));
    this.text.setText(parts.join(" · "));
  }

  private doneIcon(reason: DoneReason): string {
    switch (reason) {
      case "completed":
        return this.theme.fg("success", "✓");
      case "stopped":
        return this.theme.fg("dim", "■");
      default:
        return this.theme.fg("error", "✗");
    }
  }
}

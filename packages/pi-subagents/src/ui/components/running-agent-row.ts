import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { Loader, truncateToWidth } from "@earendil-works/pi-tui";
import type { RunningAgentInstance } from "../../domain/instance/index.js";
import { formatUsage } from "../format.js";

export class RunningAgentRow implements Component {
  private readonly loader: Loader;
  private readonly theme: Theme;

  constructor(instance: RunningAgentInstance, tui: TUI, theme: Theme) {
    this.theme = theme;
    this.loader = new Loader(
      tui,
      (spinner) => `${theme.fg("accent", spinner)}`,
      (msg) => msg,
    );
    this.rebuild(instance);
  }

  update(instance: RunningAgentInstance): void {
    this.rebuild(instance);
  }

  stop(): void {
    this.loader.stop();
  }

  invalidate(): void {
    this.loader.invalidate();
  }

  render(width: number): string[] {
    return this.loader
      .render(width)
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }

  private rebuild(instance: RunningAgentInstance): void {
    const usage = instance.session.getContextUsage();
    const description = truncateToWidth(instance.config.description, 25);
    const parts = [`#${instance.id} ${instance.config.name}`, this.theme.fg("dim", description)];
    if (usage?.tokens) {
      parts.push(this.theme.fg("dim", formatUsage(usage)));
    }
    this.loader.setMessage(parts.join(" · "));
  }
}

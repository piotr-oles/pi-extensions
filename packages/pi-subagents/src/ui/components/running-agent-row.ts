import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { RunningAgentInstance } from "../../domain/instance/index.js";
import { formatUsage } from "../format.js";
import { InlineContainer } from "./inline-container.js";
import { InlineLoader } from './inline-loader.js'

export class RunningAgentRow implements Component {
  private readonly text: Text;
  private readonly loader: InlineLoader;
  private readonly container: InlineContainer;
  private readonly theme: Theme;

  constructor(instance: RunningAgentInstance, tui: TUI, theme: Theme) {
    this.container = new InlineContainer();
    this.loader = new InlineLoader(
      tui,
      (spinner) => `${theme.fg("accent", spinner)}`,
    );
    this.text = new Text('', 0, 0);

    this.container.addChild(this.loader);
    this.container.addChild(this.text);

    this.theme = theme;
    this.rebuild(instance);
  }

  update(instance: RunningAgentInstance): void {
    this.rebuild(instance);
  }

  stop(): void {
    this.loader.stop();
  }

  invalidate(): void {
    this.container.invalidate();
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  private rebuild(instance: RunningAgentInstance): void {
    const usage = instance.session.getContextUsage();
    const description = truncateToWidth(instance.config.description, 25);
    const parts = [`#${instance.id} ${instance.config.name}`, this.theme.fg("dim", description)];
    if (usage?.tokens) {
      parts.push(this.theme.fg("dim", formatUsage(usage)));
    }
    this.text.setText(parts.join(" · "));
  }
}

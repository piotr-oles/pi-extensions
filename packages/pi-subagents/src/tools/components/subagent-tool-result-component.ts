import {
  DynamicBorder,
  getMarkdownTheme,
  type Theme,
} from "@earendil-works/pi-coding-agent";
import { type Component, Container, Markdown, Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { AgentInstanceSessionEntry } from "../../domain/types.js";
import { InlineContainer } from "../../ui/components/inline-container.js";
import { formatDuration, formatUsage } from "../../ui/format.js";

export class SubagentToolResultComponent implements Component {
  private readonly container: InlineContainer;
  private readonly icon: StatusIcon;
  private readonly text: StatusText;

  constructor(
    private entry: AgentInstanceSessionEntry,
    private theme: Theme,
    private expanded: boolean,
    onInvalidate: () => void,
  ) {
    this.container = new InlineContainer();
    this.icon = new StatusIcon(entry, theme, onInvalidate);
    this.text = new StatusText(entry, theme);

    this.container.addChild(this.icon);
    this.container.addChild(this.text);
  }

  update(
    entry: AgentInstanceSessionEntry,
    theme: Theme,
    expanded: boolean,
    onInvalidate: () => void,
  ): void {
    this.entry = entry;
    this.theme = theme;
    this.expanded = expanded;
    this.icon.update(entry, theme, onInvalidate);
    this.text.update(entry, theme);
    this.container.invalidate();
  }

  render(width: number): string[] {
    const { expanded, theme, entry } = this;
    if (expanded && entry.status === "done" && entry.result) {
      const details = new Container();
      details.addChild(new DynamicBorder());

      if (entry.status === "done" && entry.result) {
        details.addChild(new Markdown(entry.result.trim(), 0, 1, getMarkdownTheme()));
      }

      const config = {
        "Available Tools": entry.config.enabledTools.join(", "),
        Turns: entry.turns,
        "Max Turns": entry.config.maxTurns,
        "Grace Turns": entry.config.graceTurns,
        Steered: entry.steered,
      };
      details.addChild(
        new Text(
          Object.entries(config)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `${theme.fg("dim", key)}: ${value}`)
            .join("\n"),
          0,
          1,
        ),
      );

      return [...details.render(width), ...this.container.render(width)];
    }
    return this.container.render(width);
  }

  invalidate() {
    return this.container.invalidate();
  }
}

class StatusText implements Component {
  constructor(
    private entry: AgentInstanceSessionEntry,
    private theme: Theme,
  ) { }

  update(entry: AgentInstanceSessionEntry, theme: Theme) {
    this.entry = entry;
    this.theme = theme;
  }

  render(width: number): string[] {
    return [truncateToWidth(this.text(), width, '', true)];
  }

  invalidate() { }

  private text(): string {
    const { theme, entry } = this;

    switch (entry.status) {
      case "queued":
        return theme.fg("dim", "queued...");
      case "running": {
        const parts: string[] = [];
        parts.push(theme.fg("dim", formatUsage(entry.usage)));
        if (entry.runningTools.length) {
          parts.push(theme.fg("dim", entry.runningTools.join(", ")));
        } else if (entry.lastMessage && entry.lastMessage.length) {
          const lastMessageTail = entry.lastMessage.at(-1)!;
          switch (lastMessageTail.type) {
            case 'text':
              parts.push(theme.fg('dim', lastMessageTail.text.trim().replaceAll('\n', ' ')))
              break;
            case 'thinking':
              parts.push(theme.italic(theme.fg('dim', lastMessageTail.thinking.trim().replaceAll('\n', ' '))))
              break;
          }
        }
        return parts.join(" · ");
      }
      case "done": {
        const parts: string[] = [];
        if (entry.error) {
          parts.push(theme.fg("error", entry.error));
        }
        parts.push(theme.fg("dim", formatUsage(entry.usage)));
        parts.push(theme.fg("dim", formatDuration(entry.duration)));

        return parts.join(" · ");
      }
    }
  }
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

class StatusIcon implements Component {
  private frameIndex = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private entry: AgentInstanceSessionEntry,
    private theme: Theme,
    private onInvalidate: () => void,
  ) {
    this.syncAnimation();
  }

  update(instance: AgentInstanceSessionEntry, theme: Theme, onInvalidate: () => void) {
    this.entry = instance;
    this.theme = theme;
    this.onInvalidate = onInvalidate;
    this.syncAnimation();
  }

  render(width: number): string[] {
    return [truncateToWidth(this.icon(), width)];
  }

  invalidate() { }

  private syncAnimation(): void {
    if (this.entry.status === "running") {
      this.startAnimation();
    } else {
      this.stopAnimation();
    }
  }

  private startAnimation(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.frameIndex++;
      this.onInvalidate();
    }, SPINNER_INTERVAL_MS);
  }

  private stopAnimation(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private icon(): string {
    const { theme, entry } = this;

    switch (entry.status) {
      case "queued":
        return theme.fg("dim", "◌");
      case "running":
        return theme.fg(entry.steered ? "warning" : "accent", SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length] ?? "⠋");
      case "done": {
        switch (entry.reason) {
          case "completed":
            return theme.fg(entry.steered ? "warning" : "success", "✓");
          case "stopped":
            return theme.fg("error", "■");
          default:
            return theme.fg("error", "✗");
        }
      }
    }
  }
}

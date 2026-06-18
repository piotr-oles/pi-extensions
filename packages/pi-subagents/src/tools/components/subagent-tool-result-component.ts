import type { AssistantMessage, ToolCall } from "@earendil-works/pi-ai";
import { DynamicBorder, getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Markdown, Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { DoneSubagentSessionEntry } from "../../domain/instance/done-subagent.js";
import type { RunningAgentSessionEntry } from "../../domain/instance/running-subagent.js";
import type { SubagentSessionEntry } from "../../domain/types.js";
import { formatDuration, formatFilePath, formatUsage, getFirstLine } from "../../format.js";
import { InlineContainer } from "./inline-container.js";

export class SubagentToolResultComponent implements Component {
  private readonly summary: SubagentSummaryComponent;
  private readonly details: SubagentDetailsComponent;
  private readonly border: DynamicBorder;
  private expanded: boolean;

  constructor(
    entry: SubagentSessionEntry,
    theme: Theme,
    expanded: boolean,
    onInvalidate: () => void,
  ) {
    this.summary = new SubagentSummaryComponent(entry, theme, onInvalidate);
    this.details = new SubagentDetailsComponent(entry, theme);
    this.expanded = expanded;
    this.border = new DynamicBorder((s) => theme.fg("muted", s));
  }

  update(
    entry: SubagentSessionEntry,
    theme: Theme,
    expanded: boolean,
    onInvalidate: () => void,
  ): void {
    this.expanded = expanded;
    this.summary.update(entry, theme, onInvalidate);
    this.summary.invalidate();
    if (expanded) {
      this.details.update(entry, theme);
      this.details.invalidate();
    }
  }

  render(width: number): string[] {
    const { expanded } = this;
    if (expanded) {
      return [
        ...this.border.render(width),
        ...this.summary.render(width),
        ...this.details.render(width),
      ];
    }
    return this.summary.render(width);
  }

  invalidate() {
    this.summary.invalidate();
    this.details.invalidate();
  }
}

class SubagentSummaryComponent implements Component {
  private readonly container: InlineContainer;
  private readonly icon: SubagentIconComponent;
  private readonly text: SubagentSummaryTextComponent;

  constructor(entry: SubagentSessionEntry, theme: Theme, onInvalidate: () => void) {
    this.container = new InlineContainer();
    this.icon = new SubagentIconComponent(entry, theme, onInvalidate);
    this.text = new SubagentSummaryTextComponent(entry, theme);
    this.container.addChild(this.icon);
    this.container.addChild(this.text);
  }

  update(entry: SubagentSessionEntry, theme: Theme, onInvalidate: () => void): void {
    this.icon.update(entry, theme, onInvalidate);
    this.text.update(entry, theme);
    this.container.invalidate();
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  invalidate() {
    this.container.invalidate();
  }
}

class SubagentDetailsComponent implements Component {
  private readonly done: DoneSubagentDetailsComponent;
  private readonly footer: Text;
  private entry: SubagentSessionEntry;
  private theme: Theme;

  constructor(entry: SubagentSessionEntry, theme: Theme) {
    this.entry = entry;
    this.theme = theme;
    this.done = new DoneSubagentDetailsComponent(entry.status === "done" ? entry : undefined);
    this.footer = new Text(this.footerText());
  }

  update(entry: SubagentSessionEntry, theme: Theme): void {
    this.entry = entry;
    this.theme = theme;
    switch (entry.status) {
      case "queued":
      case "running":
        break;
      case "done":
        this.done.update(entry);
        this.done.invalidate();
        break;
    }
    this.footer.setText(this.footerText());
  }

  render(width: number): string[] {
    const { entry } = this;

    switch (entry.status) {
      case "queued":
      case "running":
        return [...this.footer.render(width)];
      case "done":
        return [...this.done.render(width), "", ...this.footer.render(width)];
    }
  }

  invalidate() {
    this.done.invalidate();
  }

  private footerText(): string {
    const { entry, theme } = this;
    if (entry.sessionFile) {
      return `${theme.fg("muted", `To open this session:`)} pi --session ${formatFilePath(entry.sessionFile)}`;
    }
    return "";
  }
}

class DoneSubagentDetailsComponent implements Component {
  private readonly markdown: Markdown;

  constructor(entry: DoneSubagentSessionEntry | undefined) {
    this.markdown = new Markdown(
      entry?.result.status === "completed" ? entry.result.message : "",
      0,
      1,
      getMarkdownTheme(),
    );
  }

  update(entry: DoneSubagentSessionEntry): void {
    this.markdown.setText(entry.result.status === "completed" ? entry.result.message : "");
    this.markdown.invalidate();
  }

  render(width: number): string[] {
    return this.markdown.render(width);
  }

  invalidate() {
    this.markdown.invalidate();
  }
}

class SubagentSummaryTextComponent implements Component {
  private entry: SubagentSessionEntry;
  private theme: Theme;

  constructor(entry: SubagentSessionEntry, theme: Theme) {
    this.entry = entry;
    this.theme = theme;
  }

  update(entry: SubagentSessionEntry, theme: Theme) {
    this.entry = entry;
    this.theme = theme;
  }

  render(width: number): string[] {
    return [truncateToWidth(this.text(), width, "", true)];
  }

  invalidate() {}

  private text(): string {
    const { entry } = this;
    switch (entry.status) {
      case "queued":
        return this.queuedText();
      case "running":
        return this.runningText(entry);
      case "done":
        return this.doneText(entry);
    }
  }

  private queuedText(): string {
    const { theme } = this;
    return theme.fg("dim", "queued");
  }

  private runningText(running: RunningAgentSessionEntry): string {
    const { theme } = this;
    const parts: string[] = [];
    parts.push(theme.fg("dim", formatUsage(running.usage)));
    if (running.lastMessage) {
      const activity = this.lastActivity(running.lastMessage);
      if (activity) {
        parts.push(activity);
      }
    }
    return parts.join(" · ");
  }

  private lastActivity(message: AssistantMessage): string | undefined {
    const { theme } = this;
    const tail = message.content.at(-1);
    if (!tail) {
      return undefined;
    }

    switch (tail.type) {
      case "text":
        return theme.fg("dim", getFirstLine(tail.text).slice(0, 100));
      case "thinking":
        return theme.italic(theme.fg("dim", getFirstLine(tail.thinking).slice(0, 100)));
      case "toolCall": {
        return this.toolActivity(tail);
      }
    }
  }

  private toolActivity(call: ToolCall): string | undefined {
    const { theme } = this;
    switch (call.name) {
      case "bash":
        return theme.fg("dim", getFirstLine(call.arguments.command || "bash"));
      case "read":
      case "write":
      case "edit":
        return theme.fg(
          "dim",
          call.arguments.path
            ? getFirstLine(`${call.name} ${call.arguments.path}`)
            : getFirstLine(call.name),
        );
      case "subagent":
        return theme.fg(
          "dim",
          call.arguments.name
            ? getFirstLine(
                `${call.name} ${call.arguments.name} ${call.arguments.description ?? ""}`,
              )
            : getFirstLine(call.name),
        );
      default:
        return theme.fg("dim", getFirstLine(call.name));
    }
  }

  private doneText(done: DoneSubagentSessionEntry): string {
    const { theme } = this;
    const parts: string[] = [];
    if (done.result.status === "error") {
      parts.push(theme.fg("error", done.result.error));
    }
    if (done.result.status === "aborted") {
      parts.push(theme.fg("dim", "cancelled"));
    } else if (done.result.status === "exceeded_limit") {
      parts.push(theme.fg("dim", "exceeded limit"));
    }
    parts.push(theme.fg("dim", formatUsage(done.usage)));
    parts.push(theme.fg("dim", formatDuration(done.duration)));
    return parts.join(" · ");
  }
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

class SubagentIconComponent implements Component {
  private frameIndex = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private entry: SubagentSessionEntry;
  private theme: Theme;
  private onInvalidate: () => void;

  constructor(entry: SubagentSessionEntry, theme: Theme, onInvalidate: () => void) {
    this.entry = entry;
    this.theme = theme;
    this.onInvalidate = onInvalidate;
    this.syncAnimation();
  }

  update(entry: SubagentSessionEntry, theme: Theme, onInvalidate: () => void) {
    this.entry = entry;
    this.theme = theme;
    this.onInvalidate = onInvalidate;
    this.syncAnimation();
  }

  render(width: number): string[] {
    return [truncateToWidth(this.icon(), width)];
  }

  invalidate() {}

  private syncAnimation(): void {
    if (this.entry.status === "running") {
      this.startAnimation();
    } else {
      this.stopAnimation();
    }
  }

  private startAnimation(): void {
    if (this.interval) {
      return;
    }
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
        return theme.fg(
          entry.steered ? "warning" : "accent",
          SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length] ?? "⠋",
        );
      case "done": {
        switch (entry.result.status) {
          case "completed":
            return theme.fg(
              entry.result.steered ? "warning" : "success",
              entry.result.steered ? "⚠" : "✓",
            );
          case "aborted":
            return theme.fg("error", "■");
          default:
            return theme.fg("error", "✗");
        }
      }
    }
  }
}

import type { Theme } from "@earendil-works/pi-coding-agent";
import { Box, type Component, Container, matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import type { SubagentTemplate } from "../../domain/subagent-template.js";
import { formatFilePath } from "../../format.js";

const MAX_INSTRUCTION_LINES = 8;
const KEY_COLUMN_WIDTH = 14;

const THINKING_LEVEL_COLORS = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  xhigh: "thinkingXhigh",
} as const;

export class SubagentTemplateDetailsComponent implements Component {
  private readonly container: Container;

  onBack?: () => void;
  onConfirm?: (template: SubagentTemplate) => void;

  constructor(
    private readonly template: SubagentTemplate,
    private readonly theme: Theme,
  ) {
    this.container = new Container();

    const model = this.template.model ?? "inherit";
    const heading = `${this.theme.bold(this.theme.fg("accent", this.template.name))} · ${this.theme.fg("dim", model)}`;
    this.container.addChild(new Text(heading, 1, 0));

    if (this.template.filePath) {
      this.container.addChild(
        new Text(this.theme.fg("dim", formatFilePath(this.template.filePath)), 1, 0),
      );
    }

    this.container.addChild(new Spacer(1));

    this.container.addChild(new Text(this.theme.bold("Description"), 1, 0));
    const desc = this.template.description || "(no description)";
    const descBox = new Box(2, 0);
    descBox.addChild(new Text(this.theme.fg("text", desc), 0, 0));
    this.container.addChild(descBox);

    this.container.addChild(new Spacer(1));

    this.container.addChild(new Text(this.theme.bold("Configuration"), 1, 0));
    this.container.addChild(new DetailsRow("Model", model, this.theme));

    if (this.template.thinkingLevel !== undefined) {
      const levelColor = THINKING_LEVEL_COLORS[this.template.thinkingLevel] ?? "thinkingMedium";
      const levelStyled = this.theme.fg(levelColor, this.template.thinkingLevel);
      this.container.addChild(new DetailsRow("Thinking", levelStyled, this.theme));
    }

    if (this.template.maxTurns !== undefined) {
      this.container.addChild(
        new DetailsRow("Max turns", String(this.template.maxTurns), this.theme),
      );
    }

    if (this.template.graceTurns !== undefined) {
      this.container.addChild(
        new DetailsRow("Grace turns", String(this.template.graceTurns), this.theme),
      );
    }

    if (this.template.excludedTools.length > 0) {
      this.container.addChild(
        new DetailsRow("Excluded", this.template.excludedTools.join(", "), this.theme),
      );
    }

    if (this.template.instructions.trim().length > 0) {
      this.container.addChild(new Spacer(1));
      this.container.addChild(new Text(this.theme.bold("Instructions"), 1, 0));
      this.container.addChild(new InstructionsPreview(this.template.instructions, this.theme));
    }

    this.container.addChild(new Spacer(1));
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.onBack?.();
    } else if (matchesKey(data, "enter")) {
      this.onConfirm?.(this.template);
    }
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  invalidate(): void {
    this.container.invalidate();
  }
}

class DetailsRow implements Component {
  private readonly box: Box;

  constructor(key: string, value: string, theme: Theme) {
    this.box = new Box(2, 0);
    const paddedKey = theme.fg("dim", key.padEnd(KEY_COLUMN_WIDTH));
    this.box.addChild(new Text(`${paddedKey}${value}`, 0, 0));
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}

class InstructionsPreview implements Component {
  private readonly box: Box;

  constructor(instructions: string, theme: Theme) {
    this.box = new Box(2, 0);

    const lines = instructions.split("\n");
    const truncated = lines.length > MAX_INSTRUCTION_LINES;
    const visible = truncated ? lines.slice(0, MAX_INSTRUCTION_LINES) : lines;

    for (const line of visible) {
      this.box.addChild(new Text(theme.fg("dim", line), 0, 0));
    }

    if (truncated) {
      this.box.addChild(new Text(theme.fg("dim", "… (truncated)"), 0, 0));
    }
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}

import type { Theme } from "@earendil-works/pi-coding-agent";
import { Box, type Component, getKeybindings, Text, truncateToWidth } from "@earendil-works/pi-tui";
import type { SubagentTemplate } from "../../domain/subagent-template.js";

const MAX_VISIBLE = 8;

export class SubagentTemplatesListComponent implements Component {
  private readonly templates: SubagentTemplate[];
  private readonly rows: SubagentTemplateOptionComponent[];
  private readonly theme: Theme;
  private selectedIndex = 0;
  private maxVisible: number;

  onOpen?: (template: SubagentTemplate) => void;
  onCancel?: () => void;

  constructor(templates: SubagentTemplate[], theme: Theme, maxVisible = MAX_VISIBLE) {
    this.templates = templates;
    this.theme = theme;
    this.rows = templates.map(
      (template, i) => new SubagentTemplateOptionComponent(template, theme, i === 0),
    );
    this.maxVisible = maxVisible;
  }

  handleInput(data: string): void {
    const kb = getKeybindings();
    const rows = this.rows;

    if (kb.matches(data, "tui.select.up")) {
      rows[this.selectedIndex]?.setSelected(false);
      this.selectedIndex = this.selectedIndex === 0 ? rows.length - 1 : this.selectedIndex - 1;
      rows[this.selectedIndex]?.setSelected(true);
    } else if (kb.matches(data, "tui.select.down")) {
      rows[this.selectedIndex]?.setSelected(false);
      this.selectedIndex = this.selectedIndex === rows.length - 1 ? 0 : this.selectedIndex + 1;
      rows[this.selectedIndex]?.setSelected(true);
    } else if (kb.matches(data, "tui.select.confirm")) {
      const template = this.templates[this.selectedIndex];
      if (template) {
        this.onOpen?.(template);
      }
    } else if (kb.matches(data, "tui.select.cancel")) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    const lines: string[] = [];
    const rows = this.rows;

    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), rows.length - this.maxVisible),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, rows.length);

    for (let i = startIndex; i < endIndex; i++) {
      const row = rows[i];
      if (row) {
        lines.push(...row.render(width));
      }
    }

    if (startIndex > 0 || endIndex < rows.length) {
      const scrollText = `  (${this.selectedIndex + 1}/${rows.length})`;
      lines.push(this.theme.fg("dim", truncateToWidth(scrollText, width - 2, "")));
    }

    return lines;
  }

  invalidate(): void {
    for (const row of this.rows) {
      row.invalidate();
    }
  }
}

class SubagentTemplateOptionComponent implements Component {
  private readonly box: Box;
  private readonly heading: Text;

  constructor(
    private readonly template: SubagentTemplate,
    private readonly theme: Theme,
    private selected: boolean,
  ) {
    this.selected = selected;
    this.box = new Box(0, 1, (s) => (this.selected ? theme.bg("selectedBg", s) : s));
    this.heading = new Text(this.headingText(selected), 0, 0);
    this.box.addChild(this.heading);

    const desc = template.enabled ? template.description || "(no description)" : "(disabled)";
    this.box.addChild(new Text(theme.fg("dim", `${desc}`), 2, 0));
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.heading.setText(this.headingText(selected));
  }

  private headingText(selected: boolean): string {
    const prefix = selected ? this.theme.fg("accent", "›") : " ";
    const nameColor = this.template.enabled ? "accent" : "dim";
    const name = this.theme.bold(this.theme.fg(nameColor, this.template.name));
    const model = this.theme.fg("dim", this.template.model ?? "inherit");
    return `${prefix} ${name} · ${model}`;
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}

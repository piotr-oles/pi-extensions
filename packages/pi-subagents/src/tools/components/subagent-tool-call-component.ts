import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import type { SubagentToolParamsType } from "../types.js";
import { truncateToolLine } from "./truncate-tool-line.js";

export class SubagentToolCallComponent implements Component {
  constructor(
    private params: Partial<SubagentToolParamsType>,
    private theme: Theme,
    private expanded: boolean,
  ) {}

  update(params: Partial<SubagentToolParamsType>, theme: Theme, expanded: boolean): void {
    this.params = params;
    this.theme = theme;
    this.expanded = expanded;
  }

  render(width: number): string[] {
    const theme = this.theme;
    const expanded = this.expanded;
    const params = this.params;
    const toolTitle = theme.fg("toolTitle", "subagent");
    const id = params.id ? theme.fg("syntaxNumber", `#${params.id}`) : undefined;
    const name = params.name ? theme.fg("accent", params.name) : undefined;
    const description = params.description ? theme.fg("dim", params.description) : undefined;
    const title = [toolTitle, id, name, description].filter(Boolean).join(" ");
    const header = truncateToolLine(title, width);

    if (expanded && params.prompt) {
      const prompt = new Text(theme.fg("dim", params.prompt.trim()), 0, 1);
      return [header, ...prompt.render(width)];
    }
    return [header];
  }

  invalidate() {}
}

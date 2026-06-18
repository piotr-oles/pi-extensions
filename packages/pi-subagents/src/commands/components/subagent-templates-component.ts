import type { Theme } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Spacer, Text, type TUI } from "@earendil-works/pi-tui";
import type { SubagentTemplate } from "../../domain/subagent-template.js";
import { SubagentTemplateDetailsComponent } from "./subagent-template-details-component.js";
import { SubagentTemplatesListComponent } from "./subagent-templates-list-component.js";

type MenuMode = "list" | "detail";

export class SubagentTemplatesComponent implements Component {
  private readonly header: Text;
  private readonly listContainer: Container;
  private readonly listSelect: SubagentTemplatesListComponent;
  private readonly detailContainer: Container;
  private readonly listFooter: Text;
  private readonly detailFooter: Text;
  private readonly border: DynamicBorder;
  private detail: SubagentTemplateDetailsComponent | undefined;
  private mode: MenuMode = "list";

  onClose?: () => void;
  onSelect?: (template: SubagentTemplate) => void;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    templates: SubagentTemplate[],
  ) {
    this.listSelect = new SubagentTemplatesListComponent(templates, theme);
    this.listSelect.onCancel = () => this.onClose?.();
    this.listSelect.onOpen = (template) => this.openDetail(template);

    this.header = new Text(theme.fg("mdHeading", "Subagent Templates"), 1, 0);
    this.listFooter = new Text(theme.fg("dim", "↑↓ navigate • enter select • esc close"), 1, 0);
    this.detailFooter = new Text(theme.fg("dim", "esc back"), 1, 0);
    this.border = new DynamicBorder((s: string) => theme.fg("accent", s));

    this.listContainer = new Container();
    this.listContainer.addChild(this.border);
    this.listContainer.addChild(this.header);
    this.listContainer.addChild(new Spacer(1));
    this.listContainer.addChild(this.listSelect);
    this.listContainer.addChild(new Spacer(1));
    this.listContainer.addChild(this.listFooter);
    this.listContainer.addChild(this.border);

    this.detailContainer = new Container();
  }

  private openDetail(template: SubagentTemplate): void {
    this.detail = new SubagentTemplateDetailsComponent(template, this.theme);
    this.detail.onBack = () => this.closeDetail();
    this.detail.onConfirm = (t) => this.onSelect?.(t);

    this.detailContainer.clear();
    this.detailContainer.addChild(this.border);
    this.detailContainer.addChild(this.header);
    this.detailContainer.addChild(new Spacer(1));
    this.detailContainer.addChild(this.detail);
    this.detailContainer.addChild(new Spacer(1));
    this.detailContainer.addChild(this.detailFooter);
    this.detailContainer.addChild(this.border);

    this.mode = "detail";
    this.tui.requestRender();
  }

  private closeDetail(): void {
    this.mode = "list";
    this.detail = undefined;
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (this.mode === "detail") {
      this.detail?.handleInput(data);
    } else {
      this.listSelect.handleInput(data);
    }
    this.tui.requestRender();
  }

  render(width: number): string[] {
    return this.mode === "detail"
      ? this.detailContainer.render(width)
      : this.listContainer.render(width);
  }

  invalidate(): void {
    this.listContainer.invalidate();
    this.detailContainer.invalidate();
  }
}

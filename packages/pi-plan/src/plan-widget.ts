import type { Theme } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Component, Focusable, TUI } from "@earendil-works/pi-tui";
import { Box, Container, Input, SelectList, Text } from "@earendil-works/pi-tui";
import type { DetectedEditor } from "./editor.js";
import { toTildePath } from "./utils.js";

export type PlanWidgetAnswer =
  | { type: "request-changes" }
  | { type: "approve" }
  | { type: "cancel" }
  | { type: "open-in-editor" }
  | { type: "comment"; comment: string };

type SelectableAction = Exclude<PlanWidgetAnswer["type"], "comment">;

export class PlanWidget implements Component {
  private selectContainer: Container;
  private commentContainer: Container;
  private select: PlanActionSelect;
  private commentInput: PlanCommentInput;
  private mode: "select" | "comment" = "select";

  onAnswer: (answer: PlanWidgetAnswer) => void = () => undefined;

  constructor(
    private tui: TUI,
    theme: Theme,
    planPath: string,
    editor: DetectedEditor | null = null,
    editorOpened: boolean = false,
  ) {
    this.select = new PlanActionSelect(tui, theme, editor?.name ?? null, editorOpened);
    this.select.onComment = () => {
      this.mode = "comment";
      tui.requestRender();
    };
    this.select.onSelect = (item) => {
      this.onAnswer({ type: item });
    };

    this.commentInput = new PlanCommentInput(tui, theme);
    this.commentInput.onBack = () => {
      this.mode = "select";
      tui.requestRender();
    };
    this.commentInput.onSubmit = (comment) => {
      this.onAnswer({ type: "comment", comment });
    };

    this.selectContainer = new Container();
    this.selectContainer.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    this.selectContainer.addChild(new PlanHeader(theme, planPath));
    this.selectContainer.addChild(this.select);
    this.selectContainer.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    this.commentContainer = new Container();
    this.commentContainer.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    this.commentContainer.addChild(new PlanHeader(theme, planPath));
    this.commentContainer.addChild(this.commentInput);
    this.commentContainer.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
  }

  render(width: number) {
    return this.mode === "select"
      ? this.selectContainer.render(width)
      : this.commentContainer.render(width);
  }

  invalidate() {
    this.selectContainer.invalidate();
    this.commentContainer.invalidate();
  }

  handleInput(data: string) {
    if (this.mode === "select") {
      this.select.handleInput(data);
    } else {
      this.commentInput.handleInput(data);
    }
    this.tui.requestRender();
  }
}

class PlanHeader implements Component {
  private box: Box;

  constructor(theme: Theme, planPath: string) {
    this.box = new Box(1, 1);
    this.box.addChild(new Text(theme.bold("Click to open and modify the plan:"), 0, 0));
    this.box.addChild(
      new Text(theme.underline(theme.fg("mdLinkUrl", toTildePath(planPath))), 0, 0),
    );
  }

  render(width: number) {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}

class PlanActionSelect implements Component {
  private container: Container;
  private selectList: SelectList;
  private editorJustOpened = false;

  onSelect: (value: SelectableAction) => void = () => undefined;
  onComment: () => void = () => undefined;

  constructor(
    private tui: TUI,
    theme: Theme,
    editorName: string | null = null,
    editorOpened: boolean = false,
  ) {
    this.editorJustOpened = editorOpened;

    this.container = new Container();
    this.container.addChild(new Text(theme.fg("accent", theme.bold("What's next?")), 1, 0));

    const openInEditorItem = editorName
      ? [
          {
            value: "open-in-editor" as const,
            label: `Open in ${editorName}`,
          },
        ]
      : [];

    const items = [
      ...openInEditorItem,
      {
        value: "request-changes" as const,
        label: "Request changes",
        description: "Agent will update the plan.",
      },
      {
        value: "approve" as const,
        label: "Approve",
        description: "Agent will implement the plan.",
      },
      {
        value: "comment" as const,
        label: "Comment",
      },
    ] satisfies Array<{ value: PlanWidgetAnswer["type"]; label: string; description?: string }>;
    this.selectList = new SelectList(items, Math.min(items.length, 10), {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => {
        if (text.includes("Request")) {
          return theme.fg("error", text);
        }
        if (text.includes("Approve")) {
          return theme.fg("success", text.replace("→", "✓"));
        }
        if (text.includes("Open in") && this.editorJustOpened) {
          return theme.fg("success", text.replace("→", "✓").replace("Open", "Opened"));
        }
        return theme.fg("accent", text);
      },
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    });

    this.selectList.onSelect = (item) => {
      if (item.value === "comment") {
        this.onComment();
      } else {
        this.onSelect(item.value as SelectableAction);
      }
    };
    this.selectList.onCancel = () => this.onSelect("cancel");
    this.selectList.onSelectionChange = () => {
      // reset editor just opened when user changes selection
      this.editorJustOpened = false;
      this.selectList.invalidate();
    };

    this.container.addChild(this.selectList);
    this.container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));
  }

  render(width: number) {
    return this.container.render(width);
  }

  invalidate() {
    this.container.invalidate();
  }

  handleInput(data: string) {
    this.selectList.handleInput(data);
    this.tui.requestRender();
  }
}

class PlanCommentInput implements Component, Focusable {
  private container: Container;
  private input: Input;

  onSubmit: (comment: string) => void = () => undefined;
  onBack: () => void = () => undefined;

  constructor(
    private tui: TUI,
    theme: Theme,
  ) {
    this.container = new Container();
    this.container.addChild(new Text(theme.fg("accent", theme.bold("Leave a comment:")), 1, 0));

    this.input = new Input();
    this.input.onSubmit = (value) => {
      const trimmed = value.trim();
      if (trimmed) {
        this.onSubmit(trimmed);
      }
    };
    this.input.onEscape = () => this.onBack();
    this.container.addChild(this.input);

    this.container.addChild(new Text(theme.fg("dim", "enter submit • esc go back")));
  }

  get focused() {
    return this.input.focused;
  }
  set focused(v: boolean) {
    this.input.focused = v;
  }

  render(width: number) {
    return this.container.render(width);
  }

  invalidate() {
    this.container.invalidate();
  }

  handleInput(data: string) {
    this.input.handleInput(data);
    this.tui.requestRender();
  }
}

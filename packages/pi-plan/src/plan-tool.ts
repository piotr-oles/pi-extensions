import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ExtensionAPI, Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { renderDiff } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { detectEditor } from "./editor.js";
import { commitFile, computeGitDiff, ensureGitRepo } from "./git.js";
import { PlanWidget, type PlanWidgetAnswer } from "./plan-widget.js";
import { toTildePath } from "./utils.js";

type ExecFn = ExtensionAPI["exec"];

const ReviewPlanParams = Type.Object({
  planPath: Type.String({
    description:
      "Path to the plan file relative to ~/.pi/plan/ (e.g. 'my-repo/auth-refactor.md'). " +
      "Write the file first via the write tool, then call review_plan.",
  }),
});

export type PlanReviewToolDetails =
  | { result: "approve"; planPath: string; diff: string }
  | { result: "request-changes"; planPath: string; diff: string }
  | { result: "comment"; planPath: string; message: string; diff: string }
  | { result: "cancel"; planPath?: string };

const PLANS_DIR = join(homedir(), ".pi", "plan");

async function commitAndDiff(
  exec: ExecFn,
  plansDir: string,
  relPath: string,
  action: string,
): Promise<string> {
  const changed = await commitFile(exec, plansDir, relPath, action);
  return changed ? computeGitDiff(exec, plansDir, relPath) : "";
}

export function createReviewPlanTool(
  exec: ExecFn,
  plansDir = PLANS_DIR,
): ToolDefinition<typeof ReviewPlanParams, PlanReviewToolDetails> {
  return {
    name: "review_plan",
    label: "Review Plan",
    description:
      "Open an existing plan file for user review. Write the file first, then call this tool.",
    promptGuidelines: [
      "For planning, write the plan file to ~/.pi/plan/<repo>/<name>.md first, then call review_plan with the <repo>/<name>.md path. Never execute plan without explicit approval.",
    ],
    parameters: ReviewPlanParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        throw new Error("UI not available in non-interactive mode.");
      }

      const planPath = join(plansDir, params.planPath);
      const planName = basename(planPath);
      const relPath = params.planPath;

      try {
        await access(planPath);
      } catch {
        throw new Error(
          `Plan file not found: ${toTildePath(planPath)}. Write the file inside ${toTildePath(plansDir)} first, then call review_plan.`,
        );
      }

      await ensureGitRepo(exec, plansDir);
      await commitFile(exec, plansDir, relPath, `create: ${planName}`);

      const editor = detectEditor();

      ctx.ui.setWorkingVisible(false);

      let editorOpened = false;
      let result: PlanWidgetAnswer;

      while (true) {
        result = await ctx.ui.custom<PlanWidgetAnswer>((tui, theme, _kb, done) => {
          const planWidget = new PlanWidget(tui, theme, planPath, editor, editorOpened);
          planWidget.onAnswer = (answer) => done(answer);

          return planWidget;
        });

        if (result.type !== "open-in-editor") {
          break;
        }

        editor?.open(planPath).catch(() => {});
        editorOpened = true;
      }

      ctx.ui.setWorkingVisible(true);

      if (result.type === "cancel") {
        return {
          content: [{ type: "text", text: "User cancelled plan review." }],
          details: { result: "cancel", planPath },
        };
      }

      if (result.type === "comment") {
        const diff = await commitAndDiff(exec, plansDir, relPath, `comment: ${planName}`);

        if (diff !== "") {
          return {
            content: [
              {
                type: "text",
                text: `User comment: ${result.comment}`,
              },
              {
                type: "text",
                text: `User also edited the "${planName}" plan:`,
              },
              {
                type: "text",
                text: diff,
              },
              {
                type: "text",
                text: [
                  "The changes mentioned above have already been saved in the plan file.",
                  "Address the comment, update the plan if needed, then call review_plan again.",
                ].join("\n"),
              },
            ],
            details: { result: "comment", planPath, message: result.comment, diff },
          };
        }

        return {
          content: [{ type: "text", text: `User comment: ${result.comment}` }],
          details: { result: "comment", planPath, message: result.comment, diff },
        };
      }

      if (result.type === "approve") {
        const diff = await commitAndDiff(exec, plansDir, relPath, `approve: ${planName}`);

        if (diff !== "") {
          return {
            content: [
              {
                type: "text",
                text: `User approved the "${planName}" plan and made edits:`,
              },
              {
                type: "text",
                text: diff,
              },
              {
                type: "text",
                text: [
                  "The changes mentioned above have already been saved in the plan file.",
                  "Address user comments, fixup the plan, then ask user about next steps.",
                ].join("\n"),
              },
            ],
            details: { result: "approve", planPath, diff },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `User approved the "${planName}" plan as is. Ask user about next steps.`,
            },
          ],
          details: { result: "approve", planPath, diff },
        };
      }

      if (result.type === "request-changes") {
        const diff = await commitAndDiff(exec, plansDir, relPath, `request-changes: ${planName}`);

        if (diff !== "") {
          return {
            content: [
              {
                type: "text",
                text: `User edited the "${planName}" plan:`,
              },
              {
                type: "text",
                text: diff,
              },
              {
                type: "text",
                text: [
                  "The changes mentioned above have already been saved in the plan file.",
                  "Address user comments, fixup the plan, then call review_plan again.",
                ].join("\n"),
              },
            ],
            details: { result: "request-changes", planPath, diff },
          };
        }

        return {
          content: [
            {
              type: "text",
              text:
                `No changes detected in the "${planName}" plan - matches the original. ` +
                "Tell user you found no changes and ask what to change.",
            },
          ],
          details: { result: "request-changes", planPath, diff },
        };
      }

      return {
        content: [],
        details: { result: "cancel", planPath },
      };
    },

    renderCall(args, theme): Component {
      return new PlanReviewCall(theme, plansDir, args.planPath);
    },

    renderResult(result, _options, theme, context): Component {
      if (context.isError) {
        const errorText = result.content
          .filter((content) => content.type === "text")
          .map((content) => content.text)
          .join("");

        return new Text(theme.fg("error", errorText), 0, 0);
      }
      return new PlanReviewResult(theme, result.details);
    },
  };
}

class PlanReviewCall implements Component {
  private text: Text;

  constructor(theme: Theme, plansDir: string, planPath: string) {
    const formattedToolTitle = theme.fg("toolTitle", theme.bold("review plan"));
    const formattedPlanPath = theme.fg("accent", toTildePath(join(plansDir, planPath)));

    this.text = new Text(`${formattedToolTitle} ${formattedPlanPath}`, 0, 0);
  }

  render(width: number) {
    return this.text.render(width);
  }

  invalidate() {
    this.text.invalidate();
  }
}

class PlanReviewResult implements Component {
  private container: Container;

  constructor(theme: Theme, details: PlanReviewToolDetails) {
    this.container = new Container();

    this.container.addChild(new Spacer(1));

    switch (details.result) {
      case "approve": {
        if (details.diff !== "") {
          this.container.addChild(
            new Text(theme.fg("success", `Plan approved, proceeding:`), 0, 0),
          );
          this.container.addChild(new Text(renderDiff(details.diff), 0, 1));
        } else {
          this.container.addChild(
            new Text(theme.fg("success", "Plan approved, proceeding..."), 0, 0),
          );
        }
        break;
      }
      case "request-changes": {
        if (details.diff !== "") {
          this.container.addChild(new Text(renderDiff(details.diff), 0, 1));
        } else {
          this.container.addChild(new Text(theme.fg("warning", `No changes detected.`), 0, 0));
        }
        break;
      }
      case "comment": {
        this.container.addChild(
          new Text(`${theme.fg("accent", "Comment: ")}${details.message}`, 0, 0),
        );
        if (details.diff !== "") {
          this.container.addChild(new Text(renderDiff(details.diff), 0, 1));
        }
        break;
      }
      default: {
        this.container.addChild(new Text(theme.fg("dim", "Review cancelled."), 0, 0));
      }
    }
  }

  render(width: number) {
    return this.container.render(width);
  }

  invalidate() {
    this.container.invalidate();
  }
}

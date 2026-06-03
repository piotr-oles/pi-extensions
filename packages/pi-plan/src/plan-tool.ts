import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { ExtensionAPI, Theme, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { renderDiff } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
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
  | { result: "question"; planPath: string; message?: string }
  | { result: "cancel"; planPath?: string };

const PLANS_DIR = join(homedir(), ".pi", "plan");

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
        return {
          content: [{ type: "text", text: "Error: UI not available in non-interactive mode." }],
          details: { result: "cancel" },
        };
      }

      const planPath = join(plansDir, params.planPath);
      const planName = basename(planPath);
      const relPath = params.planPath;
      await ensureGitRepo(exec, plansDir);
      await commitFile(exec, plansDir, relPath, `create: ${planName}`);

      ctx.ui.setWorkingVisible(false);

      const result = await ctx.ui.custom<PlanWidgetAnswer>((tui, theme, _kb, done) => {
        const planWidget = new PlanWidget(tui, theme, planPath);
        planWidget.onSelect = (answer) => done(answer);
        planWidget.onQuestion = (question) => done({ type: "question", question });

        return planWidget;
      });

      ctx.ui.setWorkingVisible(true);

      if (result.type === "cancel") {
        return {
          content: [{ type: "text", text: "User cancelled plan review." }],
          details: { result: "cancel", planPath },
        };
      }

      if (result.type === "question") {
        return {
          content: [{ type: "text", text: `User question: ${result.question}` }],
          details: { result: "question", planPath, message: result.question },
        };
      }

      if (result.type === "approve") {
        const confirmed = await commitFile(exec, plansDir, relPath, `approve: ${planName}`);
        const diff = confirmed ? await computeGitDiff(exec, plansDir, relPath) : "";

        if (diff !== "") {
          return {
            content: [
              {
                type: "text",
                text:
                  `User approved the "${planName}" plan and made edits:\n\n${diff}\n\n` +
                  "The changes mentioned above has been already saved in the plan file.\n" +
                  "Address user comments, fixup the plan, then proceed with plan execution.",
              },
            ],
            details: { result: "approve", planPath, diff },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `User approved the "${planName}" plan without changes. Proceed with execution.`,
            },
          ],
          details: { result: "approve", planPath, diff },
        };
      }

      if (result.type === "request-changes") {
        const changed = await commitFile(exec, plansDir, relPath, `request-changes: ${planName}`);
        const diff = changed ? await computeGitDiff(exec, plansDir, relPath) : "";

        if (diff !== "") {
          return {
            content: [
              {
                type: "text",
                text:
                  `User edited the "${planName}" plan:\n\n${diff}\n\n` +
                  "The changes mentioned above has been already saved in the plan file.\n" +
                  "Address user comments, fixup the plan, then call review_plan again.",
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

    renderResult(result, _options, theme): Component {
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
      case "question": {
        this.container.addChild(
          new Text(theme.fg("accent", `Question: `) + `${details.message ?? ""}`, 0, 0),
        );
        break;
      }
      default: {
        this.container.addChild(new Text(theme.fg("dim", "Review cancelled."), 0, 0));
      }
    }
  }

  render(width: number) {
    return [
      "", // add empty line on top
      ...this.container.render(width),
    ];
  }

  invalidate() {
    this.container.invalidate();
  }
}

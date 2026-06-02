import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  Text,
  truncateToWidth,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

const PlanParams = Type.Object({
  name: Type.String({
    description:
      "Plan name used as the filename (e.g. 'auth-refactor'). .md extension added automatically.",
  }),
  content: Type.String({ description: "Full plan content in markdown format." }),
});

interface PlanDetails {
  action: "confirmed" | "changes" | "other" | "cancelled";
  planPath: string;
  diff?: string;
  message?: string;
}

export function getRepoName(cwd: string): string {
  try {
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
    });
    if (result.status === 0 && result.stdout?.trim()) {
      return basename(result.stdout.trim());
    }
  } catch {
    // not a git repo
  }
  return basename(cwd);
}

function openInZed(filePath: string): boolean {
  try {
    spawn("zed", [filePath], { detached: true, stdio: "ignore" }).unref();
    return true;
  } catch {
    return false;
  }
}

export async function computeDiff(
  originalContent: string,
  currentContent: string,
): Promise<string> {
  const base = `pi-plan-${Date.now()}`;
  const oldPath = join(tmpdir(), `${base}-old.md`);
  const newPath = join(tmpdir(), `${base}-new.md`);

  try {
    await writeFile(oldPath, originalContent, "utf8");
    await writeFile(newPath, currentContent, "utf8");

    const result = spawnSync("diff", ["-u", oldPath, newPath], { encoding: "utf8" });

    if (result.status === 0 || !result.stdout?.trim()) {
      return "";
    }

    const diffLines = result.stdout
      .split("\n")
      .filter(
        (l) =>
          (l.startsWith("+") && !l.startsWith("+++")) ||
          (l.startsWith("-") && !l.startsWith("---")),
      );

    return diffLines.join("\n");
  } finally {
    await unlink(oldPath).catch(() => {});
    await unlink(newPath).catch(() => {});
  }
}

export default function piPlan(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "plan",
    label: "Plan",
    description:
      "Save a named markdown plan to ~/.pi-plan/<repo>/<name>.md, open it in Zed, " +
      "and ask the user to confirm, notify about changes they made in Zed, or continue the conversation. " +
      "Use this when proposing a multi-step plan that the user should review before execution.",
    promptSnippet: "Save a named plan to disk and get user confirmation before executing",
    promptGuidelines: [
      "Use plan tool when proposing a multi-step implementation plan that requires user review.",
      "After plan tool returns with action=changes, call plan tool again with the revised content.",
    ],
    parameters: PlanParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "Error: UI not available in non-interactive mode." }],
          details: { action: "cancelled", planPath: "" } as PlanDetails,
        };
      }

      const repoName = getRepoName(ctx.cwd);
      const planName = params.name.endsWith(".md") ? params.name : `${params.name}.md`;
      const planDir = join(homedir(), ".pi-plan", repoName);
      const planPath = join(planDir, planName);

      await mkdir(planDir, { recursive: true });
      await writeFile(planPath, params.content, "utf8");

      const zedOpened = openInZed(planPath);

      type UIResult = { action: "confirmed" | "changes" | "other" | "cancelled"; message?: string };

      const result = await ctx.ui.custom<UIResult | null>((tui, theme, _kb, done) => {
        let optionIndex = 0;
        let editMode = false;
        let cachedLines: string[] | undefined;

        const zedStatus = zedOpened ? "✓ Opened in Zed" : "⚠ Could not open Zed (zed not in PATH)";
        const zedStatusColor = zedOpened ? "success" : "warning";

        const options = [
          {
            label: "Notify about changes",
            description: "I edited the plan in Zed — send diff to agent",
          },
          { label: "Confirm the plan", description: "Proceed with the plan as-is" },
          { label: "Other", description: "Continue the conversation" },
        ];

        const editorTheme: EditorTheme = {
          borderColor: (s) => theme.fg("accent", s),
          selectList: {
            selectedPrefix: (t) => theme.fg("accent", t),
            selectedText: (t) => theme.fg("accent", t),
            description: (t) => theme.fg("muted", t),
            scrollInfo: (t) => theme.fg("dim", t),
            noMatch: (t) => theme.fg("warning", t),
          },
        };
        const editor = new Editor(tui, editorTheme);

        editor.onSubmit = (value) => {
          const msg = value.trim();
          if (msg) {
            done({ action: "other", message: msg });
          } else {
            editMode = false;
            editor.setText("");
            refresh();
          }
        };

        function refresh() {
          cachedLines = undefined;
          tui.requestRender();
        }

        function handleInput(data: string) {
          if (editMode) {
            if (matchesKey(data, Key.escape)) {
              editMode = false;
              editor.setText("");
              refresh();
              return;
            }
            editor.handleInput(data);
            refresh();
            return;
          }

          if (matchesKey(data, Key.up)) {
            optionIndex = Math.max(0, optionIndex - 1);
            refresh();
            return;
          }
          if (matchesKey(data, Key.down)) {
            optionIndex = Math.min(options.length - 1, optionIndex + 1);
            refresh();
            return;
          }
          if (matchesKey(data, Key.enter)) {
            const { label } = options[optionIndex];
            if (label === "Other") {
              editMode = true;
              refresh();
            } else if (label === "Confirm the plan") {
              done({ action: "confirmed" });
            } else {
              done({ action: "changes" });
            }
            return;
          }
          if (matchesKey(data, Key.escape)) {
            done({ action: "cancelled" });
          }
        }

        function render(width: number): string[] {
          if (cachedLines) {
            return cachedLines;
          }

          const lines: string[] = [];
          const add = (s: string) => lines.push(truncateToWidth(s, width));

          add(theme.fg("accent", "─".repeat(width)));
          add(`  ${theme.fg("accent", theme.bold("📋 Plan:  "))}${theme.fg("text", planName)}`);
          add(`  ${theme.fg("dim", planPath)}`);
          add(`  ${theme.fg(zedStatusColor, zedStatus)}`);
          lines.push("");
          add(`  ${theme.fg("text", "What would you like to do?")}`);
          lines.push("");

          for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const selected = i === optionIndex;
            const prefix = selected ? theme.fg("accent", "> ") : "  ";
            const labelColor = selected ? "accent" : "text";

            add(`${prefix}${theme.fg(labelColor, `${i + 1}. ${opt.label}`)}`);
            add(`     ${theme.fg("muted", opt.description)}`);
          }

          if (editMode) {
            lines.push("");
            add(`  ${theme.fg("muted", "Your message:")}`);
            for (const line of editor.render(width - 4)) {
              add(`  ${line}`);
            }
            lines.push("");
            add(`  ${theme.fg("dim", "Enter to submit  •  Esc to go back")}`);
          } else {
            lines.push("");
            add(`  ${theme.fg("dim", "↑↓ navigate  •  Enter select  •  Esc cancel")}`);
          }

          add(theme.fg("accent", "─".repeat(width)));

          cachedLines = lines;
          return lines;
        }

        return {
          render,
          invalidate: () => {
            cachedLines = undefined;
          },
          handleInput,
        };
      });

      if (!result || result.action === "cancelled") {
        return {
          content: [{ type: "text", text: "User cancelled plan review." }],
          details: { action: "cancelled", planPath } as PlanDetails,
        };
      }

      if (result.action === "confirmed") {
        const currentContent = await readFile(planPath, "utf8");
        const diff = await computeDiff(params.content, currentContent);

        if (diff) {
          return {
            content: [
              {
                type: "text",
                text:
                  `User confirmed "${planName}" and made edits. Added/removed lines:\n\n${diff}\n\n` +
                  "Incorporate these changes into the plan, then proceed with execution.",
              },
            ],
            details: { action: "confirmed", planPath, diff } as PlanDetails,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `User confirmed the plan "${planName}". Proceed with execution.`,
            },
          ],
          details: { action: "confirmed", planPath } as PlanDetails,
        };
      }

      if (result.action === "changes") {
        const currentContent = await readFile(planPath, "utf8");
        const diff = await computeDiff(params.content, currentContent);

        if (!diff) {
          return {
            content: [
              {
                type: "text",
                text:
                  `No changes detected in "${planName}" — the file matches the original. ` +
                  "Call plan tool again with an updated version if you want to revise.",
              },
            ],
            details: { action: "changes", planPath, diff: "" } as PlanDetails,
          };
        }

        return {
          content: [
            {
              type: "text",
              text:
                `User edited "${planName}" in Zed. Added/removed lines:\n\n${diff}\n\n` +
                "Call the plan tool again with the next version of the plan incorporating these changes.",
            },
          ],
          details: { action: "changes", planPath, diff } as PlanDetails,
        };
      }

      return {
        content: [{ type: "text", text: `User says: ${result.message ?? "(no message)"}` }],
        details: { action: "other", planPath, message: result.message } as PlanDetails,
      };
    },

    renderCall(args, theme, _context) {
      return new Text(
        theme.fg("toolTitle", theme.bold("plan ")) + theme.fg("muted", String(args.name ?? "")),
        0,
        0,
      );
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as PlanDetails | undefined;
      if (!details) {
        const first = result.content[0];
        return new Text(first?.type === "text" ? first.text : "", 0, 0);
      }

      if (details.action === "confirmed") {
        if (details.diff) {
          const lineCount = details.diff.split("\n").filter(Boolean).length;
          return new Text(theme.fg("success", `✓ Confirmed + ${lineCount} changed lines`), 0, 0);
        }
        return new Text(theme.fg("success", "✓ Plan confirmed — proceeding"), 0, 0);
      }
      if (details.action === "changes") {
        const lineCount = details.diff ? details.diff.split("\n").filter(Boolean).length : 0;
        const summary = lineCount > 0 ? `${lineCount} changed lines` : "no changes";
        return new Text(theme.fg("warning", `⟳ Changes notified (${summary})`), 0, 0);
      }
      if (details.action === "other") {
        const preview = (details.message ?? "").slice(0, 60);
        return new Text(theme.fg("accent", `💬 ${preview}`), 0, 0);
      }
      return new Text(theme.fg("dim", "Cancelled"), 0, 0);
    },
  });
}

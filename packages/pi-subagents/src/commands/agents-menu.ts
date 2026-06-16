import { homedir } from "node:os";
import type { ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import type { AgentTemplate } from "../domain/agent-template.js";
import type { AgentTemplatesManager } from "../domain/agent-templates-manager.js";

export async function showSubagents(
  ctx: ExtensionCommandContext,
  templatesManager: AgentTemplatesManager,
): Promise<void> {
  await templatesManager.reload();
  const templates = templatesManager.listTemplates();

  if (!templates.length) {
    ctx.ui.notify(
      "No subagents founds in ~/.pi/agent/subagents/ and .pi/subagents directories.",
      "warning",
    );
  }

  ctx.ui.notify(
    [
      ctx.ui.theme.fg("mdHeading", "Subagents"),
      templates.map((template) => renderTemplate(template, ctx.ui.theme)).join("\n\n"),
    ].join("\n"),
  );
}

function renderTemplate(
  { name, model = "inherit", description, enabled, filePath }: AgentTemplate,
  theme: Theme,
) {
  return [
    [theme.bold(theme.fg(enabled ? "accent" : "dim", name)), model].join(" · "),
    filePath ? theme.fg("dim", toTildePath(filePath)) : undefined,
    theme.fg("dim", enabled ? (description ?? "(no description)") : "(disabled)"),
  ]
    .filter(Boolean)
    .join("\n");
}

function toTildePath(absPath: string): string {
  const home = homedir();
  return absPath.startsWith(home) ? `~${absPath.slice(home.length)}` : absPath;
}

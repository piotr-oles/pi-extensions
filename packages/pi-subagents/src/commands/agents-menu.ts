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
      ctx.ui.theme.fg("mdHeading", "[Subagents]"),
      templates.map((template) => renderTemplate(template, ctx.ui.theme)).join("\n\n"),
    ].join("\n"),
  );
}

function renderTemplate(
  { name, model = "inherit", description, enabled }: AgentTemplate,
  theme: Theme,
) {
  return theme.bg(
    "customMessageBg",
    [
      `${theme.bold(theme.fg(enabled ? "accent" : "dim", name))} · ${model}`,
      theme.fg("dim", enabled ? (description ?? "(no description)").slice(0, 120) : "(disabled)"),
    ].join("\n"),
  );
}

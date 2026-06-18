import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { SubagentTemplate } from "../domain/subagent-template.js";
import type { SubagentTemplatesManager } from "../domain/subagent-templates-manager.js";
import { SubagentTemplatesComponent } from "./components/subagent-templates-component.js";

export async function showSubagentTemplatesMenu(
  ctx: ExtensionCommandContext,
  templatesManager: SubagentTemplatesManager,
): Promise<SubagentTemplate | null> {
  await templatesManager.reload();
  const templates = templatesManager.listTemplates();

  if (!templates.length) {
    ctx.ui.notify(
      "No subagents found in ~/.pi/agent/subagents/ and .pi/subagents directories.",
      "warning",
    );
    return null;
  }

  return ctx.ui.custom<SubagentTemplate | null>((tui, theme, _kb, done) => {
    const menu = new SubagentTemplatesComponent(tui, theme, templates);
    menu.onClose = () => done(null);
    menu.onSelect = (template) => done(template);
    return menu;
  });
}

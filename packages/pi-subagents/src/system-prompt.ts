import type { SubagentTemplate } from "./domain/subagent-template.js";
import { escapeXmlContent } from "./xml.js";

/**
 * Update system prompt if current agent is not a subagent.
 */
export function updateAgentSystemPropmt(
  baseSystemPrompt: string,
  templates: SubagentTemplate[],
): string {
  if (templates.length > 0) {
    return `${baseSystemPrompt}\n\n${buildAvailableSubagentsSystemPrompt(templates)}`;
  }
  return baseSystemPrompt;
}

const STANDARD_PREAMBLE =
  "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.\n";

/**
 * Update system prompt if current agent is a subagent.
 */
export function updateSubagentSystemPrompt(
  baseSystemPrompt: string,
  templates: SubagentTemplate[],
  template: SubagentTemplate,
): string {
  if (baseSystemPrompt.startsWith(STANDARD_PREAMBLE)) {
    // modify the preamble
    const baseSystemPromptWithoutPreamble = baseSystemPrompt.slice(STANDARD_PREAMBLE.length);

    if (templates.length > 0) {
      return [
        buildCurrentSubagentSystemPropmtPreamble(template),
        baseSystemPromptWithoutPreamble,
        buildAvailableSubagentsSystemPrompt(templates),
      ].join("\n\n");
    }
    return [
      buildCurrentSubagentSystemPropmtPreamble(template),
      baseSystemPromptWithoutPreamble,
    ].join("\n\n");
  } else {
    // preamble is different - safe path, add at the end
    if (templates.length > 0) {
      return [
        baseSystemPrompt,
        buildCurrentSubagentSystemPrompt(template),
        buildAvailableSubagentsSystemPrompt(templates),
      ].join("\n\n");
    }
    return [baseSystemPrompt, buildCurrentSubagentSystemPrompt(template)].join("\n\n");
  }
}

function buildCurrentSubagentSystemPropmtPreamble(template: SubagentTemplate) {
  return [
    `You are ${template.name} subagent - an expert coding assistant operating inside pi, a coding agent harness. You help other agents by reading files, executing commands, editing code, and writing new files.`,
    "",
    `<subagent_instructions>`,
    escapeXmlContent(template.instructions.trim()),
    "</subagent_instructions>",
    "",
  ].join("\n");
}

function buildCurrentSubagentSystemPrompt(template: SubagentTemplate) {
  return [
    `You're subagent "${template.name}":`,
    `<subagent_instructions>`,
    escapeXmlContent(template.instructions.trim()),
    "</subagent_instructions>",
  ].join("\n");
}

function buildAvailableSubagentsSystemPrompt(templates: SubagentTemplate[]): string {
  return [
    "Subagents:",
    "Your context window is limited, when possible delegate tasks to subagents using `subagent` tool.",
    "<available_subagents>",
    ...templates.flatMap((template) => [
      `  <subagent>`,
      `    <name>${escapeXmlContent(template.name)}</name>`,
      `    <description>${escapeXmlContent(template.description)}</description>`,
      `  </subagent>`,
    ]),
    "</available_subagents>",
  ].join("\n");
}

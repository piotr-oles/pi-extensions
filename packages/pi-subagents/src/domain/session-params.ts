import { execSync } from "node:child_process";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export function buildSystemPrompt(
  template: { name: string; instructions: string },
  ctx: ExtensionContext,
): string {
  const agentSystemPrompt = buildAgentPrompt(template, ctx.cwd);
  const parentSystemPrompt = ctx.getSystemPrompt();
  return parentSystemPrompt ? `${parentSystemPrompt}\n\n${agentSystemPrompt}` : agentSystemPrompt;
}

function buildAgentPrompt(template: { name: string; instructions: string }, cwd: string): string {
  const branch = gitBranch(cwd);
  const envBlock = [
    "# Environment",
    `Working directory: ${cwd}`,
    branch ? `Git branch: ${branch}` : "Not a git repository",
  ].join("\n");

  const base = [`<active_agent name="${template.name}"/>`, "", envBlock].join("\n");

  if (!template.instructions.trim()) {
    return base;
  }
  return `${base}\n\n<agent_instructions>\n${template.instructions.trim()}\n</agent_instructions>`;
}

function gitBranch(cwd: string): string | undefined {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

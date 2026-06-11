import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./session-params.js";
import { AgentTemplate } from "./types.js";

const baseTemplate = new AgentTemplate({
  name: "test-agent",
  description: "test",
  instructions: "",
  source: "global",
});

function makeCtx(cwd: string, parentPrompt = ""): ExtensionContext {
  return {
    cwd,
    getSystemPrompt: () => parentPrompt,
    model: undefined,
    modelRegistry: {} as ExtensionContext["modelRegistry"],
  } as unknown as ExtensionContext;
}

let gitDir: string;
let nonGitDir: string;

beforeAll(() => {
  nonGitDir = mkdtempSync(join(tmpdir(), "pi-sub-nongit-"));

  gitDir = mkdtempSync(join(tmpdir(), "pi-sub-git-"));
  execSync("git init", { cwd: gitDir, stdio: "ignore" });
  execSync("git -c user.email=t@t.com -c user.name=T commit --allow-empty -m init", {
    cwd: gitDir,
    stdio: "ignore",
  });
  execSync("git branch -m test-branch", { cwd: gitDir, stdio: "ignore" });
});

afterAll(() => {
  rmSync(nonGitDir, { recursive: true, force: true });
  rmSync(gitDir, { recursive: true, force: true });
});

describe("buildSystemPrompt — environment block", () => {
  it("includes working directory in output", () => {
    const systemPrompt = buildSystemPrompt(baseTemplate, makeCtx(nonGitDir));
    expect(systemPrompt).toContain(`Working directory: ${nonGitDir}`);
  });

  it("includes agent name tag", () => {
    const systemPrompt = buildSystemPrompt(baseTemplate, makeCtx(nonGitDir));
    expect(systemPrompt).toContain('<active_agent name="test-agent"/>');
  });

  it("shows 'Not a git repository' for non-git dirs", () => {
    const systemPrompt = buildSystemPrompt(baseTemplate, makeCtx(nonGitDir));
    expect(systemPrompt).toContain("Not a git repository");
    expect(systemPrompt).not.toContain("Git branch:");
  });

  it("shows branch name for git repos", () => {
    const systemPrompt = buildSystemPrompt(baseTemplate, makeCtx(gitDir));
    expect(systemPrompt).toMatch(/Git branch: \S+/);
    expect(systemPrompt).not.toContain("Not a git repository");
  });
});

describe("buildSystemPrompt — instructions", () => {
  it("omits agent_instructions block when instructions is empty", () => {
    const systemPrompt = buildSystemPrompt(
      { ...baseTemplate, instructions: "" },
      makeCtx(nonGitDir),
    );
    expect(systemPrompt).not.toContain("<agent_instructions>");
  });

  it("omits agent_instructions block when instructions is whitespace-only", () => {
    const systemPrompt = buildSystemPrompt(
      { ...baseTemplate, instructions: "   \n  " },
      makeCtx(nonGitDir),
    );
    expect(systemPrompt).not.toContain("<agent_instructions>");
  });

  it("includes agent_instructions block when instructions is non-empty", () => {
    const template = new AgentTemplate({
      ...baseTemplate,
      source: "global",
      instructions: "You are a specialist.",
    });
    const systemPrompt = buildSystemPrompt(template, makeCtx(nonGitDir));
    expect(systemPrompt).toContain("<agent_instructions>");
    expect(systemPrompt).toContain("You are a specialist.");
    expect(systemPrompt).toContain("</agent_instructions>");
  });

  it("trims whitespace from instructions before including it", () => {
    const template = new AgentTemplate({
      ...baseTemplate,
      source: "global",
      instructions: "\n\n  Do something.\n\n",
    });
    const systemPrompt = buildSystemPrompt(template, makeCtx(nonGitDir));
    expect(systemPrompt).toContain("\nDo something.\n");
    expect(systemPrompt).not.toMatch(/<agent_instructions>\n\n/);
  });
});

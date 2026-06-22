import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { SubagentSource, SubagentTemplate } from "./subagent-template.js";
import type { SubagentName } from "./types.js";

export class SubagentTemplatesManager {
  static getGlobalDir(): string {
    return join(getAgentDir(), "subagents");
  }

  static getProjectDir(cwd: string) {
    return join(cwd, ".pi", "subagents");
  }

  private templates = new Map<SubagentName, SubagentTemplate>();
  private enabled: Set<SubagentName> | null = null;

  constructor(private readonly cwd: string) {}

  async reload(): Promise<void> {
    this.templates.clear();

    for (const [file, template] of await this.loadFromDir(
      SubagentTemplatesManager.getGlobalDir(),
      "global",
    )) {
      this.templates.set(file, template);
    }
    for (const [file, template] of await this.loadFromDir(
      SubagentTemplatesManager.getProjectDir(this.cwd),
      "project",
    )) {
      this.templates.set(file, template);
    }
  }

  setEnabledTemplates(names: SubagentName[] | null): void {
    this.enabled = names ? new Set(names) : null;
  }

  getTemplate(name: SubagentName): SubagentTemplate | undefined {
    const key = this.resolveName(name);
    if (!key) {
      return undefined;
    }
    const template = this.templates.get(key);
    if (!template?.enabled) {
      return undefined;
    }
    if (this.enabled !== null && !this.enabled.has(template.name)) {
      return undefined;
    }
    return template;
  }

  listTemplates(): SubagentTemplate[] {
    return Array.from(this.templates.values()).sort(
      (templateA, templateB) => this.scoreTemplate(templateB) - this.scoreTemplate(templateA),
    );
  }

  listEnabledTemplates(): SubagentTemplate[] {
    return this.listTemplates().filter(
      (t) => t.enabled && (this.enabled === null || this.enabled.has(t.name)),
    );
  }

  private scoreTemplate(template: SubagentTemplate): number {
    if (template.enabled) {
      return template.source === "project" ? 3 : 2;
    } else {
      return template.source === "project" ? 1 : 0;
    }
  }

  private resolveName(name: string): SubagentName | undefined {
    if (this.templates.has(name)) {
      return name;
    }
    const lower = name.toLowerCase();
    for (const key of this.templates.keys()) {
      if (key.toLowerCase() === lower) {
        return key;
      }
    }
    return undefined;
  }

  private async loadFromDir(
    dir: string,
    source: SubagentSource,
  ): Promise<Map<SubagentName, SubagentTemplate>> {
    const templates = new Map<SubagentName, SubagentTemplate>();

    let files: string[];
    try {
      files = (await readdir(dir)).filter((file) => file.endsWith(".md"));
    } catch {
      return templates;
    }

    const read = await Promise.all(
      files.map(async (file) => {
        const filePath = join(dir, file);

        try {
          const content = await readFile(filePath, "utf-8");
          return { filePath, content };
        } catch {
          return { filePath, content: undefined };
        }
      }),
    );

    for (const { filePath, content } of read) {
      if (!content) {
        continue;
      }
      const name = basename(filePath, ".md");
      try {
        templates.set(name, parseTemplateFile(filePath, name, content, source));
      } catch (_error) {
        // TODO: report it
      }
    }

    return templates;
  }
}

function parseTemplateFile(
  filePath: string,
  name: string,
  content: string,
  source: SubagentSource,
): SubagentTemplate {
  const { frontmatter: fm, body } = parseFrontmatter(content);
  return {
    name: parseString(fm.name) || name,
    description: parseString(fm.description) ?? name,
    includedTools: parseCsvField(fm.included_tools),
    includedSkills: parseCsvField(fm.included_skills),
    includedSubagents: parseCsvField(fm.included_subagents),
    model: parseString(fm.model),
    thinkingLevel: parseThinkingLevel(fm.thinking),
    maxTurns: parseNonNegativeInt(fm.max_turns),
    graceTurns: parseNonNegativeInt(fm.grace_turns),
    instructions: body.trim(),
    enabled: fm.enabled !== false,
    source,
    filePath,
  };
}

const THINKING_LEVELS: ReadonlySet<ThinkingLevel> = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

function isThinkingLevel(value: string): value is ThinkingLevel {
  return THINKING_LEVELS.has(value as ThinkingLevel);
}

function parseThinkingLevel(value: unknown): ThinkingLevel | undefined {
  const str = parseString(value);
  return str !== undefined && isThinkingLevel(str) ? str : undefined;
}

function parseString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseNonNegativeInt(value: unknown): number | undefined {
  return typeof value === "number" && value >= 0 ? value : undefined;
}

function parseCsvField(value: unknown): string[] | undefined {
  const str = parseString(value)?.trim();
  if (!str || str === "none") {
    return undefined;
  }
  const items = str
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

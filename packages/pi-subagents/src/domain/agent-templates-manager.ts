import { access, readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { type AgentName, type AgentSource, AgentTemplate, type ThinkingLevel } from "./types.js";

export class AgentTemplatesManager {
  private templates = new Map<AgentName, AgentTemplate>();

  static getGlobalDir(): string {
    return join(getAgentDir(), "subagents");
  }

  static getProjectDir(cwd: string) {
    return join(cwd, ".pi", "subagents");
  }

  constructor(private readonly cwd: string) {}

  async reload(): Promise<void> {
    this.templates.clear();

    for (const [file, template] of await this.loadFromDir(
      AgentTemplatesManager.getGlobalDir(),
      "global",
    )) {
      this.templates.set(file, template);
    }
    for (const [file, template] of await this.loadFromDir(
      AgentTemplatesManager.getProjectDir(this.cwd),
      "project",
    )) {
      this.templates.set(file, template);
    }
  }

  resolveName(name: string): AgentName | undefined {
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

  getTemplate(name: AgentName): AgentTemplate | undefined {
    const key = this.resolveName(name);
    if (!key) {
      return undefined;
    }
    const template = this.templates.get(key);
    return template?.enabled !== false ? template : undefined;
  }

  getTemplateOrDefault(name: AgentName): AgentTemplate {
    return (
      this.getTemplate(name) ??
      this.getTemplate("general-purpose") ??
      new AgentTemplate({
        name: "general-purpose",
        description: "General-purpose agent",
        instructions: "",
        enabled: true,
        source: "global",
      })
    );
  }

  getAllNames(): AgentName[] {
    return [...this.templates.keys()];
  }

  listTemplates(): AgentTemplate[] {
    return Array.from(this.templates.values()).sort(
      (templateA, templateB) => templateB.getRelevanceScore() - templateA.getRelevanceScore(),
    );
  }

  getEnabledNames(): AgentName[] {
    return [...this.templates.entries()]
      .filter(([, template]) => template.enabled !== false)
      .map(([name]) => name);
  }

  private async loadFromDir(
    dir: string,
    source: AgentSource,
  ): Promise<Map<AgentName, AgentTemplate>> {
    const templates = new Map<AgentName, AgentTemplate>();

    try {
      await access(dir);
    } catch {
      return templates;
    }

    let files: string[];
    try {
      files = (await readdir(dir)).filter((file) => file.endsWith(".md"));
    } catch {
      return templates;
    }

    const read = await Promise.all(
      files.map(async (file) => {
        try {
          const content = await readFile(join(dir, file), "utf-8");
          return { file, content };
        } catch {
          return { file, content: undefined };
        }
      }),
    );

    for (const { file, content } of read) {
      if (!content) {
        continue;
      }
      const name = basename(file, ".md");
      const { frontmatter: fm, body } = parseFrontmatter(content);

      templates.set(
        name,
        new AgentTemplate({
          name,
          description: parseString(fm.description) ?? name,
          excludedTools: Array.from(new Set(parseCsvField(fm.excluded_tools) ?? [])),
          model: parseString(fm.model),
          thinkingLevel: parseThinkingLevel(fm.thinking),
          maxTurns: parseNonNegativeInt(fm.max_turns),
          graceTurns: parseNonNegativeInt(fm.grace_turns),
          instructions: body.trim(),
          enabled: fm.enabled !== false,
          source,
        }),
      );
    }

    return templates;
  }
}

const THINKING_LEVELS: ReadonlySet<ThinkingLevel> = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

function parseThinkingLevel(value: unknown): ThinkingLevel | undefined {
  const str = parseString(value);
  return str !== undefined && THINKING_LEVELS.has(str as ThinkingLevel)
    ? (str as ThinkingLevel)
    : undefined;
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

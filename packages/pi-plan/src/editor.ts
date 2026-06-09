import { spawn } from "node:child_process";

export interface DetectedEditor {
  name: string;
  open: (filePath: string) => Promise<void>;
}

interface EditorConfig {
  name: string;
  cli: string;
  args: (filePath: string) => string[];
}

const TERM_PROGRAM_MAP: Record<string, EditorConfig> = {
  zed: {
    name: "Zed",
    cli: "zed",
    args: (filePath) => [filePath],
  },
  vscode: {
    name: "VS Code",
    cli: "code",
    args: (filePath) => ["--reuse-window", filePath],
  },
  cursor: {
    name: "Cursor",
    cli: "cursor",
    args: (filePath) => ["--reuse-window", filePath],
  },
  windsurf: {
    name: "Windsurf",
    cli: "windsurf",
    args: (filePath) => ["--reuse-window", filePath],
  },
};

type SpawnChild = {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  unref: () => void;
};

type SpawnFn = (
  cli: string,
  args: string[],
  opts: { detached: boolean; stdio: string },
) => SpawnChild;

export function detectEditor(
  env: NodeJS.ProcessEnv = process.env,
  spawnFn: SpawnFn = spawn as unknown as SpawnFn,
): DetectedEditor | null {
  const termProgram = env.TERM_PROGRAM?.toLowerCase();
  if (!termProgram) {
    return null;
  }

  const config = TERM_PROGRAM_MAP[termProgram];
  if (!config) {
    return null;
  }

  return {
    name: config.name,
    open: (filePath: string) =>
      new Promise<void>((resolve, reject) => {
        const child = spawnFn(config.cli, config.args(filePath), {
          detached: true,
          stdio: "ignore",
        });
        child.on("error", (err) => reject(err as Error));
        child.on("spawn", () => resolve());
        child.unref();
      }),
  };
}

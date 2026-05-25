import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function isSemAvailable(pi: ExtensionAPI): Promise<boolean> {
  try {
    const result = await pi.exec("sem", ["--version"], { timeout: 5_000 });
    return result.code === 0;
  } catch {
    return false;
  }
}

/**
 * Returns true when .sem is covered by a gitignore rule.
 * Uses --no-index so that the check works even if .sem files were
 * accidentally committed (tracked files override the normal check).
 * Returns true (no warning) when git is unavailable or cwd is not a repo.
 */
async function isSemIgnored(pi: ExtensionAPI): Promise<boolean> {
  try {
    const result = await pi.exec("git", ["check-ignore", "--no-index", "-q", ".sem"], {
      timeout: 5_000,
    });
    // exit 0 = ignored, exit 1 = not ignored, other = not a repo / git error
    if (result.code === 0) return true;
    if (result.code === 1) return false;
    return true; // can't determine — skip check
  } catch {
    return true;
  }
}

export interface SemStatus {
  semAvailable: boolean;
  semIgnored: boolean;
}

export async function checkSemStatus(pi: ExtensionAPI): Promise<SemStatus> {
  const [semAvailable, semIgnored] = await Promise.all([
    isSemAvailable(pi),
    isSemIgnored(pi),
  ]);
  return { semAvailable, semIgnored };
}

// ---------------------------------------------------------------------------
// /sem-setup command
// ---------------------------------------------------------------------------

export function registerSemSetupCommand(pi: ExtensionAPI) {
  pi.registerCommand("sem-setup", {
    description: "Check sem setup status and show fix instructions",
    handler: async (_args, ctx) => {
      const { semAvailable, semIgnored } = await checkSemStatus(pi);
      const ok = semAvailable && semIgnored;

      const lines: string[] = ["sem-pi setup status:"];
      lines.push(`  sem binary  ${semAvailable ? "✓ available" : "✗ not found"}`);
      if (!semAvailable) {
        lines.push("    install : cargo install sem");
        lines.push("    or      : https://github.com/piotr-oles/sem");
      }
      lines.push(`  .sem/       ${semIgnored ? "✓ git-ignored" : "✗ not in .gitignore"}`);
      if (!semIgnored) {
        lines.push("    fix     : echo '.sem/' >> .gitignore");
      }
      if (ok) lines.push("\n✓ Everything looks good!");

      ctx.ui.notify(lines.join("\n"), ok ? "info" : "warning");
    },
  });
}

// ---------------------------------------------------------------------------
// Session-start warning
// ---------------------------------------------------------------------------

export function registerSemStartupCheck(pi: ExtensionAPI) {
  let commandRegistered = false;

  pi.on("session_start", async (_event, ctx) => {
    const { semAvailable, semIgnored } = await checkSemStatus(pi);
    if (semAvailable && semIgnored) return;

    if (!commandRegistered) {
      registerSemSetupCommand(pi);
      commandRegistered = true;
    }

    const issues: string[] = [];
    if (!semAvailable) issues.push("sem binary not found");
    if (!semIgnored) issues.push(".sem/ not in .gitignore");

    ctx.ui.notify(
      `sem-pi: setup incomplete — ${issues.join(", ")}. Run /sem-setup for instructions.`,
      "warning",
    );
  });
}

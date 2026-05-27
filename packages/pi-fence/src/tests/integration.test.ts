import * as path from "node:path";
import { verifySandboxInstall } from "@marcfargas/pi-test-harness";
import { describe, expect, it } from "vitest";

/**
 * Smoke test: pack the extension via `npm pack`, install it in a temp sandbox,
 * load it through the real pi runtime, and assert the extension registers.
 *
 * Catches packaging bugs (missing files, wrong `pi.extensions` path) before
 * any release.
 */
describe("pi-fence smoke (sandbox install)", { timeout: 120_000 }, () => {
  it("packs and installs cleanly; extension registers without errors", async () => {
    const packageDir = path.resolve(import.meta.dirname, "../..");
    const result = await verifySandboxInstall({
      packageDir,
      expect: {
        extensions: 1,
        tools: [],
      },
    });

    expect(result.loaded.extensionErrors).toEqual([]);
  });
});

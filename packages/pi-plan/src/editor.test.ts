import { describe, expect, it, vi } from "vitest";
import { detectEditor } from "./editor.js";

describe("detectEditor", () => {
  it("detects Zed when TERM_PROGRAM=zed", () => {
    const editor = detectEditor({ TERM_PROGRAM: "zed" });
    expect(editor).not.toBeNull();
    expect(editor?.name).toBe("Zed");
  });

  it("detects VS Code when TERM_PROGRAM=vscode", () => {
    const editor = detectEditor({ TERM_PROGRAM: "vscode" });
    expect(editor).not.toBeNull();
    expect(editor?.name).toBe("VS Code");
  });

  it("detects Cursor when TERM_PROGRAM=cursor", () => {
    const editor = detectEditor({ TERM_PROGRAM: "cursor" });
    expect(editor).not.toBeNull();
    expect(editor?.name).toBe("Cursor");
  });

  it("detects Windsurf when TERM_PROGRAM=windsurf", () => {
    const editor = detectEditor({ TERM_PROGRAM: "windsurf" });
    expect(editor).not.toBeNull();
    expect(editor?.name).toBe("Windsurf");
  });

  it("returns null for an unknown TERM_PROGRAM value", () => {
    const editor = detectEditor({ TERM_PROGRAM: "kitty" });
    expect(editor).toBeNull();
  });

  it("returns null when TERM_PROGRAM is not set", () => {
    const editor = detectEditor({});
    expect(editor).toBeNull();
  });

  it("is case-insensitive for TERM_PROGRAM", () => {
    const editor = detectEditor({ TERM_PROGRAM: "ZED" });
    expect(editor?.name).toBe("Zed");
  });

  describe("open()", () => {
    function makeSpawnMock() {
      const calls: { cli: string; args: string[]; opts: Record<string, unknown> }[] = [];
      const spawnFn = vi.fn((cli: string, args: string[], opts: Record<string, unknown>) => {
        calls.push({ cli, args, opts });
        const emitter = {
          on(event: string, cb: () => void) {
            if (event === "spawn") {
              setTimeout(cb, 0);
            }
            return emitter;
          },
          unref: vi.fn(),
        };
        return emitter;
      });
      return { spawnFn, calls };
    }

    it("spawns zed with the file path as sole argument", async () => {
      const { spawnFn, calls } = makeSpawnMock();
      const editor = detectEditor({ TERM_PROGRAM: "zed" }, spawnFn);
      expect(editor).not.toBeNull();

      await editor!.open("/some/plan.md");
      expect(calls[0]?.cli).toBe("zed");
      expect(calls[0]?.args).toEqual(["/some/plan.md"]);
      expect(calls[0]?.opts).toMatchObject({ detached: true, stdio: "ignore" });
    });

    it("spawns code with --reuse-window for VS Code", async () => {
      const { spawnFn, calls } = makeSpawnMock();
      const editor = detectEditor({ TERM_PROGRAM: "vscode" }, spawnFn);
      expect(editor).not.toBeNull();

      await editor!.open("/some/plan.md");
      expect(calls[0]?.cli).toBe("code");
      expect(calls[0]?.args).toEqual(["--reuse-window", "/some/plan.md"]);
    });

    it("spawns cursor with --reuse-window for Cursor", async () => {
      const { spawnFn, calls } = makeSpawnMock();
      const editor = detectEditor({ TERM_PROGRAM: "cursor" }, spawnFn);
      expect(editor).not.toBeNull();

      await editor!.open("/some/plan.md");
      expect(calls[0]?.cli).toBe("cursor");
      expect(calls[0]?.args).toEqual(["--reuse-window", "/some/plan.md"]);
    });
  });
});

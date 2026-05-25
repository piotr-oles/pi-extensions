import { describe, expect, it, vi } from "vitest";
import { checkSemStatus, registerSemStartupCheck } from "../setup.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExec(responses: Record<string, { code: number }>) {
  return vi.fn().mockImplementation(async (cmd: string, args: string[]) => {
    const key = `${cmd} ${args[0]}`;
    const response = responses[key] ?? { code: 127 };
    return { stdout: "", stderr: "", code: response.code, killed: false };
  });
}

function buildMockPi(execResponses: Record<string, { code: number }>) {
  const exec = makeExec(execResponses);
  const notifyMock = vi.fn();
  const registerCommandMock = vi.fn();
  let sessionStartHandler: ((event: unknown, ctx: unknown) => Promise<void>) | undefined;

  const pi = {
    exec,
    registerCommand: registerCommandMock,
    on: vi.fn((event: string, handler: (event: unknown, ctx: unknown) => Promise<void>) => {
      if (event === "session_start") sessionStartHandler = handler;
    }),
  };

  const ctx = {
    cwd: "/project",
    ui: { notify: notifyMock },
  };

  const fireSessionStart = () => sessionStartHandler?.({}, ctx);

  return { pi, exec, notifyMock, registerCommandMock, fireSessionStart };
}

const ALL_OK = { "sem --version": { code: 0 }, "git check-ignore": { code: 0 } };
const SEM_MISSING = { "sem --version": { code: 127 }, "git check-ignore": { code: 0 } };
const NOT_IGNORED = { "sem --version": { code: 0 }, "git check-ignore": { code: 1 } };
const BOTH_FAIL = { "sem --version": { code: 127 }, "git check-ignore": { code: 1 } };

// ---------------------------------------------------------------------------
// checkSemStatus
// ---------------------------------------------------------------------------

describe("checkSemStatus", () => {
  it("returns semAvailable=true when sem exits 0", async () => {
    const exec = makeExec(ALL_OK);
    const status = await checkSemStatus({ exec } as any);
    expect(status.semAvailable).toBe(true);
  });

  it("returns semAvailable=false when sem exits non-zero", async () => {
    const exec = makeExec(SEM_MISSING);
    const status = await checkSemStatus({ exec } as any);
    expect(status.semAvailable).toBe(false);
  });

  it("returns semAvailable=false when exec throws", async () => {
    const exec = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === "sem") throw new Error("ENOENT");
      return { stdout: "", stderr: "", code: 0, killed: false };
    });
    const status = await checkSemStatus({ exec } as any);
    expect(status.semAvailable).toBe(false);
  });

  it("returns semIgnored=true when git check-ignore exits 0", async () => {
    const exec = makeExec(ALL_OK);
    const status = await checkSemStatus({ exec } as any);
    expect(status.semIgnored).toBe(true);
  });

  it("returns semIgnored=false when git check-ignore exits 1", async () => {
    const exec = makeExec(NOT_IGNORED);
    const status = await checkSemStatus({ exec } as any);
    expect(status.semIgnored).toBe(false);
  });

  it("returns semIgnored=true (skip check) when git is unavailable", async () => {
    const exec = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === "git") throw new Error("ENOENT");
      return { stdout: "", stderr: "", code: 0, killed: false };
    });
    const status = await checkSemStatus({ exec } as any);
    expect(status.semIgnored).toBe(true);
  });

  it("returns semIgnored=true (skip check) when not in a git repo (exit 128)", async () => {
    const exec = makeExec({ "sem --version": { code: 0 }, "git check-ignore": { code: 128 } });
    const status = await checkSemStatus({ exec } as any);
    expect(status.semIgnored).toBe(true);
  });

  it("uses --no-index flag for git check-ignore", async () => {
    const exec = makeExec(ALL_OK);
    await checkSemStatus({ exec } as any);
    expect(exec).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["check-ignore", "--no-index", "-q", ".sem"]),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// registerSemStartupCheck
// ---------------------------------------------------------------------------

describe("registerSemStartupCheck — session_start", () => {
  it("shows no warning when everything is ok", async () => {
    const { pi, notifyMock, fireSessionStart } = buildMockPi(ALL_OK);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("shows warning when sem binary is missing", async () => {
    const { pi, notifyMock, fireSessionStart } = buildMockPi(SEM_MISSING);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    expect(notifyMock).toHaveBeenCalledOnce();
    expect(notifyMock.mock.calls[0][0]).toContain("sem binary not found");
    expect(notifyMock.mock.calls[0][1]).toBe("warning");
  });

  it("shows warning when .sem is not git-ignored", async () => {
    const { pi, notifyMock, fireSessionStart } = buildMockPi(NOT_IGNORED);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    expect(notifyMock).toHaveBeenCalledOnce();
    expect(notifyMock.mock.calls[0][0]).toContain(".sem/ not in .gitignore");
  });

  it("lists both issues when both checks fail", async () => {
    const { pi, notifyMock, fireSessionStart } = buildMockPi(BOTH_FAIL);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    const msg: string = notifyMock.mock.calls[0][0];
    expect(msg).toContain("sem binary not found");
    expect(msg).toContain(".sem/ not in .gitignore");
  });

  it("mentions /sem-setup in the warning", async () => {
    const { pi, notifyMock, fireSessionStart } = buildMockPi(SEM_MISSING);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    expect(notifyMock.mock.calls[0][0]).toContain("/sem-setup");
  });

  it("registers /sem-setup command on first failure", async () => {
    const { pi, registerCommandMock, fireSessionStart } = buildMockPi(SEM_MISSING);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    expect(registerCommandMock).toHaveBeenCalledOnce();
    expect(registerCommandMock.mock.calls[0][0]).toBe("sem-setup");
  });

  it("does not register /sem-setup command when everything is ok", async () => {
    const { pi, registerCommandMock, fireSessionStart } = buildMockPi(ALL_OK);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    expect(registerCommandMock).not.toHaveBeenCalled();
  });

  it("does not register /sem-setup command twice on repeated session_start", async () => {
    const { pi, registerCommandMock, fireSessionStart } = buildMockPi(SEM_MISSING);
    registerSemStartupCheck(pi as any);
    await fireSessionStart();
    await fireSessionStart();
    expect(registerCommandMock).toHaveBeenCalledOnce();
  });
});

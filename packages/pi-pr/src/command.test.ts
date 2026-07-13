import { describe, expect, it } from "vitest";
import { isPrCreateCommand } from "./command.js";

describe("isPrCreateCommand", () => {
  it("matches a plain gh pr create", () => {
    expect(isPrCreateCommand("gh pr create")).toBe(true);
  });

  it("matches with flags and args", () => {
    expect(isPrCreateCommand("gh pr create --draft --title x --body-file /tmp/b")).toBe(true);
  });

  it("matches when chained after another command", () => {
    expect(isPrCreateCommand("git push -u origin feat/x && gh pr create --fill")).toBe(true);
  });

  it("matches inside a subshell", () => {
    expect(isPrCreateCommand("(gh pr create --draft)")).toBe(true);
  });

  it("does not match other gh pr subcommands", () => {
    expect(isPrCreateCommand("gh pr view --json number")).toBe(false);
    expect(isPrCreateCommand("gh pr edit 54 --body-file /tmp/b")).toBe(false);
    expect(isPrCreateCommand("gh pr list")).toBe(false);
  });

  it("does not match unrelated commands", () => {
    expect(isPrCreateCommand("echo gh pr createx")).toBe(false);
    expect(isPrCreateCommand("gh repo create")).toBe(false);
    expect(isPrCreateCommand("git commit -m 'gh pr create'")).toBe(false);
  });
});

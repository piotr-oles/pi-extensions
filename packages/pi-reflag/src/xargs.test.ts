import { describe, expect, it } from "vitest";
import { xargs } from "./xargs.js";

const xargsGrep = xargs((command) => {
  if (command.name === "grep") {
    return { name: "rg", args: command.args };
  }
});

describe("xargs HOF — direct command", () => {
  it("rewrites matching direct command", () => {
    expect(xargsGrep({ name: "grep", args: ["-l", "pattern"] })).toEqual({
      name: "rg",
      args: ["-l", "pattern"],
    });
  });

  it("returns undefined for non-matching direct command", () => {
    expect(xargsGrep({ name: "find", args: ["."] })).toBeUndefined();
  });

  it("passes args unchanged", () => {
    expect(xargsGrep({ name: "grep", args: ["-r", "-n", "foo", "src/"] })).toEqual({
      name: "rg",
      args: ["-r", "-n", "foo", "src/"],
    });
  });
});

describe("xargs HOF — xargs prefix", () => {
  it("rewrites xargs matching-command", () => {
    expect(xargsGrep({ name: "xargs", args: ["grep", "-l", "pattern"] })).toEqual({
      name: "xargs",
      args: ["rg", "-l", "pattern"],
    });
  });

  it("preserves xargs name in output", () => {
    const result = xargsGrep({ name: "xargs", args: ["grep", "foo"] });
    expect(result?.name).toBe("xargs");
  });

  it("returns undefined for xargs non-matching-command", () => {
    expect(xargsGrep({ name: "xargs", args: ["find", "."] })).toBeUndefined();
  });

  it("returns undefined for bare xargs with no subcommand", () => {
    expect(xargsGrep({ name: "xargs", args: [] })).toBeUndefined();
  });

  it("forwards all subcommand args", () => {
    expect(xargsGrep({ name: "xargs", args: ["grep", "-r", "-n", "foo", "src/"] })).toEqual({
      name: "xargs",
      args: ["rg", "-r", "-n", "foo", "src/"],
    });
  });
});

describe("xargs HOF — leading xargs flags", () => {
  it("skips single xargs flag -r before subcommand", () => {
    expect(xargsGrep({ name: "xargs", args: ["-r", "grep", "-l", "pattern"] })).toEqual({
      name: "xargs",
      args: ["-r", "rg", "-l", "pattern"],
    });
  });

  it("skips multiple xargs flags before subcommand", () => {
    expect(xargsGrep({ name: "xargs", args: ["-r", "-t", "grep", "pattern"] })).toEqual({
      name: "xargs",
      args: ["-r", "-t", "rg", "pattern"],
    });
  });

  it("skips -0 flag before subcommand", () => {
    expect(xargsGrep({ name: "xargs", args: ["-0", "grep", "pattern"] })).toEqual({
      name: "xargs",
      args: ["-0", "rg", "pattern"],
    });
  });

  it("skips -n N (flag with arg) before subcommand", () => {
    expect(xargsGrep({ name: "xargs", args: ["-n", "10", "grep", "pattern"] })).toEqual({
      name: "xargs",
      args: ["-n", "10", "rg", "pattern"],
    });
  });

  it("returns undefined when only xargs flags, no subcommand", () => {
    expect(xargsGrep({ name: "xargs", args: ["-r", "-t"] })).toBeUndefined();
  });

  it("returns undefined when xargs flags followed by non-matching subcommand", () => {
    expect(xargsGrep({ name: "xargs", args: ["-r", "find", "."] })).toBeUndefined();
  });
});

describe("xargs HOF — unrelated commands untouched", () => {
  it("ignores echo", () => {
    expect(xargsGrep({ name: "echo", args: ["hello"] })).toBeUndefined();
  });

  it("ignores xargs echo", () => {
    expect(xargsGrep({ name: "xargs", args: ["echo", "hello"] })).toBeUndefined();
  });
});

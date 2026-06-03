import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toTildePath } from "./utils.js";

describe("toTildePath", () => {
  it("replaces home directory prefix with ~", () => {
    const home = homedir();
    expect(toTildePath(join(home, "foo", "bar"))).toBe("~/foo/bar");
  });

  it("replaces exact home directory with ~", () => {
    expect(toTildePath(homedir())).toBe("~");
  });

  it("leaves paths outside home directory unchanged", () => {
    expect(toTildePath("/etc/passwd")).toBe("/etc/passwd");
  });

  it("leaves relative paths unchanged", () => {
    expect(toTildePath("relative/path")).toBe("relative/path");
  });
});

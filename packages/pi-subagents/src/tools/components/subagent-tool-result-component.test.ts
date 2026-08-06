import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { makeDone, mockTheme } from "../../test-helpers.js";
import { SubagentToolResultComponent } from "./subagent-tool-result-component.js";

describe("SubagentToolResultComponent", () => {
  it("renders multiline errors as a single-line summary", () => {
    const entry = {
      ...makeDone({
        result: {
          status: "error",
          error: "No API key found for google.\n\nUse /login to log into a provider via",
        },
      }).toEntry(),
      duration: 1_000,
    };
    const component = new SubagentToolResultComponent(entry, mockTheme, false, () => {});

    const summary = stripAnsi(component.render(120)[0]).trimEnd();

    expect(summary).toBe("✗ No API key found for google. · 0 · 1.0s");
  });
});

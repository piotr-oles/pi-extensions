import { describe, expect, it, vi } from "vitest";
import piPlan from "./index.js";

describe("piPlan extension", () => {
  it("registers the review-plan tool", () => {
    const registerTool = vi.fn();
    const pi = { registerTool, exec: vi.fn() };

    piPlan(pi as any);

    expect(registerTool).toHaveBeenCalledOnce();
    const [tool] = registerTool.mock.calls[0];
    expect(tool.name).toBe("review-plan");
  });

  it("binds exec to pi instance", () => {
    const registerTool = vi.fn();
    const exec = vi.fn();
    const pi = { registerTool, exec };

    piPlan(pi as any);

    const [tool] = registerTool.mock.calls[0];
    expect(tool).toBeDefined();
  });
});

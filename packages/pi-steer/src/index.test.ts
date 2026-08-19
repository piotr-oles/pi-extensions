import { createTestSession, says, type TestSession, when } from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it } from "vitest";
import piSteer from "./index.js";
import { loadSection, SECTIONS } from "./sections.js";

const originalPiSteer = process.env.PI_STEER;

describe("pi-steer", { timeout: 30_000 }, () => {
  let t: TestSession;

  afterEach(() => {
    t?.dispose();
    if (originalPiSteer === undefined) {
      delete process.env.PI_STEER;
    } else {
      process.env.PI_STEER = originalPiSteer;
    }
  });

  it("appends all instructions to the system prompt", async () => {
    delete process.env.PI_STEER;
    t = await createTestSession({
      extensionFactories: [piSteer],
      systemPrompt: "Base system prompt",
    });

    await t.run(when("Test pi-steer", [says("Done.")]));

    const expectedInstructions = SECTIONS.map((name) => loadSection(name)).join("\n\n");
    expect(t.session.agent.state.systemPrompt).toContain("Base system prompt");
    expect(t.session.agent.state.systemPrompt).toContain(expectedInstructions);
    expect(t.session.sessionManager.getEntries()).toContainEqual(
      expect.objectContaining({
        type: "custom",
        customType: "pi-steer",
        data: { names: [...SECTIONS], text: expectedInstructions },
      }),
    );
  });

  it("restores persisted instructions after extension reload", async () => {
    process.env.PI_STEER = "ste100";
    t = await createTestSession({
      extensionFactories: [piSteer],
      systemPrompt: "Base system prompt",
    });
    await t.run(when("First turn", [says("Done.")]));

    process.env.PI_STEER = "craftsmanship";
    await t.session.reload();
    await t.run(when("Second turn", [says("Done.")]));

    expect(t.session.agent.state.systemPrompt).toContain(loadSection("ste100"));
    expect(t.session.agent.state.systemPrompt).not.toContain(loadSection("craftsmanship"));
    expect(
      t.session.sessionManager
        .getEntries()
        .filter(
          (entry: { type: string; customType?: string }) =>
            entry.type === "custom" && entry.customType === "pi-steer",
        ),
    ).toHaveLength(1);
  });
});

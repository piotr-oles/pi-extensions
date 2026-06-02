import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestSession, says, type TestSession, when } from "@marcfargas/pi-test-harness";
import { afterEach, describe, expect, it } from "vitest";
import piCaveman from "./index.js";

function cavemanExtension() {
  return (pi: any) => piCaveman(pi);
}

describe("instruction files", () => {
  it.each(["lite", "full", "ultra"])("%s.md loads and starts with IMPORTANT directive", (level) => {
    const content = readFileSync(join(import.meta.dirname, `../instructions/${level}.md`), "utf-8");
    expect(content).toContain("IMPORTANT:");
  });
});

describe("input auto-detection", { timeout: 30_000 }, () => {
  let t: TestSession;
  afterEach(() => t?.dispose());

  it("activates full mode on 'caveman mode' trigger", async () => {
    t = await createTestSession({ extensionFactories: [cavemanExtension()] });
    await t.run(when("use caveman mode", [says("ok")]));
    const [notification] = t.events.uiCallsFor("notify");
    expect(notification.args[0]).toBe("Caveman mode active. Drop articles, fragments ok.");
    expect(notification.args[1]).toBe("info");
  });

  it("activates lite mode when 'lite' in trigger phrase", async () => {
    t = await createTestSession({ extensionFactories: [cavemanExtension()] });
    await t.run(when("use caveman lite mode", [says("ok")]));
    const [notification] = t.events.uiCallsFor("notify");
    expect(notification.args[0]).toBe("Caveman Lite active. Drop filler, keep grammar.");
  });

  it("activates ultra mode when 'ultra' in trigger phrase", async () => {
    t = await createTestSession({ extensionFactories: [cavemanExtension()] });
    await t.run(when("use caveman ultra mode", [says("ok")]));
    const [notification] = t.events.uiCallsFor("notify");
    expect(notification.args[0]).toBe("Caveman Ultra active. Maximum compression.");
  });

  it("deactivates on 'stop caveman' trigger", async () => {
    t = await createTestSession({ extensionFactories: [cavemanExtension()] });
    await t.run(when("ok stop caveman now", [says("ok")]));
    const [notification] = t.events.uiCallsFor("notify");
    expect(notification.args[0]).toBe("Caveman go away.");
    expect(notification.args[1]).toBe("info");
  });

  it("deactivates on 'normal mode' trigger", async () => {
    t = await createTestSession({ extensionFactories: [cavemanExtension()] });
    await t.run(when("switch to normal mode", [says("ok")]));
    const [notification] = t.events.uiCallsFor("notify");
    expect(notification.args[0]).toBe("Caveman go away.");
  });
});

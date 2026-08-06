import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import piBell from "./index.js";

type AgentEndHandler = (event: AgentEndEvent, ctx: ExtensionContext) => Promise<void> | void;

function makeContext(hasUI: boolean): ExtensionContext {
  return { hasUI } as ExtensionContext;
}

function captureAgentEndHandler(): AgentEndHandler {
  let handler: AgentEndHandler | undefined;
  const pi = {
    on(event: string, registered: AgentEndHandler) {
      if (event === "agent_end") {
        handler = registered;
      }
    },
  } as unknown as ExtensionAPI;

  piBell(pi);
  return handler!;
}

describe("pi-bell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not ring when non-interactive agent finishes", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const onAgentEnd = captureAgentEndHandler();

    await onAgentEnd({} as AgentEndEvent, makeContext(false));

    expect(write).not.toHaveBeenCalled();
  });

  it("rings terminal bell when interactive agent finishes", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const onAgentEnd = captureAgentEndHandler();

    await onAgentEnd({} as AgentEndEvent, makeContext(true));

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith("\x07");
  });
});

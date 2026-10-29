import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import piPr from "./index.js";

const openPrJson = JSON.stringify({ number: 7, url: "https://example.com/pr/7" });

describe("piPr refresh lifecycle", () => {
  it("cancels a pending request on shutdown and ignores its result", async () => {
    const host = createHarness();
    const session = host.createSession();
    const command = session.openPr();
    const request = await host.nextRequest();

    session.shutdown();
    expect(request.signal?.aborted).toBe(true);

    // A cancelled process can still return output before it exits.
    request.respond(openPrJson);
    await expect(command).resolves.toBeUndefined();
    expect(session.footer()).toBeUndefined();
  });

  it("keeps a newer request cancellable after an old cancelled request completes", async () => {
    const host = createHarness();
    const first = host.createSession();
    const oldCommand = first.openPr();
    const oldRequest = await host.nextRequest();
    first.shutdown();

    const second = host.createSession();
    const newCommand = second.openPr();
    const newRequest = await host.nextRequest();

    oldRequest.respond(openPrJson);
    await expect(oldCommand).resolves.toBeUndefined();

    // The newer request must remain active until its own session shuts down.
    expect(newRequest.signal?.aborted).toBe(false);
    second.shutdown();
    expect(newRequest.signal?.aborted).toBe(true);

    newRequest.respond(openPrJson);
    await expect(newCommand).resolves.toBeUndefined();
    expect(first.footer()).toBeUndefined();
    expect(second.footer()).toBeUndefined();
  });

  it("shows the current PR in the footer when a session starts", async () => {
    const host = createHarness();
    const session = host.createSession();

    session.start();
    const request = await host.nextRequest();
    request.respond(openPrJson);

    await vi.waitFor(() => expect(session.footer()).toContain("#7"));
  });
});

interface PendingRequest {
  signal: AbortSignal | undefined;
  respond: (stdout: string) => void;
}

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
  killed: boolean;
}

/** Run the real extension through its host API. Fake only process execution and UI. */
function createHarness() {
  const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => void>();
  const commands = new Map<
    string,
    { handler: (args: string, ctx: ExtensionContext) => Promise<void> }
  >();
  const requests: PendingRequest[] = [];
  const flags = new Map<string, string>();

  const pi = {
    registerFlag: (name: string, opts: { default?: string }) => {
      if (opts.default !== undefined) {
        flags.set(name, opts.default);
      }
    },
    getFlag: (name: string) => flags.get(name),
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => void) => {
      handlers.set(event, handler);
    },
    registerCommand: (
      name: string,
      def: { handler: (args: string, ctx: ExtensionContext) => Promise<void> },
    ) => {
      commands.set(name, def);
    },
    exec: (_cmd: string, args: string[], opts: { signal?: AbortSignal }) => {
      if (args.includes("--web")) {
        return Promise.resolve(ghResult(""));
      }
      return new Promise<ExecResult>((resolve) => {
        requests.push({
          signal: opts.signal,
          respond: (stdout) => resolve(ghResult(stdout)),
        });
      });
    },
  } as unknown as ExtensionAPI;

  piPr(pi);

  return {
    createSession: () => {
      const statuses = new Map<string, string | undefined>();
      const ctx = {
        ui: {
          setStatus: (key: string, text: string | undefined) => statuses.set(key, text),
          theme: { fg: (_color: string, text: string) => text },
        },
      } as unknown as ExtensionContext;
      const shutdown = () => handlers.get("session_shutdown")!({}, ctx);
      onTestFinished(shutdown);

      return {
        start: () => handlers.get("session_start")!({}, ctx),
        shutdown,
        openPr: () => commands.get("pr")!.handler("", ctx),
        footer: () => statuses.get("pi-pr"),
      };
    },
    nextRequest: () =>
      vi.waitFor(() => {
        const request = requests.shift();
        if (!request) {
          throw new Error("No pending gh request");
        }
        return request;
      }),
  };
}

function ghResult(stdout: string): ExecResult {
  return { stdout, stderr: "", code: 0, killed: false };
}

import type { CustomEntry, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getSelection, loadSection, type Section } from "./sections.js";

const SNAPSHOT_ENTRY_TYPE = "pi-steer";

interface InstructionSnapshot {
  names: Section[];
  text: string;
}

export default function piSteer(pi: ExtensionAPI) {
  let snapshot: InstructionSnapshot;

  pi.registerFlag("pi-steer", {
    type: "string",
    description:
      "Steer model behavior by composing instruction sections into the system prompt (comma-separated names; prefix with - to exclude). Default: all. Set to off to disable.",
  });

  pi.on("session_start", async (_event, ctx) => {
    const persistedSnapshot = readSnapshot(ctx);
    snapshot = persistedSnapshot ?? createSnapshot(pi);
    if (!persistedSnapshot) {
      pi.appendEntry(SNAPSHOT_ENTRY_TYPE, snapshot);
    }
  });

  pi.on("before_agent_start", async (event) => {
    if (!snapshot.text) {
      return undefined;
    }
    return {
      systemPrompt: `${event.systemPrompt}\n\n${snapshot.text}`,
    };
  });
}

function readSnapshot(ctx: ExtensionContext): InstructionSnapshot | undefined {
  const entry = ctx.sessionManager
    .getBranch()
    .findLast(
      (entry): entry is CustomEntry<InstructionSnapshot> =>
        entry.type === "custom" && entry.customType === SNAPSHOT_ENTRY_TYPE,
    );
  return entry?.data;
}

function createSnapshot(pi: ExtensionAPI): InstructionSnapshot {
  const names = getSelection(pi);
  return {
    names,
    text: names.map((name) => loadSection(name)).join("\n\n"),
  };
}

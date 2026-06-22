import type { DoneSubagent, DoneSubagentSessionEntry } from "./instance/done-subagent.js";
import type { QueuedSubagent, QueuedSubagentSessionEntry } from "./instance/queued-subagent.js";
import type { RunningAgentSessionEntry, RunningSubagent } from "./instance/running-subagent.js";

export type SubagentName = string;
export type SubagentId = string;

export type Subagent = QueuedSubagent | RunningSubagent | DoneSubagent;
export type SubagentStatus = Subagent["status"];
export type SubagentByStatus<TStatus extends SubagentStatus> =
  TStatus extends QueuedSubagent["status"]
    ? QueuedSubagent
    : TStatus extends RunningSubagent["status"]
      ? RunningSubagent
      : TStatus extends DoneSubagent["status"]
        ? DoneSubagent
        : never;

export type SubagentSessionEntry =
  | QueuedSubagentSessionEntry
  | RunningAgentSessionEntry
  | DoneSubagentSessionEntry;

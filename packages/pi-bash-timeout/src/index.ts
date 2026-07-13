import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { buildBashTimeoutPrompt, resolveBashTimeoutDefaults } from "./timeout.js";

export type { BashTimeoutDefaults, BashTimeoutFlags } from "./timeout.js";
export {
  BASH_DEFAULT_TIMEOUT_SECONDS,
  BASH_MAX_TIMEOUT_SECONDS,
  buildBashTimeoutPrompt,
  DEFAULT_TIMEOUT_ENV,
  MAX_TIMEOUT_ENV,
  resolveBashTimeoutDefaults,
} from "./timeout.js";

const DEFAULT_FLAG = "pi-bash-timeout-default";
const MAX_FLAG = "pi-bash-timeout-max";

export default function piBashTimeout(pi: ExtensionAPI): void {
  // No flag `default`: getFlag returns undefined when unset, so the env var
  // (senpi-mono compat) can take over before the built-in constant.
  pi.registerFlag(DEFAULT_FLAG, {
    type: "string",
    description: "Timeout in seconds injected when the model omits `timeout`. Positive integer.",
  });
  pi.registerFlag(MAX_FLAG, {
    type: "string",
    description: "Advisory maximum timeout in seconds shown in prompt guidance. Positive integer.",
  });

  const defaults = resolveBashTimeoutDefaults(
    { default: pi.getFlag(DEFAULT_FLAG), max: pi.getFlag(MAX_FLAG) },
    process.env,
  );
  const promptSection = buildBashTimeoutPrompt(defaults);

  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("bash", event)) {
      return;
    }
    const timeout = event.input.timeout;
    if (timeout === undefined || timeout <= 0) {
      event.input.timeout = defaults.defaultSeconds;
    }
  });

  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}${promptSection}`,
  }));
}

import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { buildBashTimeoutPrompt, resolveBashTimeoutConfig } from "./timeout.js";

export type { BashTimeoutConfig as BashTimeoutDefaults, BashTimeoutFlags } from "./timeout.js";
export {
  BASH_DEFAULT_TIMEOUT_SECONDS,
  BASH_MAX_TIMEOUT_SECONDS,
  buildBashTimeoutPrompt,
  DEFAULT_TIMEOUT_ENV,
  MAX_TIMEOUT_ENV,
  resolveBashTimeoutConfig,
} from "./timeout.js";

const DEFAULT_FLAG = "pi-bash-timeout-default";
const MAX_FLAG = "pi-bash-timeout-max";

export default function piBashTimeout(pi: ExtensionAPI): void {
  pi.registerFlag(DEFAULT_FLAG, {
    type: "string",
    description: "Timeout in seconds injected when the model omits `timeout`. Positive integer.",
  });
  pi.registerFlag(MAX_FLAG, {
    type: "string",
    description: "Maximum allowed bash timeout in seconds. Positive integer.",
  });

  const config = resolveBashTimeoutConfig(
    { default: pi.getFlag(DEFAULT_FLAG), max: pi.getFlag(MAX_FLAG) },
    process.env,
  );
  const promptSection = buildBashTimeoutPrompt(config);

  pi.on("tool_call", (event) => {
    if (!isToolCallEventType("bash", event)) {
      return;
    }
    const timeout = event.input.timeout;
    if (timeout === undefined || timeout <= 0) {
      event.input.timeout = config.defaultSeconds;
    } else if (timeout > config.maxSeconds) {
      event.input.timeout = config.maxSeconds;
    }
  });

  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${promptSection}`,
  }));
}

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSemContext } from "./tools/sem_context.js";
import { registerSemDiff } from "./tools/sem_diff.js";
import { registerSemEntities } from "./tools/sem_entities.js";
import { registerSemImpact } from "./tools/sem_impact.js";

const SEM_INSTRUCTIONS = `
## Semantic Code Navigation (sem tools)

Prefer sem tools over bash/rg/find/cat/read for all code exploration:
- **Discovery** — use sem_entities (not find/rg) to list functions, classes, and types in a file or directory
- **Reading** — use sem_context (not read/cat) for high-level entity inspection; use read only when you need to edit the file
- **Impact** — use sem_impact before modifying an entity to see what callers and tests depend on it
- **Diff** — use sem_diff (not bash+git-diff) to review semantic changes grouped by entity
- Fall back to rg/find/read/cat only when sem tools fail or for non-code content (configs, logs, plain text)
`.trim();

export default function semPi(pi: ExtensionAPI) {
  registerSemContext(pi);
  registerSemEntities(pi);
  registerSemImpact(pi);
  registerSemDiff(pi);

  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt: `${event.systemPrompt}\n\n${SEM_INSTRUCTIONS}`,
    };
  });
}

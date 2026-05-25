import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSemContext } from "./tools/sem_context.js";
import { registerSemDiff } from "./tools/sem_diff.js";
import { registerSemEntities } from "./tools/sem_entities.js";
import { registerSemImpact } from "./tools/sem_impact.js";

export default function semPi(pi: ExtensionAPI) {
  registerSemContext(pi);
  registerSemEntities(pi);
  registerSemImpact(pi);
  registerSemDiff(pi);
}

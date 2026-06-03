import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createReviewPlanTool } from "./plan-tool.js";

export default function piPlan(pi: ExtensionAPI): void {
  pi.registerTool(createReviewPlanTool(pi.exec.bind(pi)));
}

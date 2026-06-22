import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

export function buildModelKey(provider: string, id: string): string {
  return `${provider} / ${id}`;
}

export function findModel(
  registry: ModelRegistry,
  name: string | undefined,
): Model<Api> | undefined {
  if (!name) {
    return undefined;
  }
  const models = registry.getAvailable();
  if (!models || models.length === 0) {
    return undefined;
  }

  const exact = models.find(
    (model) => buildModelKey(model.provider, model.id) === name || model.id === name,
  );
  if (exact) {
    return exact;
  }

  const lower = name.toLowerCase();
  return models.find(
    (model) => model.id.toLowerCase().includes(lower) || model.name.toLowerCase().includes(lower),
  );
}

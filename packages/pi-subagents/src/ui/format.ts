import type { ContextUsage } from "@earendil-works/pi-coding-agent";

export function formatUsage(usage: ContextUsage | undefined): string {
  const formatted = formatSi(usage?.tokens ?? 0);
  if (usage?.percent) {
    return `${formatted} (${usage.percent.toFixed(1)}%)`;
  }
  return `${formatted}`;
}

const SI_THRESHOLDS: { value: number; suffix: string }[] = [
  { value: 1e18, suffix: "E" },
  { value: 1e15, suffix: "P" },
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "G" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];

export function formatSi(n: number, precision = 1): string {
  for (const { value, suffix } of SI_THRESHOLDS) {
    if (Math.abs(n) >= value) {
      return `${(n / value).toFixed(precision)}${suffix}`;
    }
  }
  return String(n);
}

export function formatDuration(ms: number): string {
  return ms >= 60_000
    ? `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`
    : `${(ms / 1000).toFixed(1)}s`;
}

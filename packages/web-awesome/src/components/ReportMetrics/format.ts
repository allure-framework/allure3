import { filesize } from "filesize";

import type { MetricRow } from "@/stores/metrics";

export const formatValue = (value: number, unit?: string) => {
  if (unit === "bytes") return filesize(value, { base: 2, round: 2 });
  if (unit === "ms" && Math.abs(value) >= 1000) return `${Number((value / 1000).toFixed(2))} s`;
  const formatted = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
  return unit ? `${formatted} ${unit}` : formatted;
};

export const deltaDirection = ({ delta, better = "neutral" }: { delta?: number; better?: MetricRow["better"] }) => {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0 || better === "neutral") return "neutral";
  return (better === "lower" ? delta < 0 : delta > 0) ? "good" : "bad";
};

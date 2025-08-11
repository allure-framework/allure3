import type { BarGroup, ChartMode } from "@allurereport/core-api";
import type { CSSProperties } from "preact/compat";

export interface BarChartWidgetProps {
  title: string;
  mode: ChartMode;
  data: BarGroup<string, string>[];
  keys: readonly string[];
  indexBy: string;
  groupMode: "grouped" | "stacked";
  height?: CSSProperties["height"];
  width?: CSSProperties["width"];
  rootAriaLabel?: string;
  colors: Record<string, string>;
  translations: Record<string, string>;
}

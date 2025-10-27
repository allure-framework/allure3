import type { BarGroup, ChartMode } from "@allurereport/charts-api";
import type { CSSProperties } from "preact/compat";

type AxisConfig = {
  legend?: string;
  enabled?: boolean;
  format?: string;
  tickValues?: number | number[];
};

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
  yAxisConfig?: AxisConfig;
  xAxisConfig?: AxisConfig;
}

import type { BarDatum, ResponsiveBarSvgProps } from "@nivo/bar";
import type { CSSProperties } from "preact/compat";

export interface BarChartProps<D extends BarDatum> extends ResponsiveBarSvgProps<D> {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  rootAriaLabel?: string;
  emptyLabel?: string;
  emptyAriaLabel?: string;
}

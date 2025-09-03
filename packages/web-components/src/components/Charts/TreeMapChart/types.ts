import type { TreeMapSvgProps, DefaultTreeMapDatum } from "@nivo/treemap";
import type { CSSProperties } from "preact/compat";

// Original missing type from nivo
export type ResponsiveTreeChartProps<Datum extends DefaultTreeMapDatum = DefaultTreeMapDatum> = Omit<TreeMapSvgProps<Datum>, "width" | "height">;

export interface TreeMapChartProps<Datum extends DefaultTreeMapDatum = DefaultTreeMapDatum> extends ResponsiveTreeChartProps<Datum> {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  rootAriaLabel?: string;
  emptyLabel?: string;
  emptyAriaLabel?: string;
}

export type TreeMapChartNode = DefaultTreeMapDatum;

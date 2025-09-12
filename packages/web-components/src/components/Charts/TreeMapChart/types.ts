import type { TreeMapNode } from "@allurereport/core-api";
import type { TreeMapSvgProps, DefaultTreeMapDatum } from "@nivo/treemap";
import type { CSSProperties } from "preact/compat";

// Original missing type from nivo
export type ResponsiveTreeChartProps<Datum extends DefaultTreeMapDatum = TreeMapNode> = Omit<TreeMapSvgProps<Datum>, "width" | "height">;

export interface TreeMapChartProps<Datum extends DefaultTreeMapDatum = TreeMapNode> extends ResponsiveTreeChartProps<Datum> {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  rootAriaLabel?: string;
  emptyLabel?: string;
  emptyAriaLabel?: string;
  showLegend?: boolean;
  legendMinValue?: number;
  legendMaxValue?: number;
}

export type TreeMapChartNode = DefaultTreeMapDatum;

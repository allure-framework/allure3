import type { TreeMapNode } from "@allurereport/charts-api";
import type { TreeMapTooltipAccessor } from "@allurereport/web-commons";
import type { DefaultTreeMapDatum, TreeMapSvgProps } from "@nivo/treemap";
import type { CSSProperties } from "preact/compat";

// Original missing type from nivo
export type ResponsiveTreeChartProps<Datum extends DefaultTreeMapDatum = TreeMapNode> = Omit<
  TreeMapSvgProps<Datum>,
  "width" | "height"
>;

export interface ParentLabelControlOptions {
  parentSkipSize?: number;
}

type BaseTreeMapChartProps<Datum extends DefaultTreeMapDatum = TreeMapNode> = Omit<
  ResponsiveTreeChartProps<Datum>,
  "colors" | "tooltip"
> &
  ParentLabelControlOptions;

export interface TreeMapChartProps<Datum extends DefaultTreeMapDatum = TreeMapNode>
  extends BaseTreeMapChartProps<Datum> {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  rootAriaLabel?: string;
  emptyLabel?: string;
  emptyAriaLabel?: string;
  showLegend?: boolean;
  legendMinValue?: number;
  legendMaxValue?: number;
  colors: (value: number, domain?: number[]) => string;
  formatLegend?: (value: number) => string;
  legendDomain?: number[];
  tooltipRows?: TreeMapTooltipAccessor;
}

export type TreeMapChartNode = DefaultTreeMapDatum;

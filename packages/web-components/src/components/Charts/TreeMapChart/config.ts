import type { DefaultTreeMapDatum } from "@nivo/treemap";
import type { ResponsiveTreeChartProps } from "./types.js";

export const defaultTreeChartConfig: Partial<ResponsiveTreeChartProps<DefaultTreeMapDatum>> = {
  nodeOpacity: 1,
  borderWidth: 1,
  labelSkipSize: 12,
  parentLabelSize: 14,
  parentLabelPosition: "top",
  parentLabelPadding: 6,
  enableParentLabel: true,
  animate: true,
  innerPadding: 4,
  outerPadding: 4,
};

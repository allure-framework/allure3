import type { DefaultTreeMapDatum } from "@nivo/treemap";
import type { ResponsiveTreeChartProps } from "./types.js";

export const defaultTreeChartConfig: Partial<ResponsiveTreeChartProps<DefaultTreeMapDatum>> = {
  nodeOpacity: 1,
  borderWidth: 1,
  borderColor: "var(--on-border-muted)",
  labelSkipSize: 12,
  labelTextColor: "var(--on-text-primary)",
  parentLabelTextColor: "var(--on-text-primary)",
  parentLabelSize: 14,
  parentLabelPosition: "top",
  parentLabelPadding: 6,
  enableParentLabel: true,
  animate: true,
};

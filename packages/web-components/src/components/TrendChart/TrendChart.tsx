import { ResponsiveLine } from "@nivo/line";
import type { FunctionalComponent } from "preact";
import { defaultTrendChartConfig } from "./config";
import type { TrendChartProps } from "./types";

export const TrendChart: FunctionalComponent<TrendChartProps> = ({
  width = 600,
  height = 400,
  rootArialLabel,
  ...restProps
}) => {
  return (
    // Accessible container for the trend diagram
    <div role="img" aria-label={rootArialLabel} tabIndex={0} style={{ width, height }}>
      <ResponsiveLine
        {...defaultTrendChartConfig}
        {...restProps}
      />
    </div>
  );
};

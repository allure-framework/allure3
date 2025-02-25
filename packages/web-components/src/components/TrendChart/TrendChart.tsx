import { ResponsiveLine } from "@nivo/line";
import type { FunctionalComponent } from "preact";
import { defaultTrendChartConfig } from "./config";
import { type TrendChartProps, TrendChartKind } from "./types";
import { getKindConfig } from "./utils";

export const TrendChart: FunctionalComponent<TrendChartProps> = ({
  kind = TrendChartKind.mesh,
  width = 600,
  height = 400,
  rootArialLabel,
  ...restProps
}) => {
  const kindConfig = getKindConfig(kind);

  return (
    // Accessible container for the trend diagram
    <div role="img" aria-label={rootArialLabel} tabIndex={0} style={{ width, height }}>
      <ResponsiveLine
        {...defaultTrendChartConfig}
        {...kindConfig}
        {...restProps}
      />
    </div>
  );
};

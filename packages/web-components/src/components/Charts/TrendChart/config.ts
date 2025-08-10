import type { AxisProps } from "@nivo/axes";
import type { Margin } from "@nivo/core";
import type { LegendProps } from "@nivo/legends";
import type { LineSvgProps } from "@nivo/line";
import type { ScaleSpec } from "@nivo/scales";

export const defaultTrendChartLegendConfig: LegendProps = {
  anchor: "right",
  direction: "column",
  justify: false,
  translateX: 100,
  translateY: 0,
  itemsSpacing: 0,
  itemDirection: "left-to-right",
  itemWidth: 80,
  itemHeight: 20,
  itemOpacity: 0.75,
  symbolSize: 12,
  symbolShape: "square",
  symbolBorderColor: "rgba(0, 0, 0, .5)",
  effects: [
    {
      on: "hover",
      style: {
        itemBackground: "rgba(0, 0, 0, .03)",
        itemOpacity: 1,
      },
    },
  ],
};

export const defaultTrendChartAxisBottomConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 45,
  ticksPosition: "before",
};

export const defaultTrendChartAxisLeftConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 0,
};

export const defaultTrendChartMarginConfig: Margin = { top: 60, right: 110, bottom: 60, left: 80 };

export const defaultTrendChartXScaleConfig: ScaleSpec = { type: "point" };

export const defaultTrendChartYScaleConfig: ScaleSpec = { type: "linear", min: "auto", max: "auto", reverse: false };

export const defaultTrendChartConfig: Partial<LineSvgProps> = {
  margin: defaultTrendChartMarginConfig,
  xScale: defaultTrendChartXScaleConfig,
  yScale: defaultTrendChartYScaleConfig,
  axisTop: null,
  axisRight: null,
  axisBottom: defaultTrendChartAxisBottomConfig,
  axisLeft: defaultTrendChartAxisLeftConfig,
  useMesh: true,
  enableArea: true,
};

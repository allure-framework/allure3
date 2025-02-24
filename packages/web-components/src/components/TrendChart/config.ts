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
  symbolShape: "circle",
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

export const defaultAxisBottomConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 45,
  ticksPosition: "before",
};

export const defaultAxisLeftConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 0,
};

export const defaultMarginConfig: Margin = { top: 50, right: 100, bottom: 50, left: 60 };

export const defaultXScaleConfig: ScaleSpec = { type: "point" };

export const defaultYScaleConfig: ScaleSpec = { type: "linear", min: "auto", max: "auto", reverse: false };

export const defaultTrendChartConfig: Partial<LineSvgProps> = {
  margin: defaultMarginConfig,
  xScale: defaultXScaleConfig,
  yScale: defaultYScaleConfig,
  axisTop: null,
  axisRight: null,
  axisBottom: defaultAxisBottomConfig,
  axisLeft: defaultAxisLeftConfig,
  useMesh: true,
  enableArea: true,
};

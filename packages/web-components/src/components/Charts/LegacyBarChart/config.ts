import type { AxisProps } from "@nivo/axes";
import type { BarDatum, BarLegendProps, ResponsiveBarSvgProps } from "@nivo/bar";
import type { Margin } from "@nivo/core";

export const defaultBarChartMarginConfig: Margin = { top: 60, right: 110, bottom: 60, left: 80 };

export const defaultBarChartAxisBottomConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 0,
};

export const defaultBarChartAxisLeftConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 0,
};

export const defaultBarChartLegendsConfig: BarLegendProps = {
  dataFrom: "keys",
  anchor: "right",
  direction: "column",
  justify: false,
  translateX: 100,
  translateY: 0,
  itemsSpacing: 0,
  itemWidth: 80,
  itemHeight: 20,
  itemDirection: "left-to-right",
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

export const defaultBarChartConfig: Partial<ResponsiveBarSvgProps<BarDatum>> = {
  margin: defaultBarChartMarginConfig,
  labelTextColor: "inherit:darker(1.4)",
  labelSkipWidth: 16,
  labelSkipHeight: 16,
  axisBottom: defaultBarChartAxisBottomConfig,
  axisLeft: defaultBarChartAxisLeftConfig,
};

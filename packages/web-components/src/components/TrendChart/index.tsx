import type { FunctionalComponent } from "preact";
import { ResponsiveLine } from "@nivo/line";
import type { LineSvgProps } from "@nivo/line";
import type { LegendProps } from "@nivo/legends";
import type { AxisProps } from "@nivo/axes";
import type { CSSProperties } from "preact/compat";

export interface TrendChartDataItem {
  x: string | number | Date;
  y: number;
}

// Define the data structure for each series in the trend diagram
export interface TrendChartData {
  id: string;
  data: TrendChartDataItem[];
}

export interface TrendChartProps extends Partial<LineSvgProps> {
  data: TrendChartData[]; // Array of series data for the trend diagram
  rootArialLabel: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

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
        itemOpacity: 1
      }
    }
  ]
};

export const defaultAxisBottomConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 45,
};

export const defaultAxisLeftConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 0,
};

export const defaultTrendChartConfig: Partial<LineSvgProps> = {
  margin: { top: 50, right: 110, bottom: 50, left: 60 },
  xScale: { type: "point" },
  yScale: { type: "linear", min: "auto", max: "auto", stacked: false, reverse: false },
  axisTop: null,
  axisRight: null,
  axisBottom: defaultAxisBottomConfig,
  axisLeft: defaultAxisLeftConfig,
  useMesh: true,
  enableArea: true,
};

export const TrendChart: FunctionalComponent<TrendChartProps> = ({ data, width = 600, height = 400, rootArialLabel, ...restProps }) => {
  return (
    // Accessible container for the trend diagram
    <div
      role="img"
      aria-label={rootArialLabel}
      tabIndex={0}
      style={{ width, height }}
    >
      <ResponsiveLine data={data} {...defaultTrendChartConfig} {...restProps} />
    </div>
  );
};

import type { FunctionalComponent } from "preact";
import { ResponsiveLine } from "@nivo/line";
import type { LineSvgProps } from "@nivo/line";
import type { CSSProperties } from "preact/compat";

// Define the data structure for each series in the trend diagram
export interface TrendDiagramData {
  id: string;
  data: { x: string | number | Date; y: number }[];
}

export interface TrendDiagramProps extends Partial<LineSvgProps> {
  data: TrendDiagramData[]; // Array of series data for the trend diagram
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

export const defaultTrendDiagramConfig: Partial<LineSvgProps> = {
  margin: { top: 50, right: 110, bottom: 50, left: 60 },
  xScale: { type: "point" },
  yScale: { type: "linear", min: "auto", max: "auto", stacked: false, reverse: false },
  axisTop: null,
  axisRight: null,
  axisBottom: {
    tickSize: 5,
    tickPadding: 5,
    tickRotation: 0,
    legend: "Time",
    legendOffset: 36,
    legendPosition: "middle",
  },
  axisLeft: {
    tickSize: 5,
    tickPadding: 5,
    tickRotation: 0,
    legend: "Number of Tests",
    legendOffset: -40,
    legendPosition: "middle",
  },
  useMesh: true,
  enableArea: true,
};

export const TrendDiagram: FunctionalComponent<TrendDiagramProps> = ({ data, width = 600, height = 400, ...restProps }) => {
  return (
    // Accessible container for the trend diagram
    <div
      role="img"
      aria-label="Trend diagram showing test results over time"
      tabIndex={0}
      style={{ width, height }}
    >
      <ResponsiveLine data={data} {...defaultTrendDiagramConfig} {...restProps} />
    </div>
  );
};

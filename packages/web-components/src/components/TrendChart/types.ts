import type { LineSvgProps } from "@nivo/line";
import type { CSSProperties } from "preact/compat";

export interface TrendChartDataItem {
  x: string | number | Date;
  y: number;
}

export interface TrendChartData {
  id: string;
  data: TrendChartDataItem[];
}

type BaseLineSvgProps = Omit<LineSvgProps, "data" | "useMesh" | "enableSlices">;

export enum TrendChartKind {
  mesh = "mesh",
  slicesX = "slicesX",
  slicesY = "slicesY"
}

export interface TrendChartProps extends Partial<BaseLineSvgProps> {
  data: TrendChartData[];
  rootArialLabel: string;
  kind?: TrendChartKind;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

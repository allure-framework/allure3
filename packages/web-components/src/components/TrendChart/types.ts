import type { LineSvgProps } from "@nivo/line";
import type { CSSProperties } from "preact/compat";
import type { ScaleSymlogSpec } from "@nivo/scales";

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

export type TrendChartKindConfig = Pick<LineSvgProps, "useMesh" | "enableSlices">;

export type SymlogScaleOptions = Pick<ScaleSymlogSpec, "constant" | "reverse">;

export interface TrendChartProps extends Partial<BaseLineSvgProps> {
  data: TrendChartData[];
  rootArialLabel: string;
  kind?: TrendChartKind;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

import type { AxisProps } from "@nivo/axes";
import type { LineSvgProps, LineSeries, Point } from "@nivo/line";
import type { ScaleSymlogSpec } from "@nivo/scales";
import type { CSSProperties } from "preact/compat";

export type Datum = Omit<LineSeries["data"][number], "x" | "y"> & {
  x: string | number | Date;
  y: number;
};

export type Serie = Omit<LineSeries, "id" | "data"> & {
  id: string | number;
  data: readonly Datum[];
};

type BaseLineSvgProps = Omit<LineSvgProps<Serie>, "useMesh" | "enableSlices">;

export enum TrendChartKind {
  Mesh = "Mesh",
  SlicesX = "SlicesX",
  SlicesY = "SlicesY",
}

export type TrendChartKindConfig = Pick<LineSvgProps<Serie>, "useMesh" | "enableSlices">;

export type SymlogScaleOptions = Pick<ScaleSymlogSpec, "constant" | "reverse">;

export interface Slice {
  id: string;
  height: number;
  width: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  points: readonly Point<Serie>[];
}

export type TrendChartSliceClickHandler = (slice: Slice, event: MouseEvent) => void;
export type TrendChartSliceTouchHandler = (slice: Slice, event: TouchEvent) => void;

interface BaseTrendChartProps extends Omit<
  BaseLineSvgProps,
  "onClick" | "onTouchEnd" | "axisBottom" | "width" | "height"
> {
  rootAriaLabel?: string;
  emptyLabel?: string;
  emptyAriaLabel?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  axisBottom?: Omit<AxisProps, "tickValues">;
}

export interface MeshTrendChartProps extends BaseTrendChartProps {
  kind: TrendChartKind.Mesh;
  onClick?: (point: Point<Serie>, event: MouseEvent) => void;
  onTouchEnd?: (point: Point<Serie>, event: TouchEvent) => void;
}

export interface SlicesTrendChartProps extends BaseTrendChartProps {
  kind: TrendChartKind.SlicesX | TrendChartKind.SlicesY;
  onSliceClick?: TrendChartSliceClickHandler;
  onSliceTouchEnd?: TrendChartSliceTouchHandler;
}

export type TrendChartProps = MeshTrendChartProps | SlicesTrendChartProps;

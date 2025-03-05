import type { LineSvgProps, Point, Serie as OriginalSerie, Datum as OriginalDatum } from "@nivo/line";
import type { CSSProperties } from "preact/compat";
import type { ScaleSymlogSpec } from "@nivo/scales";

export type Datum = Omit<OriginalDatum, "x" | "y"> & {
  x: string | number | Date;
  y: number;
};

export type Serie = Omit<OriginalSerie, "id" | "data"> & {
  id: string | number;
  data: readonly Datum[];
};

type BaseLineSvgProps = Omit<LineSvgProps, "useMesh" | "enableSlices">;

export enum TrendChartKind {
  mesh = "mesh",
  slicesX = "slicesX",
  slicesY = "slicesY"
}

export type TrendChartKindConfig = Pick<LineSvgProps, "useMesh" | "enableSlices">;

export type SymlogScaleOptions = Pick<ScaleSymlogSpec, "constant" | "reverse">;

export interface Slice {
  id: string;
  height: number;
  width: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  points: Point[];
}

export type TrendChartSliceClickHandler = (slice: Slice, event: MouseEvent) => void;
export type TrendChartSliceTouchHandler = (slice: Slice, event: TouchEvent) => void;

interface BaseTrendChartProps extends Omit<BaseLineSvgProps, "onClick" | "onTouchEnd"> {
  rootArialLabel: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

export interface MeshTrendChartProps extends BaseTrendChartProps {
  kind: TrendChartKind.mesh;
  onClick?: (point: Point, event: MouseEvent) => void;
  onTouchEnd?: (point: Point, event: TouchEvent) => void;
}

export interface SlicesTrendChartProps extends BaseTrendChartProps {
  kind: TrendChartKind.slicesX | TrendChartKind.slicesY;
  onSliceClick?: TrendChartSliceClickHandler;
  onSliceTouchEnd?: TrendChartSliceTouchHandler;
}

export type TrendChartProps = MeshTrendChartProps | SlicesTrendChartProps;

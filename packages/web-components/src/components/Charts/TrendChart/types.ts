import type { AxisProps } from "@nivo/axes";
import type { LineSvgProps, Datum as OriginalDatum, Serie as OriginalSerie, Point } from "@nivo/line";
import type { ScaleSymlogSpec } from "@nivo/scales";
import type { CSSProperties } from "preact/compat";

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
  Mesh = "Mesh",
  SlicesX = "SlicesX",
  SlicesY = "SlicesY",
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

interface BaseTrendChartProps extends Omit<BaseLineSvgProps, "onClick" | "onTouchEnd" | "axisBottom"> {
  rootAriaLabel?: string;
  emptyLabel?: string;
  emptyAriaLabel?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  axisBottom?: Omit<AxisProps, "tickValues">;
}

export interface MeshTrendChartProps extends BaseTrendChartProps {
  kind: TrendChartKind.Mesh;
  onClick?: (point: Point, event: MouseEvent) => void;
  onTouchEnd?: (point: Point, event: TouchEvent) => void;
}

export interface SlicesTrendChartProps extends BaseTrendChartProps {
  kind: TrendChartKind.SlicesX | TrendChartKind.SlicesY;
  onSliceClick?: TrendChartSliceClickHandler;
  onSliceTouchEnd?: TrendChartSliceTouchHandler;
}

export type TrendChartProps = MeshTrendChartProps | SlicesTrendChartProps;

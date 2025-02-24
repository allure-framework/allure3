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

export interface TrendChartProps extends Partial<LineSvgProps> {
  data: TrendChartData[];
  rootArialLabel: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  useLogarithmicScale?: boolean;
  logarithmBase?: number;
}

import type {
  BarGroup,
  BaseTrendSliceMetadata,
  ChartDataType,
  ChartId,
  ChartMode,
  ChartType,
  PieSlice,
  TrendPointId,
  TrendSlice,
  TrendSliceId,
} from "@allurereport/core-api";

export interface Point {
  x: Date | string | number;
  y: number;
}

export interface TrendChartItem {
  id: string;
  data: Point[];
  color: string;
}

export interface ResponseTrendChartData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  title?: string;
  min: number;
  max: number;
  points: Record<TrendPointId, Point>;
  slices: Record<TrendSliceId, TrendSlice<Metadata>>;
  series: Record<SeriesType, TrendPointId[]>;
}

export interface ResponsePieChartData {
  type: ChartType.Pie;
  title?: string;
  percentage: number;
  slices: PieSlice[];
}

export interface ResponseBarChartData {
  type: ChartType.Bar;
  dataType: ChartDataType;
  mode: ChartMode;
  title?: string;
  data: Record<string, BarGroup | undefined>;
  keys: readonly string[];
  indexBy: string;
}

export interface ResponseComingSoonChartData {
  type: ChartType.HeatMap | ChartType.Funnel | ChartType.TreeMap;
  title?: string;
}

export type ChartsResponse<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = Record<ChartId, ResponseTrendChartData<SeriesType, Metadata> | ResponsePieChartData | ResponseBarChartData | ResponseComingSoonChartData>;

export interface UITrendChartData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  min: number;
  max: number;
  items: TrendChartItem[];
  slices: TrendSlice<Metadata>[];
  title?: string;
}

export type UIPieChartData = ResponsePieChartData;

export interface UIBarChartData extends ResponseBarChartData {
  colors: Record<string, string>;
}

export type UIComingSoonChartData = ResponseComingSoonChartData;

export type ChartData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = ResponseTrendChartData<SeriesType, Metadata> | ResponsePieChartData | ResponseBarChartData | ResponseComingSoonChartData;
export type UIChartData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> =
  | UITrendChartData<Metadata>
  | UIPieChartData
  | UIBarChartData
  | UIComingSoonChartData;

export type ChartsData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = Record<ChartId, ChartData<SeriesType, Metadata>>;
export type UIChartsData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> = Record<
  ChartId,
  UIChartData<Metadata>
>;

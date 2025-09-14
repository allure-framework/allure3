import type {
  BarChartType,
  BarGroup,
  BarGroupMode,
  BaseTrendSliceMetadata,
  ChartDataType,
  ChartId,
  ChartMode,
  ChartType,
  PieSlice,
  TrendPointId,
  TrendSlice,
  TrendSliceId,
  TreeMapChartType,
  TreeMapNode,
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
  dataType: BarChartType;
  mode: ChartMode;
  title?: string;
  data: BarGroup<string, string>[];
  keys: readonly string[];
  indexBy: string;
  groupMode: BarGroupMode;
}

export interface ResponseComingSoonChartData {
  type: ChartType.ComingSoon;
  title?: string;
}

export interface ResponseTreeMapChartData {
  type: ChartType.TreeMap;
  dataType: TreeMapChartType;
  title?: string;
  treeMap: TreeMapNode;
}

export type ChartsResponse<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = Record<
  ChartId,
  | ResponseTrendChartData<SeriesType, Metadata>
  | ResponsePieChartData
  | ResponseBarChartData
  | ResponseComingSoonChartData
  | ResponseTreeMapChartData
>;

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

export interface UITreeMapChartData extends ResponseTreeMapChartData {
  colors: (value: number, domain?: number[]) => string;
  formatLegend?: (value: number) => string;
  legendDomain?: number[];
};

export type ChartData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> =
  | ResponseTrendChartData<SeriesType, Metadata>
  | ResponsePieChartData
  | ResponseBarChartData
  | ResponseComingSoonChartData
  | ResponseTreeMapChartData;
export type UIChartData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> =
  | UITrendChartData<Metadata>
  | UIPieChartData
  | UIBarChartData
  | UIComingSoonChartData
  | UITreeMapChartData;

export type ChartsData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = Record<ChartId, ChartData<SeriesType, Metadata>>;
export type UIChartsData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> = Record<
  ChartId,
  UIChartData<Metadata>
>;

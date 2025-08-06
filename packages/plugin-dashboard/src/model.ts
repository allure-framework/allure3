import type { BaseMetadata, BaseTrendSliceMetadata, ChartDataType, ChartId, ChartMode, ChartType, TestResult, TestStatus, TrendChartData, TrendPoint, TrendPointId, TrendSliceId, TrendSliceMetadata } from "@allurereport/core-api";
import type { TrendMetadataFnOverrides } from "@allurereport/plugin-api";

export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  metadata?: TrendMetadataFnOverrides;
};

export type TrendSlice<Metadata extends BaseMetadata> = {
  // Minimum value on Y-axis of the trend chart slice
  min: number;
  // Maximum value on Y-axis of the trend chart slice
  max: number;
  // Metadata about this test execution
  metadata: TrendSliceMetadata<Metadata>;
};

export type GenericTrendChartData<Metadata extends BaseMetadata, SeriesType extends string> = {
  // Type of the chart
  type: ChartType.Trend;
  // Data type of the chart
  dataType: ChartDataType;
  // Chart mode to know type of values on Y-axis
  mode: ChartMode;
  // Title of the chart
  title?: string;
  // Points for all series
  points: Record<TrendPointId, TrendPoint>;
  // Slices for all series
  slices: Record<TrendSliceId, TrendSlice<Metadata>>;
  // Grouping by series, containing array of point IDs for each status
  series: Record<SeriesType, TrendPointId[]>;
  // Minimum value on Y-axis of the trend chart
  min: number;
  // Maximum value on Y-axis of the trend chart
  max: number;
};

export interface StatusMetadata extends BaseTrendSliceMetadata {}
export type StatusTrendSliceMetadata = TrendSliceMetadata<StatusMetadata>;
export type StatusTrendSlice = TrendSlice<StatusTrendSliceMetadata>;

export type PieChartOptions = {
  type: ChartType.Pie;
  title?: string;
};

export type PieSlice = {
  status: TestStatus;
  count: number;
  d: string | null;
};

export type PieChartData = {
  type: ChartType.Pie;
  title?: string;
  slices: PieSlice[];
  percentage: number;
};

export type GeneratedChartData = TrendChartData | PieChartData;

export type GeneratedChartsData = Record<ChartId, GeneratedChartData>;

export type ChartOptions = TrendChartOptions | PieChartOptions;

export type DashboardOptions = {
  reportName?: string;
  singleFile?: boolean;
  logo?: string;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  layout?: ChartOptions[];
  filter?: (testResult: TestResult) => boolean;
};

export type DashboardPluginOptions = DashboardOptions;

export type TemplateManifest = Record<string, string>;

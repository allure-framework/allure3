import type { SeverityLevel, TestResult, TestStatus } from "@allurereport/core-api";

export enum ChartType {
  Trend = "trend",
  Pie = "pie",
}

export enum ChartData {
  Status = "status",
  Severity = "severity",
}

export type ChartMode = "raw" | "percent";

export type ChartId = string;

export type ExecutionIdFn = (executionOrder: number) => string;
export type ExecutionNameFn = (executionOrder: number) => string;

export type TrendMetadataFnOverrides = {
  executionIdAccessor?: ExecutionIdFn;
  executionNameAccessor?: ExecutionNameFn;
};

export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartData;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  metadata?: TrendMetadataFnOverrides;
};

// Type aliases for meaningful string keys
export type TrendPointId = string;
export type TrendSliceId = string;

// Base type for metadata
export type BaseMetadata = Record<string, unknown>;

export interface BaseTrendSliceMetadata extends Record<string, unknown> {
  executionId: string;
  executionName: string;
}

export type TrendSliceMetadata<Metadata extends BaseMetadata> = BaseTrendSliceMetadata & Metadata;

export type TrendPoint = {
  x: string;
  y: number;
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
  dataType: ChartData;
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
export type StatusTrendChartData = GenericTrendChartData<StatusTrendSliceMetadata, TestStatus>;

export interface SeverityMetadata extends BaseTrendSliceMetadata {}
export type SeverityTrendSliceMetadata = TrendSliceMetadata<SeverityMetadata>;
export type SeverityTrendSlice = TrendSlice<SeverityTrendSliceMetadata>;
export type SeverityTrendChartData = GenericTrendChartData<SeverityTrendSliceMetadata, SeverityLevel>;

export type TrendChartData = StatusTrendChartData | SeverityTrendChartData;

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

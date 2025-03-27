import type { SeverityLevel, TestStatus } from "@allurereport/core-api";

export type ChartType = "status" | "severity";

export type ChartMode = "raw" | "percent";

export type ChartId = `${ChartType}-${ChartMode}`;

export type ChartOptions = {
  type: ChartType;
  mode?: ChartMode;
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

export type TrendChartData<Metadata extends BaseMetadata, SeriesType extends string> = {
  type: ChartType;
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
export type StatusTrendChartData = TrendChartData<StatusTrendSliceMetadata, TestStatus>;

export interface SeverityMetadata extends BaseTrendSliceMetadata {}
export type SeverityTrendSliceMetadata = TrendSliceMetadata<SeverityMetadata>;
export type SeverityTrendSlice = TrendSlice<SeverityTrendSliceMetadata>;
export type SeverityTrendChartData = TrendChartData<SeverityTrendSliceMetadata, SeverityLevel>;

export type GeneratedChartsData = Record<ChartId, StatusTrendChartData | SeverityTrendChartData>;

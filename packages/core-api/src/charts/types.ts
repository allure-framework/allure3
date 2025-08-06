import type { SeverityLevel, TestStatus } from "../model.js";

// Chart types and enums
// FIXME: web, plugins, incorrect duplicate in the web-classic
export enum ChartType {
  Trend = "trend",
  Pie = "pie",
}

// FIXME: Used in web-commons and plugins (check web-commons)
export enum ChartDataType {
  Status = "status",
  Severity = "severity",
}

// FIXME: Used in web-commons, web-components and plugins + plugins-api (check everything)
export enum ChartMode {
  Raw = "raw",
  Percent = "percent",
}

// FIXME: Used in web-commons, web-classic and plugins (check web-commons)
export type ChartId = string;
// FIXME: only plugins
export type TrendPointId = string;
// FIXME: only plugins
export type TrendSliceId = string;

// Base metadata for trend slices
// FIXME: Used in plugins only
export type BaseMetadata = Record<string, unknown>;
// FIXME: Used in web-commons and plugins (check web-commons)
export interface BaseTrendSliceMetadata extends BaseMetadata {
    executionId: string;
    executionName?: string;
};

// Point on a trend chart
// FIXME: Used in plugins only
export interface TrendPoint {
  x: string;
  y: number;
}

// Metadata for a trend slice
// FIXME: Used in web-commons and plugins (check web-commons)
export type TrendSliceMetadata<Metadata extends BaseMetadata> = BaseTrendSliceMetadata & Metadata;

// Slice of a trend chart
// FIXME: Used in web-commons and plugins (check web-commons!!!)
export interface TrendSlice<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
  // Minimum value on Y-axis of the trend chart slice
  min: number;
  // Maximum value on Y-axis of the trend chart slice
  max: number;
  // Metadata about this test execution
  metadata: TrendSliceMetadata<Metadata>;
}


// Generic structure for trend chart data
// FIXME: Used only in plugins-api (check and move it)
export interface GenericTrendChartData<SeriesType extends string, Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
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
}

// Specific trend chart data types
// FIXME: Used in plugins-api (check and move it)
export type StatusTrendChartData = GenericTrendChartData<TestStatus>;
export type SeverityTrendChartData = GenericTrendChartData<SeverityLevel>;


// FIXME: Used in plugins-api & web-classic duplication (check and move it!!!)
export type TrendChartData = StatusTrendChartData | SeverityTrendChartData;

// Pie chart types
// FIXME: Used in web-commons only
export interface BasePieSlice {
  status: TestStatus;
  count: number;
}

// FIXME: Used in plugins & web-commons
export interface PieSlice extends BasePieSlice {
  d: string | null;
}

// FIXME: Used in plugins & web-commons
export interface PieChartData {
  type: ChartType.Pie;
  title?: string;
  slices: PieSlice[];
  percentage: number;
}

// Union types for generated chart data
// FIXME: plugins only (check and move it to plugins-api)
export type GeneratedChartData = TrendChartData | PieChartData;
// FIXME: plugins only (check and move it to plugins-api)
export type GeneratedChartsData = Record<ChartId, GeneratedChartData>;

// Chart options
// FIXME: Used in plugins & plugins-api
export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  // FIXME: might use TrendMetadataFnOverrides instead
  metadata?: Record<string, unknown>;
};

// FIXME: Used in plugins & and web-commons (looks like it must be in plugins-api as TrendChartOptions, but still need investigation)
export type PieChartOptions = {
  type: ChartType.Pie;
  title?: string;
};

export type PieChartValues = {
  percentage: number;
  slices: PieSlice[];
};


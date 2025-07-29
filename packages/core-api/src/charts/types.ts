import type { SeverityLevel, TestStatus } from "../model.js";

// Chart types and enums
export enum ChartType {
  Trend = "trend",
  Pie = "pie",
}

export enum ChartDataType {
  Status = "status",
  Severity = "severity",
}

export enum ChartMode {
  Raw = "raw",
  Percent = "percent",
}

export type ChartId = string;
export type TrendPointId = string;
export type TrendSliceId = string;

// Base metadata for trend slices
export type BaseMetadata = Record<string, unknown>;
export interface BaseTrendSliceMetadata extends BaseMetadata {
    executionId: string;
    executionName?: string;
};

// Point on a trend chart
export interface TrendPoint {
  x: string;
  y: number;
}

// Metadata for a trend slice
export type TrendSliceMetadata<Metadata extends BaseMetadata> = BaseTrendSliceMetadata & Metadata;

// Slice of a trend chart
export interface TrendSlice<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
  min: number;
  max: number;
  metadata: TrendSliceMetadata<Metadata>;
}


// Generic structure for trend chart data
export interface GenericTrendChartData<SeriesType extends string, Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  title?: string;
  points: Record<TrendPointId, TrendPoint>;
  slices: Record<TrendSliceId, TrendSlice<Metadata>>;
  series: Record<SeriesType, TrendPointId[]>;
  min: number;
  max: number;
}

// Specific trend chart data types
export type StatusTrendChartData = GenericTrendChartData<TestStatus>;
export type SeverityTrendChartData = GenericTrendChartData<SeverityLevel>;

export type TrendChartData = StatusTrendChartData | SeverityTrendChartData;

// Pie chart types
export interface PieSlice {
  status: TestStatus;
  count: number;
  d: string | null;
}

export interface PieChartData {
  type: ChartType.Pie;
  title?: string;
  slices: PieSlice[];
  percentage: number;
}

// Union types for generated chart data
export type GeneratedChartData = TrendChartData | PieChartData;
export type GeneratedChartsData = Record<ChartId, GeneratedChartData>;

// Chart options
export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  metadata?: Record<string, unknown>;
};

export type PieChartOptions = {
  type: ChartType.Pie;
  title?: string;
};

export type ChartOptions = TrendChartOptions | PieChartOptions;

import type { TestStatus } from "../model.js";

// Chart types and enums
export enum ChartType {
  Trend = "trend",
  Pie = "pie",
  TreeMap = "treemap",
  HeatMap = "heatmap",
  Bar = "bar",
  Funnel = "funnel",
  ComingSoon = "coming-soon",
}

export enum ChartDataType {
  Status = "status",
  Severity = "severity",
}

// Specifies which Bar chart is being generated
export enum BarChartType {
  StatusBySeverity = "statusBySeverity",
  StatusTrend = "statusTrend",
  StatusChangeTrend = "statusChangeTrend",
}

export enum TreeMapChartType {
  SuccessRateDistribution = "successRateDistribution",
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
}

// Point on a trend chart
export interface TrendPoint {
  x: string;
  y: number;
}

// Metadata for a trend slice
export type TrendSliceMetadata<Metadata extends BaseMetadata> = BaseTrendSliceMetadata & Metadata;

// Slice of a trend chart
export interface TrendSlice<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
  // Minimum value on Y-axis of the trend chart slice
  min: number;
  // Maximum value on Y-axis of the trend chart slice
  max: number;
  // Metadata about this test execution
  metadata: TrendSliceMetadata<Metadata>;
}

// Pie chart types
export interface BasePieSlice {
  status: TestStatus;
  count: number;
}

export interface PieSlice extends BasePieSlice {
  d: string | null;
}

export type PieChartValues = {
  percentage: number;
  slices: PieSlice[];
};

export type BarGroupValues<T extends string = string> = Record<T, number>;
export type BarGroup<G extends string, T extends string = string> = { groupId: G } & BarGroupValues<T>;
export enum BarGroupMode {
  Grouped = "grouped",
  Stacked = "stacked",
}

export type NewKey<T extends string> = `new${Capitalize<T>}`;
export type RemovedKey<T extends string> = `removed${Capitalize<T>}`;

export interface TreeMapNode {
  id: string;
  value?: number;
  children?: TreeMapNode[];
}

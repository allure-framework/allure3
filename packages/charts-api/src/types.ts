import type { HistoryDataPoint, SeverityLevel, Statistic, TestResult, TestStatus } from "@allurereport/core-api";

// Chart types and enums
export enum ChartType {
  Trend = "trend",
  CurrentStatus = "currentStatus",
  StatusDynamics = "statusDynamics",
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
  DurationsByLayer = "durationsByLayer",
  FbsuAgePyramid = "fbsuAgePyramid",
  StabilityRateDistribution = "stabilityRateDistribution",
}

export enum FunnelChartType {
  TestingPyramid = "testingPyramid",
}

export enum TreeMapChartType {
  SuccessRateDistribution = "successRateDistribution",
  CoverageDiff = "coverageDiff",
}

export enum ChartMode {
  Raw = "raw",
  Percent = "percent",
  Diverging = "diverging",
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

export type TreeMapNode<T extends Record<string, any> = {}> = T & {
  id: string;
  value?: number;
  colorValue?: number; // The normalized color value between 0 and 1 for the node
  children?: TreeMapNode<T>[];
};

export type HeatMapPoint = {
  x: string;
  y?: number;
};

export type HeatMapSerie<T extends Record<string, any> = Record<string, any>> = {
  id: string;
  data: HeatMapPoint[];
} & T;

export type ExecutionIdFn = (executionOrder: number) => string;
export type ExecutionNameFn = (executionOrder: number) => string;

export type TrendMetadataFnOverrides = {
  executionIdAccessor?: ExecutionIdFn;
  executionNameAccessor?: ExecutionNameFn;
};

// Common type for trend data operations
export type TrendDataType = TestStatus | SeverityLevel;

export type TrendStats<T extends TrendDataType> = Record<T, number>;

// Type for calculation result
export type TrendCalculationResult<T extends TrendDataType> = {
  points: Record<TrendPointId, TrendPoint>;
  series: Record<T, TrendPointId[]>;
};

// Generic structure for trend chart data
export interface GenericTrendChartData<
  SeriesType extends string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> {
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
export type StatusTrendChartData = GenericTrendChartData<TestStatus>;
export type SeverityTrendChartData = GenericTrendChartData<SeverityLevel>;

// Trend chart data types
export type TrendChartData = StatusTrendChartData | SeverityTrendChartData;

// Bar chart data types
export interface BarChartData {
  type: ChartType.Bar;
  dataType: BarChartType;
  mode: ChartMode;
  title?: string;
  data: BarGroup<string, string>[];
  keys: readonly string[];
  indexBy: string;
  groupMode: BarGroupMode;
  xAxisConfig?: {
    legend?: string;
    enabled?: boolean;
    format?: string;
    domain?: number[];
    tickValues?: number | number[];
  };
  yAxisConfig?: {
    legend?: string;
    enabled?: boolean;
    format?: string;
    tickValues?: number | number[];
    domain?: number[];
  };
  layout?: "horizontal" | "vertical";
  // Threshold value for the stability rate distribution chart
  threshold?: number;
}

// Tree map chart data types
export interface TreeMapChartData {
  type: ChartType.TreeMap;
  dataType: TreeMapChartType;
  title?: string;
  treeMap: TreeMapNode;
}

export interface HeatMapChartData<T extends Record<string, any> = {}> {
  type: ChartType.HeatMap;
  title?: string;
  data: HeatMapSerie<T>[];
}

// Coming soon chart data types
export interface ComingSoonChartData {
  type: ChartType.ComingSoon;
  title?: string;
}

// Funnel chart data types
export interface FunnelChartData {
  type: ChartType.Funnel;
  dataType: FunnelChartType;
  title?: string;
  data: Record<string, number | string>[];
}

export interface CurrentStatusChartData {
  type: ChartType.CurrentStatus;
  title?: string;
  data: Statistic;
}

export interface StatusDynamicsChartData {
  type: ChartType.StatusDynamics;
  title?: string;
  data: {
    statistic: Statistic;
    id: string;
    timestamp: number;
    name: string;
  }[];
  limit?: number;
  statuses?: TestStatus[];
}

// Union types for generated chart data
export type GeneratedChartData =
  | TrendChartData
  | BarChartData
  | CurrentStatusChartData
  | StatusDynamicsChartData
  | ComingSoonChartData
  | TreeMapChartData
  | HeatMapChartData
  | FunnelChartData;

export type GeneratedChartsData = Record<ChartId, GeneratedChartData>;

// Chart options
export type TrendChartOptions = {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  metadata?: TrendMetadataFnOverrides;
};

export type CurrentStatusChartOptions = {
  type: ChartType.CurrentStatus;
  /**
   * Title of the chart
   *
   * @default "Current Status"
   */
  title?: string;
  /**
   * List of test statuses that will be
   * used to create the chart.
   *
   * @default ["passed", "failed", "broken", "skipped", "unknown"]
   */
  statuses?: TestStatus[];
  /**
   * Status that will be used to calculate
   * the percentage against total number of tests
   * in the center of the chart.
   *
   * @default "passed"
   */
  metric?: TestStatus;
};

export type StatusDynamicsChartOptions = {
  type: ChartType.StatusDynamics;
  title?: string;
  /**
   * Limit of history data points
   *
   * @default 10
   */
  limit?: number;
  /**
   * List of test statuses that will be
   * used to create the chart.
   *
   * @default ["passed", "failed", "broken", "skipped", "unknown"]
   */
  statuses?: TestStatus[];
};

export type BarChartOptions = {
  type: ChartType.Bar;
  dataType: BarChartType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
  threshold?: number;
};

export type TreeMapChartOptions = {
  type: ChartType.TreeMap;
  dataType: TreeMapChartType;
  title?: string;
};

export type HeatMapChartOptions = {
  type: ChartType.HeatMap;
  title?: string;
};

export type ComingSoonChartOptions = {
  type: ChartType.ComingSoon;
  title?: string;
};

export type FunnelChartOptions = {
  type: ChartType.Funnel;
  dataType: FunnelChartType;
  title?: string;
  layers?: string[];
};

export type ChartOptions =
  | TrendChartOptions
  | CurrentStatusChartOptions
  | StatusDynamicsChartOptions
  | BarChartOptions
  | ComingSoonChartOptions
  | TreeMapChartOptions
  | HeatMapChartOptions
  | FunnelChartOptions;

export interface AllureChartsStoreData {
  historyDataPoints: HistoryDataPoint[];
  testResults: TestResult[];
  statistic: Statistic;
}

export interface TrendDataAccessor<T extends TrendDataType> {
  // Get current data for the specified type
  getCurrentData: (storeData: AllureChartsStoreData) => TrendStats<T>;
  // Get data from historical point
  getHistoricalData: (historyPoint: HistoryDataPoint) => TrendStats<T>;
  // List of all possible values for the type
  getAllValues: () => readonly T[];
}

export interface BarDataAccessor<G extends string, T extends string> {
  // Get all needed data for the chart
  getItems: (
    storeData: AllureChartsStoreData,
    limitedHistoryDataPoints: HistoryDataPoint[],
    isFullHistory: boolean,
  ) => BarGroup<G, T>[];
  // List of all possible values for the group
  getGroupKeys: () => readonly T[];
  // Get group mode
  getGroupMode: () => BarGroupMode;
}

export interface TreeMapDataAccessor<T extends TreeMapNode> {
  getTreeMap: (storeData: AllureChartsStoreData) => T;
}

export interface HeatMapDataAccessor<T extends Record<string, unknown> = {}> {
  getHeatMap: (storeData: AllureChartsStoreData) => HeatMapSerie<T>[];
}

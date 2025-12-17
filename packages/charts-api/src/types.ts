import type { HistoryDataPoint, SeverityLevel, Statistic, TestResult, TestStatus } from "@allurereport/core-api";

// Chart types and enums
export enum ChartType {
  Trend = "trend",
  CurrentStatus = "currentStatus",
  StatusDynamics = "statusDynamics",
  StatusTransitions = "statusTransitions",
  StabilityDistribution = "stabilityDistribution",
  TestBaseGrowthDynamics = "testBaseGrowthDynamics",
  FBSUAgePyramid = "fbsuAgePyramid",
  Durations = "durations",
  TrSeverities = "testResultSeverities",
  TreeMap = "treemap",
  HeatMap = "heatmap",
  Funnel = "funnel",
}

export enum ChartDataType {
  Status = "status",
  Severity = "severity",
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

export interface StatusTransitionsChartData {
  type: ChartType.StatusTransitions;
  title?: string;
  data: {
    id: string | "current";
    timestamp: number;
    prevItemTimestamp: number;
    fixed: number;
    regressed: number;
    malfunctioned: number;
  }[];
  hideEmptyLines?: boolean;
  lines?: ("fixed" | "regressed" | "malfunctioned")[];
  linesSharpness?: number;
}

export interface DurationsChartData {
  type: ChartType.Durations;
  title?: string;
  /**
   * Buckets of test results by duration
   */
  data: {
    /**
     * Start of the duration bucket
     */
    from: number;
    /**
     * End of the duration bucket
     */
    to: number;
    /**
     * Number of test results in the bucket
     * by key from the `keys` map
     */
    [key: string]: number;
  }[];
  /**
   * Map of key IDs to key names
   */
  keys: { [id: string]: string };
  groupBy: "layer" | "none";
}

export interface StabilityDistributionChartData {
  type: ChartType.StabilityDistribution;
  title?: string;
  /**
   * Buckets of test results by duration
   */
  data: {
    /**
     * as key ID from the `keys` map
     */
    id: string;
    /**
     * Stability rate
     *
     * as percentage like 0.90
     */
    stabilityRate: number;
  }[];
  /**
   * Map of key IDs to key names
   */
  keys: { [id: string]: string };
  /**
   * Threshold for the stability rate
   *
   * if the stability rate is less than the threshold,
   * the feature will be marked as unstable
   *
   * @default 90
   */
  threshold?: number;
}

export interface TestBaseGrowthDynamicsChartData {
  type: ChartType.TestBaseGrowthDynamics;
  title?: string;
  data: ({
    [key in `new:${TestStatus}` | `removed:${TestStatus}`]: number;
  } & {
    id: string;
    timestamp: number;
  })[];
  statuses: TestStatus[];
}

export interface FBSUAgePyramidChartData {
  type: ChartType.FBSUAgePyramid;
  title?: string;
  data: {
    id: string;
    timestamp: number;
    failed: number;
    broken: number;
    skipped: number;
    unknown: number;
  }[];
  statuses: Exclude<TestStatus, "passed">[];
}

export type TrSeveritiesChartData = {
  type: ChartType.TrSeverities;
  title?: string;
  data: ({
    id: SeverityLevel | "unset";
  } & Record<TestStatus, number>)[];
  levels: (SeverityLevel | "unset")[];
  statuses: TestStatus[];
};

// Union types for generated chart data
export type GeneratedChartData =
  | TrendChartData
  | CurrentStatusChartData
  | StatusDynamicsChartData
  | StatusTransitionsChartData
  | DurationsChartData
  | StabilityDistributionChartData
  | TestBaseGrowthDynamicsChartData
  | FBSUAgePyramidChartData
  | TreeMapChartData
  | HeatMapChartData
  | FunnelChartData
  | TrSeveritiesChartData;

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

export type StatusTransitionsChartOptions = {
  type: ChartType.StatusTransitions;
  title?: string;
  /**
   * List of lines that will be displayed in the chart.
   * Corresponds to test result transitions.
   *
   * @default ["regressed", "malfunctioned"]
   */
  lines?: ("fixed" | "regressed" | "malfunctioned")[];
  /**
   * Sharpness controls where the curve bends between points
   * - 0 = sharp transition (curve changes immediately after leaving previous point)
   * - 0.5 = symmetric curve
   * - 1 = gradual transition (curve holds previous value longer)
   *
   * @default 0.2
   */
  linesSharpness?: number;
  /**
   * Whether to hide lines that have no data in every point of the chart
   * (theses lines always goes through 0 mark)
   *
   * @default true
   */
  hideEmptyLines?: boolean;
  /**
   * Limit of history data points to be used for the chart
   *
   * @default 10
   */
  limit?: number;
};

export type DurationsChartOptions = {
  type: ChartType.Durations;
  title?: string;
  /**
   * By what to group the test results
   * - "layer" - group by layer
   * - "none" - do not group
   *
   * @default "none"
   */
  groupBy?: "layer" | "none";
};

export type StabilityDistributionChartOptions = {
  type: ChartType.StabilityDistribution;
  title?: string;
  /**
   * Threshold for the stability rate
   *
   * if the stability rate is less than the threshold,
   * the feature will be marked as unstable
   *
   * @default 90
   */
  threshold?: number;
  /**
   * List of test statuses that will be skipped
   *
   * @default ["unknown", "skipped"]
   */
  skipStatuses?: TestStatus[];
  /**
   * By what to group the test results on chart
   *
   * - "feature" - group by feature
   * - "epic" - group by epic
   * - "story" - group by story
   * - "suite" - group by suite
   * - "severity" - group by severity
   * - "owner" - group by owner
   * - "label-name:foo" - group by label name "foo"
   * - "label-name:bar" - group by label name "bar"
   *
   * @default "feature"
   */
  groupBy?: "feature" | "epic" | "story" | "suite" | "severity" | "owner" | `label-name:${string}`;
  /**
   * List of values to group by
   * Allows to narrow down the list of values to group by
   * if not provided, all values will be used for grouping
   *
   * @default []
   */
  groupValues?: string[];
};

export type TestBaseGrowthDynamicsChartOptions = {
  type: ChartType.TestBaseGrowthDynamics;
  title?: string;
  /**
   * List of test statuses that will be used to create the chart.
   *
   * @default ["passed", "failed", "broken", "skipped", "unknown"]
   */
  statuses?: TestStatus[];
  /**
   * Limit of history data points to be used for the chart
   *
   * @default 10
   */
  limit?: number;
};

export type FBSUAgePyramidChartOptions = {
  type: ChartType.FBSUAgePyramid;
  title?: string;
  /**
   * Limit of history data points to be used for the chart
   *
   * @default 10
   */
  limit?: number;
};

export type TrSeveritiesChartOptions = {
  type: ChartType.TrSeverities;
  title?: string;
  /**
   * List of severity levels that will be used to create the chart.
   *
   * @default ["blocker", "critical", "normal", "minor", "trivial"]
   */
  levels?: SeverityLevel[];
  /**
   * List of test statuses that will be used to create the chart.
   *
   * @default ["passed", "failed", "broken", "skipped", "unknown"]
   */
  statuses?: TestStatus[];
  /**
   * Whether to include the "unset" severity level from the chart
   *
   * @default true
   */
  includeUnset?: boolean;
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
  | DurationsChartOptions
  | TreeMapChartOptions
  | HeatMapChartOptions
  | FunnelChartOptions
  | StatusTransitionsChartOptions
  | StabilityDistributionChartOptions
  | FBSUAgePyramidChartOptions
  | TestBaseGrowthDynamicsChartOptions
  | TrSeveritiesChartOptions;

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

export interface TreeMapDataAccessor<T extends TreeMapNode> {
  getTreeMap: (storeData: AllureChartsStoreData) => T;
}

export interface HeatMapDataAccessor<T extends Record<string, unknown> = {}> {
  getHeatMap: (storeData: AllureChartsStoreData) => HeatMapSerie<T>[];
}

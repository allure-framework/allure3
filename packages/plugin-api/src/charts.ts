import type {
  BarChartType,
  BarGroup,
  BarGroupMode,
  BaseTrendSliceMetadata,
  ChartDataType,
  ChartId,
  ChartMode,
  ChartType,
  HeatMapSerie,
  HistoryDataPoint,
  HistoryTestResult,
  PieSlice,
  SeverityLevel,
  Statistic,
  TestResult,
  TestStatus,
  TreeMapChartType,
  TreeMapNode,
  TrendPoint,
  TrendPointId,
  TrendSlice,
  TrendSliceId,
} from "@allurereport/core-api";

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

// Pie chart data types
export interface PieChartData {
  type: ChartType.Pie;
  title?: string;
  slices: PieSlice[];
  percentage: number;
}

// Coming soon chart data types
export interface ComingSoonChartData {
  type: ChartType.ComingSoon;
  title?: string;
}

// Union types for generated chart data
export type GeneratedChartData =
  | TrendChartData
  | PieChartData
  | BarChartData
  | ComingSoonChartData
  | TreeMapChartData
  | HeatMapChartData;
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

export type PieChartOptions = {
  type: ChartType.Pie;
  title?: string;
};

export type BarChartOptions = {
  type: ChartType.Bar;
  dataType: BarChartType;
  mode?: ChartMode;
  title?: string;
  limit?: number;
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

export type ChartOptions =
  | TrendChartOptions
  | PieChartOptions
  | BarChartOptions
  | ComingSoonChartOptions
  | TreeMapChartOptions
  | HeatMapChartOptions;

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

export const DEFAULT_CHART_HISTORY_LIMIT = 10;

/**
 * @description Limits the history data points by a certain limit, that is necessary for charts data with a long history.
 * @param historyDataPoints - The history data points.
 * @param limit - The limit.
 * @returns The limited history data points.
 */
export const limitHistoryDataPoints = (historyDataPoints: HistoryDataPoint[], limit: number): HistoryDataPoint[] => {
  if (limit <= 0 || historyDataPoints.length === 0) {
    return [];
  }

  const clampedLimit = Math.max(0, Math.floor(limit));

  return historyDataPoints.slice(0, clampedLimit);
};

/**
 * Initializes series record with items as keys and empty arrays.
 * @param items - Items for series record.
 * @returns Record with items as keys and empty arrays.
 */
export const createEmptySeries = <T extends string>(items: readonly T[]): Record<T, string[]> =>
  items.reduce((acc, item) => ({ ...acc, [item]: [] }), {} as Record<T, string[]>);

/**
 * Initializes stats record with items as keys and 0 as values.
 * @param items - Items for stats record.
 * @returns Record with items as keys and 0 values.
 */
export const createEmptyStats = <T extends string>(items: readonly T[]): Record<T, number> =>
  items.reduce((acc, item) => ({ ...acc, [item]: 0 }), {} as Record<T, number>);

/**
 * Normalizes stats record, ensuring all items are represented.
 * @param statistic - Partial stats record.
 * @param itemType - All possible items.
 * @returns Complete stats record with all items.
 */
export const normalizeStatistic = <T extends string>(
  statistic: Partial<Record<T, number>>,
  itemType: readonly T[],
): Record<T, number> => {
  return itemType.reduce(
    (acc, item) => {
      acc[item] = statistic[item] ?? 0;
      return acc;
    },
    {} as Record<T, number>,
  );
};

/**
 * Check if test has any of the specified labels
 * Generic function that works with any label hierarchy
 */
export const hasLabels = <T extends string, TR extends TestResult | HistoryTestResult>(
  test: TR,
  labelHierarchy: T[],
): boolean =>
  test.labels?.some((label) => {
    const { name } = label;
    return name && labelHierarchy.includes(name as T);
  }) ?? false;

export const isChildrenLeavesOnly = <T extends TreeMapNode>(node: T): boolean => {
  return node.children ? node.children.every((child) => child.children === undefined) : false;
};

export const defaultChartsConfig = [
  {
    type: "pie",
    title: "Current status",
  },
  {
    type: "trend",
    dataType: "status",
    title: "Status dynamics",
  },
  {
    type: "bar",
    dataType: "statusBySeverity",
    title: "Test result severities",
  },
  {
    type: "bar",
    dataType: "statusTrend",
    title: "Status change dynamics",
  },
  {
    type: "bar",
    dataType: "statusChangeTrend",
    title: "Test base growth dynamics",
  },
  {
    type: "treemap",
    dataType: "coverageDiff",
    title: "Coverage diff map",
  },
  {
    type: "treemap",
    dataType: "successRateDistribution",
    title: "Success rate disctribution",
  },
  {
    type: "heatmap",
    title: "Problems distribution by environment",
  },
  {
    type: "bar",
    title: "Stability rate disctribution",
  },
  {
    type: "bar",
    title: "Duration by layer histogram",
  },
  {
    type: "bar",
    title: "Performance dynamics",
  },
  {
    type: "bar",
    title: "FBSU age pyramid",
  },
  {
    type: "funnel",
    title: "Testing pyramid",
  },
];

import type { HistoryDataPoint, Statistic, SeverityLevel, TestStatus, TestResult } from "@allurereport/core-api";
import { statusesList, severityLevels } from "@allurereport/core-api";
import type { PieArcDatum } from "d3-shape";
import { arc, pie } from "d3-shape";

export type TestResultSlice = {
  status: TestStatus;
  count: number;
};

export type TestResultChartData = {
  percentage: number;
  slices: TestResultSlice[];
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

export const d3Arc = arc<PieArcDatum<TestResultSlice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

export const d3Pie = pie<TestResultSlice>()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export const getPieChartData = (stats: Statistic): TestResultChartData => {
  const convertedStatuses = statusesList
    .filter((status) => !!stats?.[status])
    .map((status) => ({
      status,
      count: stats[status]!,
    }));
  const arcsData = d3Pie(convertedStatuses);
  const slices = arcsData.map((arcData) => ({
    d: d3Arc(arcData),
    ...arcData.data,
  }));
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    slices,
    percentage,
  };
};

// Common type for trend data operations
type TrendDataType = TestStatus | SeverityLevel;

// Constants for type safety
const STATUS_LIST = statusesList as readonly TestStatus[];
const SEVERITY_LIST = severityLevels as readonly SeverityLevel[];

// Helper for creating empty stats records
const createEmptyStats = <T extends TrendDataType>(items: readonly T[]): Record<T, number> =>
  items.reduce((acc, item) => ({ ...acc, [item]: 0 }), {} as Record<T, number>);

// Helper for creating empty series records
const createEmptySeries = <T extends TrendDataType>(items: readonly T[]): Record<T, string[]> =>
  items.reduce((acc, item) => ({ ...acc, [item]: [] }), {} as Record<T, string[]>);

// Helper for converting Statistic to Record<TestStatus, number>
const normalizeStatistic = (statistic: Statistic): Record<TestStatus, number> => {
  return STATUS_LIST.reduce((acc, status) => {
    acc[status] = statistic[status] ?? 0;

    return acc;
  }, {} as Record<TestStatus, number>);
};

// Helper for merging trend data
const mergeTrendDataGeneric = <M extends BaseTrendSliceMetadata, T extends TrendDataType>(
  trendData: TrendChartData<M, T>,
  trendDataPart: TrendChartData<M, T>,
  itemType: readonly T[]
): TrendChartData<M, T> => {
  return {
    points: {
      ...trendData.points,
      ...trendDataPart.points
    },
    slices: {
      ...trendData.slices,
      ...trendDataPart.slices
    },
    series: Object.entries(trendDataPart.series).reduce((series, [group, pointIds]) => {
      if (Array.isArray(pointIds)) {
        return {
          ...series,
          [group]: [...(trendData.series?.[group as T] || []), ...pointIds]
        };
      }

      return series;
    }, trendData.series || createEmptySeries(itemType)),
    min: Math.min(trendData.min ?? Infinity, trendDataPart.min),
    max: Math.max(trendData.max ?? -Infinity, trendDataPart.max)
  };
};

// Helper for getting trend data
const getTrendDataGeneric = <M extends BaseTrendSliceMetadata, T extends TrendDataType>(
  stats: Record<T, number>,
  reportName: string,
  executionOrder: number,
  itemType: readonly T[]
): TrendChartData<M, T> => {
  const points: Record<TrendPointId, TrendPoint> = {};
  const slices: Record<TrendSliceId, TrendSlice<M>> = {};
  const series = createEmptySeries(itemType);
  const executionId = `execution-${executionOrder}`;

  // Create points and populate series
  itemType.forEach(item => {
    const pointId = `${executionId}-${item}`;

    if (stats[item]) {
      points[pointId] = {
        x: executionId,
        y: stats[item] ?? 0,
      };

      series[item].push(pointId);
    }
  });

  // Create slice
  const values = Object.values(points).map(point => point.y);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  slices[executionId] = {
    min,
    max,
    metadata: {
      executionId,
      executionName: reportName,
    } as M
  };

  return {
    points,
    slices,
    series,
    min,
    max,
  };
};

export interface StatisticWithTestResults extends Statistic {
  testResults?: TestResult[];
}

export const getStatusTrendData = (
  currentStatistic: Statistic,
  reportName: string,
  historyPoints: HistoryDataPoint[]
): StatusTrendChartData => {
  // Convert history points to statistics
  const convertedHistoryPoints = historyPoints.map(point => ({
    name: point.name,
    statistic: Object.values(point.testResults).reduce((stat: Statistic, test) => {
      if (test.status) {
        stat[test.status] = (stat[test.status] ?? 0) + 1;
        stat.total = (stat.total ?? 0) + 1;
      }

      return stat;
    }, { total: 0 } as Statistic)
  }));

  // Get current report data
  const currentTrendData = getTrendDataGeneric<StatusMetadata, TestStatus>(
    normalizeStatistic(currentStatistic),
    reportName,
    convertedHistoryPoints.length + 1,
    STATUS_LIST
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduceRight((acc, historyPoint, index) => {
    const trendDataPart = getTrendDataGeneric<StatusMetadata, TestStatus>(
      normalizeStatistic(historyPoint.statistic),
      historyPoint.name,
      convertedHistoryPoints.length - index,
      STATUS_LIST
    );

    return mergeTrendDataGeneric(acc, trendDataPart, STATUS_LIST);
  }, {
    points: {},
    slices: {},
    series: createEmptySeries(STATUS_LIST),
    min: Infinity,
    max: -Infinity
  } as StatusTrendChartData);

  // Add current report data as the last item
  return mergeTrendDataGeneric(historicalTrendData, currentTrendData, STATUS_LIST);
};

export const getSeverityTrendData = (
  testResults: TestResult[],
  reportName: string,
  historyPoints: HistoryDataPoint[],
): SeverityTrendChartData => {
  // Convert history points to statistics by severity
  const convertedHistoryPoints = historyPoints.map(point => ({
    name: point.name,
    statistic: Object.values(point.testResults).reduce((stat, test) => {
      const severityLabel = test.labels?.find(label => label.name === "severity");
      const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

      if (severity) {
        stat[severity] = (stat[severity] ?? 0) + 1;
      }

      return stat;
    }, createEmptyStats(SEVERITY_LIST))
  }));

  // Get current severity statistics
  const currentSeverityStats = testResults.reduce((acc, test) => {
    const severityLabel = test.labels.find(label => label.name === "severity");
    const severity = severityLabel?.value?.toLowerCase() as SeverityLevel;

    if (severity) {
      acc[severity] = (acc[severity] ?? 0) + 1;
    }

    return acc;
  }, createEmptyStats(SEVERITY_LIST));

  // Get current report data
  const currentTrendData = getTrendDataGeneric<SeverityMetadata, SeverityLevel>(
    currentSeverityStats,
    reportName,
    convertedHistoryPoints.length + 1,
    SEVERITY_LIST
  );

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduceRight((acc, historyPoint, index) => {
    const trendDataPart = getTrendDataGeneric<SeverityMetadata, SeverityLevel>(
      historyPoint.statistic,
      historyPoint.name,
      convertedHistoryPoints.length - index,
      SEVERITY_LIST
    );

    return mergeTrendDataGeneric(acc, trendDataPart, SEVERITY_LIST);
  }, {
    points: {},
    slices: {},
    series: createEmptySeries(SEVERITY_LIST),
    min: Infinity,
    max: -Infinity,
  } as SeverityTrendChartData);

  return mergeTrendDataGeneric(historicalTrendData, currentTrendData, SEVERITY_LIST);
};

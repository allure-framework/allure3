import type { HistoryDataPoint, Statistic, SeverityLevel, TestStatus } from "@allurereport/core-api";
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

export type BaseTrendSliceMetadata = {
  // Unique identifier for this test execution instance (e.g. "build-2023-05-12-001")
  executionId: string;
  // Human readable name for this test execution (e.g. "Nightly Build #123" or "Sprint 45 Regression")
  executionName: string;
};

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

export type StatusMetadata = {};
export type StatusTrendSliceMetadata = TrendSliceMetadata<StatusMetadata>;
export type StatusTrendSlice = TrendSlice<StatusTrendSliceMetadata>;
export type StatusTrendChartData = TrendChartData<StatusTrendSliceMetadata, TestStatus>;

export type SeverityStatisticMetadata = {
  severity: string;
  count: number;
  percentage: number;
};

export type SeverityStatisticData = {
  total: number;
  items: SeverityStatisticMetadata[];
};

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

const mergeTrendData = (trendData: StatusTrendChartData, trendDataPart: StatusTrendChartData): StatusTrendChartData => {
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
          [group]: [...(trendData.series?.[group as TestStatus] || []), ...pointIds]
        };
      }

      return series;
    }, trendData.series || {} as Record<TestStatus, string[]>),
    min: Math.min(trendData.min ?? Infinity, trendDataPart.min),
    max: Math.max(trendData.max ?? -Infinity, trendDataPart.max)
  };
};

export const getTrendData = (statistic: Statistic, reportName: string, executionOrder: number): StatusTrendChartData => {
  const points: Record<TrendPointId, TrendPoint> = {};
  const slices: Record<TrendSliceId, StatusTrendSlice> = {};
  const series: Record<TestStatus, TrendPointId[]> = statusesList.reduce((acc, status) => ({
    ...acc,
    [status]: [],
  }), {} as Record<TestStatus, TrendPointId[]>);

  const executionId = `execution-${executionOrder}`;

  // Create points and populate series
  statusesList.forEach(status => {
    const pointId = `${executionId}-${status}`; // Some unique identifier across all points

    if (statistic[status]) {
      points[pointId] = {
        x: executionId,
        y: statistic[status] ?? 0,
      };

      series[status].push(pointId);
    }
  });

  // Create slice
  // Calculate min and max values from points
  const values = Object.values(points).map(point => point.y);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  slices[executionId] = {
    min,
    max,
    metadata: {
      executionId,
      executionName: reportName,
    }
  };

  return {
    points,
    slices,
    series,
    min,
    max,
  };
};

/**
 * Generate status trend data from current statistic and history points
 *
 * @param currentStatistic - Current test run statistics
 * @param reportName - Name of the current report
 * @param historyPoints - Array of history data points
 * @returns StatusTrendChartData object with merged current and historical data
 */
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
  const currentTrendData = getTrendData(currentStatistic, reportName, convertedHistoryPoints.length + 1);

  // Process historical data
  const historicalTrendData = convertedHistoryPoints.reduceRight((acc, historyPoint, index) => {
    const trendDataPart = getTrendData(historyPoint.statistic, historyPoint.name, convertedHistoryPoints.length - index);
    return mergeTrendData(acc, trendDataPart);
  }, {
    points: {},
    slices: {},
    series: {},
    min: Infinity,
    max: -Infinity
  } as StatusTrendChartData);

  // Add current report data as the last item
  return mergeTrendData(historicalTrendData, currentTrendData);
};

/**
 * Generate severity statistics data from test results
 *
 * @param tests - Array of test results containing severity information
 * @returns SeverityStatisticData object with statistics by severity level
 */
export const getSeverityStatisticData = (tests: { severity?: SeverityLevel }[]): SeverityStatisticData => {
  const severityCounts = tests.reduce((acc, test) => {
    const severity = test.severity || "normal";

    acc[severity] = (acc[severity] || 0) + 1;

    return acc;
  }, {} as Record<SeverityLevel, number>);

  const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);

  const items: SeverityStatisticMetadata[] = severityLevels
    .reduce((acc, severity) => {
      const count = severityCounts[severity] ?? 0;

      if (count > 0) {
        acc.push({
          severity,
          count,
          percentage: getPercentage(count, total),
        });
      }

      return acc;
    }, [] as SeverityStatisticMetadata[]);

  return {
    total,
    items
  };
};

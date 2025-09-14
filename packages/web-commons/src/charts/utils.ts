import type { ChartId, SeverityLevel, TestStatus } from "@allurereport/core-api";
import { BarChartType, ChartDataType, ChartType, severityLevels, statusesList } from "@allurereport/core-api";
import { severityColors, statusChangeColors, statusColors } from "./colors.js";
import type {
  ChartsData,
  ChartsResponse,
  ResponseBarChartData,
  ResponseTrendChartData,
  TrendChartItem,
  UIBarChartData,
  UIChartData,
  UITrendChartData,
} from "./types.js";

export const createTrendChartDataGeneric = <T extends TestStatus | SeverityLevel>(
  getChart: () => ResponseTrendChartData | undefined,
  getGroups: () => readonly T[],
  getColor: (group: T) => string,
): UITrendChartData | undefined => {
  const chart = getChart();
  if (!chart) {
    return undefined;
  }

  const items = getGroups().reduce((acc, group) => {
    const pointsByGroupBy =
      chart.series[group]?.map((pointId) => {
        const point = chart.points[pointId];
        return {
          x: point.x,
          y: point.y,
        };
      }) ?? [];

    if (pointsByGroupBy.length) {
      acc.push({
        id: group.charAt(0).toUpperCase() + group.slice(1),
        data: pointsByGroupBy,
        color: getColor(group),
      });
    }

    return acc;
  }, [] as TrendChartItem[]);

  return {
    type: chart.type,
    dataType: chart.dataType,
    mode: chart.mode,
    title: chart.title,
    items,
    slices: Object.values(chart.slices),
    min: chart.min,
    max: chart.max,
  } as UITrendChartData;
};

export const createBarChartDataGeneric = <T extends string>(
  getChart: () => ResponseBarChartData | undefined,
  getColors: () => Record<T, string>,
): UIBarChartData | undefined => {
  const chart = getChart();
  if (!chart) {
    return undefined;
  }

  return {
    ...chart,
    colors: getColors(),
  };
};

export const createStatusTrendChartData = (chartId: ChartId, res: ChartsResponse): UITrendChartData | undefined =>
  createTrendChartDataGeneric(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => statusesList,
    (status) => statusColors[status],
  );

export const createSeverityTrendChartData = (chartId: ChartId, res: ChartsResponse): UITrendChartData | undefined =>
  createTrendChartDataGeneric(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => severityLevels,
    (severity) => severityColors[severity],
  );

export const createStatusBySeverityBarChartData = (chartId: ChartId, res: ChartsResponse): UIBarChartData | undefined =>
  createBarChartDataGeneric(
    () => res[chartId] as ResponseBarChartData | undefined,
    () => statusColors,
  );

export const createStatusTrendBarChartData = (chartId: ChartId, res: ChartsResponse): UIBarChartData | undefined =>
  createBarChartDataGeneric(
    () => res[chartId] as ResponseBarChartData | undefined,
    () => statusColors,
  );

export const createStatusChangeTrendBarChartData = (
  chartId: ChartId,
  res: ChartsResponse,
): UIBarChartData | undefined =>
  createBarChartDataGeneric(
    () => res[chartId] as ResponseBarChartData | undefined,
    () => statusChangeColors,
  );

export const createaTrendChartData = (
  chartId: string,
  chartData: ResponseTrendChartData,
  res: ChartsData,
): UITrendChartData | undefined => {
  if (chartData.dataType === ChartDataType.Status) {
    return createStatusTrendChartData(chartId, res);
  } else if (chartData.dataType === ChartDataType.Severity) {
    return createSeverityTrendChartData(chartId, res);
  }
};

export const createBarChartData = (
  chartId: string,
  chartData: ResponseBarChartData,
  res: ChartsData,
): UIBarChartData | undefined => {
  if (chartData.dataType === BarChartType.StatusBySeverity) {
    return createStatusBySeverityBarChartData(chartId, res);
  } else if (chartData.dataType === BarChartType.StatusTrend) {
    return createStatusTrendBarChartData(chartId, res);
  } else if (chartData.dataType === BarChartType.StatusChangeTrend) {
    return createStatusChangeTrendBarChartData(chartId, res);
  }
};

export const createCharts = (res: ChartsData): Record<ChartId, UIChartData> => {
  return Object.entries(res).reduce(
    (acc, [chartId, chart]) => {
      if (chart.type === ChartType.Trend) {
        const chartData = createaTrendChartData(chartId, chart, res);
        if (chartData) {
          acc[chartId] = chartData;
        }
      } else if (chart.type === ChartType.Bar) {
        const chartData = createBarChartData(chartId, chart, res);
        if (chartData) {
          acc[chartId] = chartData;
        }
      } else if ([ChartType.Pie, ChartType.ComingSoon].includes(chart.type)) {
        acc[chartId] = chart;
      }

      return acc;
    },
    {} as Record<ChartId, UIChartData>,
  );
};

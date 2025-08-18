import type { ChartId, SeverityLevel, TestStatus } from "@allurereport/core-api";
import { ChartDataType, ChartType, severityLevels, statusesList } from "@allurereport/core-api";
import { severityColors, statusColors } from "./colors.js";
import type {
  ChartsData,
  ChartsResponse,
  ResponseTrendChartData,
  TrendChartItem,
  UIChartData,
  UITrendChartData,
} from "./types.js";

export const createTrendChartData = <T extends TestStatus | SeverityLevel>(
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

export const createStatusTrendChartData = (chartId: ChartId, res: ChartsResponse): UITrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => statusesList,
    (status) => statusColors[status],
  );

export const createSeverityTrendChartData = (chartId: ChartId, res: ChartsResponse): UITrendChartData | undefined =>
  createTrendChartData(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => severityLevels,
    (severity) => severityColors[severity],
  );

export const createaTrendChartData = (
  chartId: string,
  chartData: ResponseTrendChartData,
  res: ChartsData,
): UITrendChartData | undefined => {
  if (chartData.dataType === ChartDataType.Status) {
    return createStatusTrendChartData(chartId, res as ChartsResponse);
  } else if (chartData.dataType === ChartDataType.Severity) {
    return createSeverityTrendChartData(chartId, res as ChartsResponse);
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
      } else if (
        [ChartType.Pie, ChartType.HeatMap, ChartType.Bar, ChartType.Funnel, ChartType.TreeMap].includes(chart.type)
      ) {
        acc[chartId] = chart;
      }
      return acc;
    },
    {} as Record<ChartId, UIChartData>,
  );
};

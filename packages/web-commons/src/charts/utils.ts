import type { ChartId } from "@allurereport/charts-api";
import { BarChartType, ChartDataType, ChartType, TreeMapChartType } from "@allurereport/charts-api";
import type { SeverityLevel, TestStatus } from "@allurereport/core-api";
import { severityLevels, statusesList } from "@allurereport/core-api";
import { interpolateRgb } from "d3-interpolate";
import { scaleLinear } from "d3-scale";
import { resolveCSSVarColor, severityColors, statusChangeColors, statusColors } from "./colors.js";
import type {
  ChartsData,
  ChartsDataWithEnvs,
  ResponseBarChartData,
  ResponseHeatMapChartData,
  ResponseTreeMapChartData,
  ResponseTrendChartData,
  TreeMapTooltipAccessor,
  TrendChartItem,
  UIBarChartData,
  UIChartData,
  UIChartsDataWithEnvs,
  UIHeatMapChartData,
  UITreeMapChartData,
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

export const createTreeMapChartDataGeneric = (
  getChart: () => ResponseTreeMapChartData | undefined,
  colors: (value: number, domain?: number[]) => string,
  formatLegend?: (value: number) => string,
  legendDomain?: number[],
  tooltipRows?: TreeMapTooltipAccessor,
): UITreeMapChartData | undefined => {
  const chart = getChart();
  if (!chart) {
    return undefined;
  }

  return {
    ...chart,
    colors,
    formatLegend,
    legendDomain,
    tooltipRows,
  };
};

export const createHeatMapChartDataGeneric = (
  getChart: () => ResponseHeatMapChartData | undefined,
  colors: (value: number, domain?: number[]) => string,
): UIHeatMapChartData | undefined => {
  const chart = getChart();
  if (!chart) {
    return undefined;
  }

  return {
    ...chart,
    colors,
  };
};

export const createStatusTrendChartData = (chartId: ChartId, res: ChartsData): UITrendChartData | undefined =>
  createTrendChartDataGeneric(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => statusesList,
    (status) => statusColors[status],
  );

export const createSeverityTrendChartData = (chartId: ChartId, res: ChartsData): UITrendChartData | undefined =>
  createTrendChartDataGeneric(
    () => res[chartId] as ResponseTrendChartData | undefined,
    () => severityLevels,
    (severity) => severityColors[severity],
  );

export const createStatusBySeverityBarChartData = (chartId: ChartId, res: ChartsData): UIBarChartData | undefined =>
  createBarChartDataGeneric(
    () => res[chartId] as ResponseBarChartData | undefined,
    () => statusColors,
  );

export const createStatusTrendBarChartData = (chartId: ChartId, res: ChartsData): UIBarChartData | undefined =>
  createBarChartDataGeneric(
    () => res[chartId] as ResponseBarChartData | undefined,
    () => statusColors,
  );

export const createStatusChangeTrendBarChartData = (chartId: ChartId, res: ChartsData): UIBarChartData | undefined =>
  createBarChartDataGeneric(
    () => res[chartId] as ResponseBarChartData | undefined,
    () => statusChangeColors,
  );

export const createSuccessRateDistributionTreeMapChartData = (
  chartId: ChartId,
  res: ChartsData,
): UITreeMapChartData | undefined => {
  const chartColorDomain = [0, 1];

  return createTreeMapChartDataGeneric(
    () => res[chartId] as ResponseTreeMapChartData | undefined,
    (value: number, domain = chartColorDomain) => {
      const scaledRgb = scaleLinear<string>()
        .domain(domain)
        .range([resolveCSSVarColor(statusColors.failed), resolveCSSVarColor(statusColors.passed)])
        .interpolate(interpolateRgb)
        .clamp(true);

      return scaledRgb(value);
    },
    (value) => {
      // TODO: Change this to i18n t-function usage
      if (value === 1) {
        return "passed";
      }
      return "failed";
    },
    chartColorDomain,
    (node: any) => {
      return [`passed: ${node.data.passedTests}`, `failed: ${node.data.failedTests}`, `other: ${node.data.otherTests}`];
    },
  );
};

export const createCoverageDiffTreeMapChartData = (
  chartId: ChartId,
  res: ChartsData,
): UITreeMapChartData | undefined => {
  const chartColorDomain = [0, 0.5, 1];

  return createTreeMapChartDataGeneric(
    () => res[chartId] as ResponseTreeMapChartData | undefined,
    (value: number, domain = chartColorDomain) => {
      const scaledRgb = scaleLinear<string>()
        .domain(domain)
        .range([resolveCSSVarColor(statusColors.failed), "#fff", resolveCSSVarColor(statusColors.passed)])
        .interpolate(interpolateRgb)
        .clamp(true);

      return scaledRgb(value);
    },
    (value) => {
      // TODO: Change this to i18n t-function usage
      if (value === 1) {
        return "new";
      }
      return "removed";
    },
    chartColorDomain,
    (node: any) => {
      const newTotal = node.data.newCount + node.data.enabledCount;
      const deletedTotal = node.data.deletedCount + node.data.disabledCount;
      const unchangedTotal = node.value - newTotal - deletedTotal;

      return [`new: ${newTotal}`, `deleted: ${deletedTotal}`, `unchanged: ${unchangedTotal}`];
    },
  );
};

export const createProblemsDistributionHeatMapChartData = (
  chartId: ChartId,
  res: ChartsData,
): UIHeatMapChartData | undefined => {
  const chartColorDomain = [0, 1];

  return createHeatMapChartDataGeneric(
    () => res[chartId] as ResponseHeatMapChartData | undefined,
    (value: number, domain = chartColorDomain) => {
      const scaledRgb = scaleLinear<string>()
        .domain(domain)
        .range([resolveCSSVarColor(statusColors.passed), resolveCSSVarColor(statusColors.failed)])
        .interpolate(interpolateRgb)
        .clamp(true);

      return scaledRgb(value);
    },
  );
};

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

export const createTreeMapChartData = (
  chartId: ChartId,
  chartData: ResponseTreeMapChartData,
  res: ChartsData,
): UITreeMapChartData | undefined => {
  if (chartData.dataType === TreeMapChartType.SuccessRateDistribution) {
    return createSuccessRateDistributionTreeMapChartData(chartId, res);
  } else if (chartData.dataType === TreeMapChartType.CoverageDiff) {
    return createCoverageDiffTreeMapChartData(chartId, res);
  }
};

export const createHeatMapChartData = (chartId: ChartId, res: ChartsData): UIHeatMapChartData | undefined => {
  return createProblemsDistributionHeatMapChartData(chartId, res);
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
      } else if (chart.type === ChartType.TreeMap) {
        const chartData = createTreeMapChartData(chartId, chart, res);
        if (chartData) {
          acc[chartId] = chartData;
        }
      } else if (chart.type === ChartType.HeatMap) {
        const chartData = createHeatMapChartData(chartId, res);
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

export const createChartsWithEnvs = (res: ChartsDataWithEnvs): UIChartsDataWithEnvs => {
  // This is a fall back for old data format
  if (!("general" in res) && !("byEnv" in res)) {
    return { general: createCharts(res as ChartsData), byEnv: {} };
  }

  const result: UIChartsDataWithEnvs = {
    general: createCharts(res.general),
    byEnv: {},
  };

  for (const [env, chartData] of Object.entries(res.byEnv)) {
    result.byEnv[env] = createCharts(chartData);
  }

  return result;
};

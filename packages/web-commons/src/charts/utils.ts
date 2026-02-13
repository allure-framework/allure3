import type {
  ChartId,
  CurrentStatusChartData,
  DurationDynamicsChartData,
  DurationsChartData,
  StabilityDistributionChartData,
  StatusAgePyramidChartData,
  StatusDynamicsChartData,
  StatusTransitionsChartData,
  TestBaseGrowthDynamicsChartData,
  TestingPyramidChartData,
  TrSeveritiesChartData,
} from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import { interpolateRgb } from "d3-interpolate";
import { scaleLinear } from "d3-scale";
import { nanoid } from "nanoid";
import { resolveCSSVarColor, statusColors } from "./colors.js";
import type {
  ChartsData,
  ChartsDataWithEnvs,
  ResponseHeatMapChartData,
  ResponseTreeMapChartData,
  TreeMapTooltipAccessor,
  UIChartData,
  UIChartsDataWithEnvs,
  UIHeatMapChartData,
  UITreeMapChartData,
} from "./types.js";

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

export const createTreeMapChartData = (
  chartId: ChartId,
  chartData: ResponseTreeMapChartData,
  res: ChartsData,
): UITreeMapChartData | undefined => {
  if (chartData.type === ChartType.SuccessRateDistribution) {
    return createSuccessRateDistributionTreeMapChartData(chartId, res);
  } else if (chartData.type === ChartType.CoverageDiff) {
    return createCoverageDiffTreeMapChartData(chartId, res);
  }
};

export const createHeatMapChartData = (chartId: ChartId, res: ChartsData): UIHeatMapChartData | undefined => {
  return createProblemsDistributionHeatMapChartData(chartId, res);
};

export const createCharts = (res: ChartsData): Record<ChartId, UIChartData> => {
  return Object.entries(res).reduce(
    (acc, [chartId, chart]) => {
      if (chart.type === ChartType.CurrentStatus) {
        acc[chartId] = res[chartId] as CurrentStatusChartData;
      } else if (chart.type === ChartType.StatusDynamics) {
        acc[chartId] = res[chartId] as StatusDynamicsChartData;
      } else if (chart.type === ChartType.StatusTransitions) {
        acc[chartId] = res[chartId] as StatusTransitionsChartData;
      } else if (chart.type === ChartType.Durations) {
        acc[chartId] = res[chartId] as DurationsChartData;
      } else if (chart.type === ChartType.StabilityDistribution) {
        acc[chartId] = res[chartId] as StabilityDistributionChartData;
      } else if (chart.type === ChartType.TestBaseGrowthDynamics) {
        acc[chartId] = res[chartId] as TestBaseGrowthDynamicsChartData;
      } else if (chart.type === ChartType.StatusAgePyramid) {
        acc[chartId] = res[chartId] as StatusAgePyramidChartData;
      } else if (chart.type === ChartType.TrSeverities) {
        acc[chartId] = res[chartId] as TrSeveritiesChartData;
      } else if (chart.type === ChartType.DurationDynamics) {
        acc[chartId] = res[chartId] as DurationDynamicsChartData;
      } else if (chart.type === ChartType.CoverageDiff || chart.type === ChartType.SuccessRateDistribution) {
        const chartData = createTreeMapChartData(chartId, chart, res);
        if (chartData) {
          acc[chartId] = chartData;
        }
      } else if (chart.type === ChartType.ProblemsDistribution) {
        const chartData = createHeatMapChartData(chartId, res);
        if (chartData) {
          acc[chartId] = chartData;
        }
      } else if (chart.type === ChartType.TestingPyramid) {
        acc[chartId] = res[chartId] as TestingPyramidChartData;
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

export const createHashStorage = () => {
  const hashes = new Map<string, string>();
  return {
    get: (key: string) => {
      if (!hashes.has(key)) {
        hashes.set(key, nanoid());
      }
      return hashes.get(key) as string;
    },
    set: (key: string, value: string) => hashes.set(key, value),
  };
};

export const createMapWithDefault = <K, V>(defaultValue: V) => {
  const map = new Map<K, V>();

  const createDefaultValue = (): V => {
    if (Array.isArray(defaultValue)) {
      return [...defaultValue] as V;
    }

    if (typeof defaultValue === "object") {
      return { ...defaultValue } as V;
    }

    return defaultValue;
  };

  return {
    set: (key: K, value: V) => map.set(key, value),
    get: (key: K) => {
      if (!map.has(key)) {
        map.set(key, createDefaultValue());
      }

      return map.get(key)!;
    },
    get values() {
      return Array.from(map.values());
    },
    get entries() {
      return Array.from(map.entries());
    },
  } as const;
};

import { ChartType, type HistoryDataPoint, type Statistic, type TestResult } from "@allurereport/core-api";
import {
  type GeneratedChartData,
  type GeneratedChartsData,
  type PluginContext,
  generateComingSoonChart,
  generatePieChart,
  generateTrendChart,
} from "@allurereport/plugin-api";
import { randomUUID } from "crypto";
import type { AwesomeOptions } from "./model.js";
import type { AwesomeDataWriter } from "./writer.js";

export const generateCharts = async (
  options: AwesomeOptions,
  context: PluginContext,
  stores: {
    trs: TestResult[];
    statistic: Statistic;
    history: HistoryDataPoint[];
  },
): Promise<GeneratedChartsData | undefined> => {
  const { charts, versionLabel } = options;

  if (!charts) {
    return undefined;
  }

  // Create custom execution ID accessor if versionLabel is configured
  const getExecutionIdFromLabels = (executionOrder: number): string => {
    if (!versionLabel) {
      return `execution-${executionOrder}`;
    }

    // For current execution (last in order)
    if (executionOrder > stores.history.length) {
      // Get label from current test results
      const labelValue = stores.trs
        .flatMap((tr) => tr.labels || [])
        .find((label) => label.name === versionLabel)?.value;
      
      return labelValue || `execution-${executionOrder}`;
    }

    // For historical executions
    const historyIndex = executionOrder - 1;
    if (historyIndex >= 0 && historyIndex < stores.history.length) {
      const historyPoint = stores.history[historyIndex];
      // Try to find label in any test result from this history point
      const labelValue = Object.values(historyPoint.testResults)
        .flatMap((tr) => tr.labels || [])
        .find((label) => label.name === versionLabel)?.value;
      
      return labelValue || `execution-${executionOrder}`;
    }

    return `execution-${executionOrder}`;
  };

  return charts.reduce(
    (acc, chartOptions) => {
      const chartId = randomUUID();

      let chart: GeneratedChartData | undefined;

      if (chartOptions.type === ChartType.Trend) {
        // Inject custom metadata accessor if versionLabel is configured
        const enhancedChartOptions = versionLabel
          ? {
              ...chartOptions,
              metadata: {
                ...chartOptions.metadata,
                executionIdAccessor: getExecutionIdFromLabels,
              },
            }
          : chartOptions;

        chart = generateTrendChart(enhancedChartOptions, stores, context);
      } else if (chartOptions.type === ChartType.Pie) {
        chart = generatePieChart(chartOptions, stores);
      } else if ([ChartType.HeatMap, ChartType.Bar, ChartType.Funnel, ChartType.TreeMap].includes(chartOptions.type)) {
        chart = generateComingSoonChart(chartOptions);
      }

      if (chart) {
        acc[chartId] = chart;
      }

      return acc;
    },
    {} as Record<string, GeneratedChartData>,
  );
};

export const generateAllCharts = async (
  writer: AwesomeDataWriter,
  options: AwesomeOptions,
  context: PluginContext,
  stores: {
    trs: TestResult[];
    statistic: Statistic;
    history: HistoryDataPoint[];
  },
): Promise<void> => {
  const charts = await generateCharts(options, context, stores);

  if (charts && Object.keys(charts).length > 0) {
    await writer.writeWidget("charts.json", charts);
  }
};

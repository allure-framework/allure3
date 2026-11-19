import { ChartType, type RunTrendPoint } from "@allurereport/charts-api";

import type { ChartWidgetProps } from "./ChartWidget.types";
import { RunTrendChartWidget } from "./RunTrendChartWidget";

const CATEGORICAL_COLORS_COUNT = 14;

const categoricalColor = (index: number) => `var(--color-chart-categorical-${(index % CATEGORICAL_COLORS_COUNT) + 1})`;

export const ChartRenderer = ({ chartData, t }: ChartWidgetProps) => {
  const formatTick = (point: RunTrendPoint) =>
    point.id === "current" ? t("runTrend.ticks.current") : t("runTrend.ticks.history", { timestamp: point.timestamp });
  const formatPoint = (point: RunTrendPoint) =>
    point.id === "current"
      ? t("runTrend.tooltips.current", { timestamp: point.timestamp })
      : t("runTrend.tooltips.history", { timestamp: point.timestamp });
  const emptyLabel = t("runTrend.empty");

  switch (chartData.type) {
    case ChartType.DurationTrend:
      return (
        <RunTrendChartWidget
          title={chartData.title ?? t("durationTrend.title")}
          points={chartData.data}
          series={[
            {
              id: "duration",
              label: t("durationTrend.duration"),
              color: categoricalColor(3),
              values: chartData.data.map(({ duration }) => duration),
            },
          ]}
          emptyLabel={emptyLabel}
          formatTick={formatTick}
          formatPoint={formatPoint}
          formatValue={(duration) => t("durationTrend.value", { duration })}
        />
      );
    case ChartType.RetriesTrend:
      return (
        <RunTrendChartWidget
          title={chartData.title ?? t("retriesTrend.title")}
          points={chartData.data}
          series={[
            {
              id: "run",
              label: t("retriesTrend.run"),
              color: categoricalColor(2),
              values: chartData.data.map(({ run }) => run),
            },
            {
              id: "retry",
              label: t("retriesTrend.retry"),
              color: categoricalColor(1),
              values: chartData.data.map(({ retry }) => retry),
            },
          ]}
          emptyLabel={emptyLabel}
          formatTick={formatTick}
          formatPoint={formatPoint}
          integer
        />
      );
    case ChartType.CategoriesTrend: {
      const latest = chartData.data[chartData.data.length - 1]?.categories ?? {};
      // the largest category of the latest run goes to the bottom of the stack, as in Allure 2
      const series = chartData.categories
        .map((name, index) => ({
          id: name,
          label: name,
          color: categoricalColor(index),
          values: chartData.data.map(({ categories }) => categories[name] ?? 0),
        }))
        .sort((a, b) => (latest[b.id] ?? 0) - (latest[a.id] ?? 0));

      return (
        <RunTrendChartWidget
          title={chartData.title ?? t("categoriesTrend.title")}
          points={chartData.data}
          series={series}
          emptyLabel={emptyLabel}
          formatTick={formatTick}
          formatPoint={formatPoint}
          integer
        />
      );
    }
    default:
      return null;
  }
};

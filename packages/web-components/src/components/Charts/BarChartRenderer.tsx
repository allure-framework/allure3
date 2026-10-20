import { ChartType } from "@allurereport/charts-api";

import type { ChartWidgetProps } from "./ChartWidget.types";
import { DurationDynamicsChartWidget } from "./DurationDynamicsChartWidget";
import { DurationsChartWidget } from "./DurationsChartWidget";
import { StabilityDistributionWidget } from "./StabilityDistributionWidget";
import { StatusAgePyramidChartWidget } from "./StatusAgePyramidChartWidget";
import { StatusDynamicsChartWidget } from "./StatusDynamicsChartWidget";
import { StatusTransitionsChartWidget } from "./StatusTransitionsChartWidget";
import { TestBaseGrowthDynamicsChartWidget } from "./TestBaseGrowthDynamicsChartWidget";
import { TrSeveritiesChartWidget } from "./TrSeveritiesChartWidget";

export const ChartRenderer = ({ chartData, t }: ChartWidgetProps) => {
  switch (chartData.type) {
    case ChartType.StatusDynamics: {
      const title = chartData.title ?? t("statusDynamics.title");

      return (
        <StatusDynamicsChartWidget
          title={title}
          data={chartData.data}
          limit={chartData.limit}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`statusDynamics.${key}`, props)}
        />
      );
    }
    case ChartType.StatusTransitions: {
      const title = chartData.title ?? t("statusTransitions.title");

      return (
        <StatusTransitionsChartWidget
          title={title}
          data={chartData.data}
          i18n={(key, props = {}) => t(`statusTransitions.${key}`, props)}
        />
      );
    }
    case ChartType.Durations: {
      const title =
        chartData.title ??
        (chartData.groupBy === "none"
          ? t("durations.title_none")
          : t("durations.title", { groupBy: chartData.groupBy }));

      return (
        <DurationsChartWidget
          title={title}
          data={chartData.data}
          groupBy={chartData.groupBy}
          keys={chartData.keys}
          i18n={(key, props = {}) => t(`durations.${key}`, props)}
        />
      );
    }
    case ChartType.StabilityDistribution: {
      const title = chartData.title ?? t("stabilityDistribution.title");

      return (
        <StabilityDistributionWidget
          title={title}
          data={chartData.data}
          keys={chartData.keys}
          i18n={(key, props = {}) => t(`stabilityDistribution.${key}`, props)}
          threshold={chartData.threshold}
        />
      );
    }
    case ChartType.TestBaseGrowthDynamics: {
      const title = chartData.title ?? t("testBaseGrowthDynamics.title");

      return (
        <TestBaseGrowthDynamicsChartWidget
          title={title}
          data={chartData.data}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`testBaseGrowthDynamics.${key}`, props)}
        />
      );
    }
    case ChartType.StatusAgePyramid: {
      const title = chartData.title ?? t("statusAgePyramid.title");

      return (
        <StatusAgePyramidChartWidget
          title={title}
          data={chartData.data}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`statusAgePyramid.${key}`, props)}
        />
      );
    }
    case ChartType.TrSeverities: {
      const title = chartData.title ?? t("trSeverities.title");

      return (
        <TrSeveritiesChartWidget
          title={title}
          data={chartData.data}
          levels={chartData.levels}
          statuses={chartData.statuses}
          i18n={(key, props = {}) => t(`trSeverities.${key}`, props)}
        />
      );
    }
    case ChartType.DurationDynamics: {
      const title = chartData.title ?? t("durationDynamics.title");

      return (
        <DurationDynamicsChartWidget
          title={title}
          data={chartData.data}
          i18n={(key, props = {}) => t(`durationDynamics.${key}`, props)}
        />
      );
    }
    default:
      return null;
  }
};

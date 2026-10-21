import { ChartType } from "@allurereport/charts-api";

import type { ChartWidgetProps } from "./ChartWidget.types";
import { CurrentStatusChartWidget } from "./CurrentStatusChartWidget";

export const ChartRenderer = ({ chartData, t }: ChartWidgetProps) => {
  switch (chartData.type) {
    case ChartType.CurrentStatus: {
      const title = chartData.title ?? t("currentStatus.title");

      return (
        <CurrentStatusChartWidget
          title={title}
          data={chartData.data}
          statuses={chartData.statuses}
          metric={chartData.metric}
          i18n={(key, props = {}) => t(`currentStatus.${key}`, props)}
        />
      );
    }
    default:
      return null;
  }
};

import { ChartType } from "@allurereport/charts-api";

import type { ChartWidgetProps } from "./ChartWidget.types";
import { HeatMapWidget } from "./HeatMapWidget";

export const ChartRenderer = ({ chartData, empty }: ChartWidgetProps) => {
  switch (chartData.type) {
    case ChartType.ProblemsDistribution: {
      return (
        <HeatMapWidget
          title={chartData.title}
          data={chartData.data}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    default:
      return null;
  }
};

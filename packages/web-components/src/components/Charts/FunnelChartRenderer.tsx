import { ChartType } from "@allurereport/charts-api";

import type { ChartWidgetProps } from "./ChartWidget.types";
import { TestingPyramidWidget } from "./TestingPyramidWidget";

export const ChartRenderer = ({ chartData, t, empty }: ChartWidgetProps) => {
  switch (chartData.type) {
    case ChartType.TestingPyramid: {
      const isDataEmpty = !chartData.data.some((item) => item.testCount > 0);

      return (
        <TestingPyramidWidget
          i18n={(key, values) => t(`successRate.${key}`, values)}
          title={chartData.title}
          data={isDataEmpty ? [] : chartData.data}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    default:
      return null;
  }
};

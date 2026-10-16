import { ChartType } from "@allurereport/charts-api";

import type { ChartWidgetProps } from "../ChartWidget.types";
import { TreeMapChartWidget } from "../TreeMapChartWidget";

export const ChartFamily = ({ chartData, t, empty }: ChartWidgetProps) => {
  switch (chartData.type) {
    case ChartType.CoverageDiff: {
      return (
        <TreeMapChartWidget
          data={chartData.treeMap}
          chartType={ChartType.CoverageDiff}
          title={chartData.title}
          formatLegend={chartData.formatLegend}
          colors={chartData.colors}
          legendDomain={chartData.legendDomain}
          tooltipRows={chartData.tooltipRows}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    case ChartType.SuccessRateDistribution: {
      return (
        <TreeMapChartWidget
          chartType={ChartType.SuccessRateDistribution}
          i18n={(key, values) => t(`successRate.${key}`, values)}
          data={chartData.treeMap}
          title={chartData.title}
          formatLegend={chartData.formatLegend}
          colors={chartData.colors}
          legendDomain={chartData.legendDomain}
          tooltipRows={chartData.tooltipRows}
          translations={{ "no-results": empty("no-results") }}
        />
      );
    }
    default:
      return null;
  }
};

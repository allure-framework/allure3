import type { UIChartData } from "@allurereport/web-commons";

export type ChartWidgetProps = {
  chartData: UIChartData;
  t: (key: string, options?: any) => string;
  empty: (key: string, options?: any) => string;
};

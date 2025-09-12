import type { TreeMapChartProps } from "../TreeMapChart/types.js";

export interface TreeMapChartWidgetProps extends Omit<TreeMapChartProps, "colors"> {
  title: string;
  colors: (value: number, domain?: number[]) => string;
  formatLegend?: (value: number) => string;
  translations: Record<string, string>;
  showLegend?: boolean;
  domain?: number[];
}

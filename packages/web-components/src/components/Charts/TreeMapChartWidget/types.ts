import type { TreeMapChartProps } from "../TreeMapChart/types.js";

export interface TreeMapChartWidgetProps extends Omit<TreeMapChartProps, "colors"> {
  title: string;
  colors: (value: number, min?: number, max?: number) => string;
  formatLegend?: (value: number) => string;
  translations: Record<string, string>;
  showLegend?: boolean;
  legendMinValue?: number;
  legendMaxValue?: number;
}

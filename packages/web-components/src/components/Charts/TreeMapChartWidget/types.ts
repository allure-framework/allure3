import type { TreeMapChartProps } from "../TreeMapChart/types.js";

export interface TreeMapChartWidgetProps extends Omit<TreeMapChartProps, "colors"> {
  title: string;
  translations: Record<string, string>;
}

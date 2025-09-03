import type { TreeMapChartProps, TreeMapChartNode } from "../TreeMapChart/types.js";

export interface TreeMapChartWidgetProps extends Omit<TreeMapChartProps, "colors"> {
  title: string;
  translations: Record<string, string>;
  colors: (d: TreeMapChartNode) => string;
}

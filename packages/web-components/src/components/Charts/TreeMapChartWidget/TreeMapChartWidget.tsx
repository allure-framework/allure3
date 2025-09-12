import type { FunctionalComponent } from "preact";
import { Widget } from "../../Widget/index.js";
import { TreeMapChart } from "../TreeMapChart/index.js";
import type { TreeMapChartWidgetProps } from "./types.js";

export const TreeMapChartWidget: FunctionalComponent<TreeMapChartWidgetProps> = ({
  title,
  data,
  height = 400,
  width = "100%",
  rootAriaLabel,
  colors,
  formatLegend,
  translations,
  showLegend = true,
  minValue = 0,
  maxValue = 1,
  ...restProps
}) => {
  const emptyLabel = translations["no-results"];

  return (
    <Widget title={title}>
      <TreeMapChart
        data={data}
        height={height}
        width={width}
        emptyLabel={emptyLabel}
        emptyAriaLabel={emptyLabel}
        rootAriaLabel={rootAriaLabel}
        colors={(n) => colors(n.data.colorValue ?? 0, minValue, maxValue)}
        showLegend={showLegend}
        legendMinValue={minValue}
        legendMaxValue={maxValue}
        formatLegend={formatLegend}
        {...restProps}
      />
    </Widget>
  );
};

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
  translations,
  showLegend = true,
  legendMinValue = 0,
  legendMaxValue = 1,
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
        colors={(n) => colors(n.data.colorValue ?? 0)}
        showLegend={showLegend}
        legendMinValue={legendMinValue}
        legendMaxValue={legendMaxValue}
        {...restProps}
      />
    </Widget>
  );
};

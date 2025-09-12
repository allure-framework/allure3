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
  domain = [0, 1],
  ...restProps
}) => {
  const emptyLabel = translations["no-results"];
  const legendMinValue = domain[0];
  const legendMaxValue = domain[domain.length - 1];

  return (
    <Widget title={title}>
      <TreeMapChart
        data={data}
        height={height}
        width={width}
        emptyLabel={emptyLabel}
        emptyAriaLabel={emptyLabel}
        rootAriaLabel={rootAriaLabel}
        colors={(n) => colors(n.data.colorValue ?? 0, domain)}
        showLegend={showLegend}
        legendMinValue={legendMinValue}
        legendMaxValue={legendMaxValue}
        formatLegend={formatLegend}
        {...restProps}
      />
    </Widget>
  );
};

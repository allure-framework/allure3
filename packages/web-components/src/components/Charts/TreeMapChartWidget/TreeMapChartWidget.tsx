import type { FunctionalComponent } from "preact";
import { Widget } from "../../Widget/index.js";
import { TreeMapChart } from "../TreeMapChart/index.js";
import type { TreeMapChartWidgetProps } from "./types.js";

export const TreeMapChartWidget: FunctionalComponent<TreeMapChartWidgetProps> = ({
  title,
  data,
  height,
  width,
  rootAriaLabel,
  formatLegend,
  translations,
  showLegend,
  legendMinValue,
  legendMaxValue,
  legendDomain,
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
        showLegend={showLegend}
        legendMinValue={legendMinValue}
        legendMaxValue={legendMaxValue}
        formatLegend={formatLegend}
        legendDomain={legendDomain}
        {...restProps}
      />
    </Widget>
  );
};

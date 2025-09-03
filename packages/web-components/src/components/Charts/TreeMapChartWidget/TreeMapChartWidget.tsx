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
        identity="name"
        value="value"
        colors={colors}
      />
    </Widget>
  );
};

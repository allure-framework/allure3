import type { FunctionalComponent } from "preact";
import { Widget } from "../../Widget/index.js";
import { TreeMapChart } from "../TreeMapChart/index.js";
import type { TreeMapChartWidgetProps } from "./types.js";

export const TreeMapChartWidget: FunctionalComponent<TreeMapChartWidgetProps> = ({
  title,
  translations,
  ...restProps
}) => {
  const emptyLabel = translations["no-results"];

  return (
    <Widget title={title}>
      <TreeMapChart emptyLabel={emptyLabel} emptyAriaLabel={emptyLabel} {...restProps} />
    </Widget>
  );
};

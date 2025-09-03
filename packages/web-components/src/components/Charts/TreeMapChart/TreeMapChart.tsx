import { ResponsiveTreeMap as ResponsiveTreeMapChart } from "@nivo/treemap";
import type { FunctionalComponent } from "preact";
import { EmptyDataStub } from "../EmptyDataStub/index.js";
import { defaultTreeChartConfig } from "./config.js";
import { nivoTheme } from "./theme.js";
import type { TreeMapChartProps } from "./types.js";
import { useMemo } from "preact/hooks";

export const TreeMapChart: FunctionalComponent<TreeMapChartProps> = ({
  width = "100%",
  height = 400,
  rootAriaLabel,
  emptyLabel = "No data available",
  emptyAriaLabel = "No data available",
  data,
  ...restProps
}) => {
  const isEmpty = useMemo(() => (data.children ?? []).length === 0, [data]);

  if (isEmpty) {
    return <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyAriaLabel} />;
  }

  return (
    <div role="img" aria-label={rootAriaLabel} tabIndex={0} style={{ width, height }}>
      <ResponsiveTreeMapChart data={data} {...defaultTreeChartConfig} {...restProps} theme={nivoTheme} />
    </div>
  );
};

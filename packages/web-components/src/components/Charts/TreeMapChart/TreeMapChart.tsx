import { ResponsiveTreeMap as ResponsiveTreeMapChart } from "@nivo/treemap";
import type { FunctionalComponent } from "preact";
import { EmptyDataStub } from "../EmptyDataStub/index.js";
import { defaultTreeChartConfig } from "./config.js";
import { nivoTheme } from "./theme.js";
import type { TreeMapChartProps } from "./types.js";
import { TreeMapLegend } from "./TreeMapLegend/index.js";
import { useMemo } from "preact/hooks";
import styles from "./styles.scss";
import type { TreeMapNode } from "@allurereport/core-api";

export const TreeMapChart: FunctionalComponent<TreeMapChartProps> = ({
  width = "100%",
  height = 400,
  rootAriaLabel,
  emptyLabel = "No data available",
  emptyAriaLabel = "No data available",
  data,
  showLegend = true,
  legendMinValue = 0,
  legendMaxValue = 1,
  formatLegend,
  colors,
  ...restProps
}) => {
  const isEmpty = useMemo(() => (data.children ?? []).length === 0, [data]);

  if (isEmpty) {
    return <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyAriaLabel} />;
  }

  return (
    <div role="img" aria-label={rootAriaLabel} tabIndex={0} style={{ width, height }} className={styles.treeMapChart}>
      <ResponsiveTreeMapChart<TreeMapNode> data={data} {...defaultTreeChartConfig} {...restProps} theme={nivoTheme} colors={n => colors(n.data.colorValue ?? 0)} />
      {showLegend && <TreeMapLegend
        minValue={legendMinValue}
        maxValue={legendMaxValue}
        colorFn={colors}
        formatValue={formatLegend}
      />}
    </div>
  );
};

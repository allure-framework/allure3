import type { TreeMapNode } from "@allurereport/core-api";
import { ResponsiveTreeMap as ResponsiveTreeMapChart } from "@nivo/treemap";
import type { ComputedNode } from "@nivo/treemap";
import type { FunctionalComponent } from "preact";
import type { ReactNode } from "preact/compat";
import { useCallback, useMemo } from "preact/hooks";
import { EmptyDataStub } from "../EmptyDataStub/index.js";
import { TreeMapLegend } from "./TreeMapLegend/index.js";
import { TreeMapTooltip } from "./TreeMapTooltip/TreeMapTooltip.js";
import { defaultTreeChartConfig } from "./config.js";
import styles from "./styles.scss";
import { nivoTheme } from "./theme.js";
import type { TreeMapChartProps } from "./types.js";
import { createCustomParentLabelControl } from "./utils.js";

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
  legendDomain,
  parentSkipSize,
  tooltipRows,
  ...restProps
}) => {
  const isEmpty = useMemo(() => (data.children ?? []).length === 0, [data]);

  const parentLabel = useCallback(
    (node: any) => {
      return createCustomParentLabelControl({ parentSkipSize })(node);
    },
    [parentSkipSize],
  );

  const tooltipControl = useCallback<(props: { node: ComputedNode<TreeMapNode> }) => ReactNode>(
    ({ node }) => <TreeMapTooltip node={node} rows={tooltipRows && tooltipRows(node)} />,
    [tooltipRows],
  );

  if (isEmpty) {
    return <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyAriaLabel} />;
  }

  return (
    <div role="img" aria-label={rootAriaLabel} tabIndex={0} style={{ width, height }} className={styles.treeMapChart}>
      <ResponsiveTreeMapChart<TreeMapNode>
        data={data}
        parentLabel={parentLabel}
        tooltip={tooltipControl}
        {...defaultTreeChartConfig}
        {...restProps}
        theme={nivoTheme}
        colors={(n) => colors(n.data.colorValue ?? 0)}
      />
      {showLegend && (
        <TreeMapLegend
          minValue={legendMinValue}
          maxValue={legendMaxValue}
          colorFn={colors}
          formatValue={formatLegend}
          domain={legendDomain}
        />
      )}
    </div>
  );
};

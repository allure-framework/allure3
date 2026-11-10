import type { TreeMapNode } from "@allurereport/charts-api";
import type { ComputedNode } from "@nivo/treemap";
import { ResponsiveTreeMap as ResponsiveTreeMapChart } from "@nivo/treemap";
import type { FunctionalComponent } from "preact";
import type { ReactNode } from "preact/compat";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";

import { useChartTooltip } from "../ChartTooltip/useChartTooltip.js";
import { CHART_MOTION_CONFIG, CHART_THEME, REDUCE_MOTION } from "../config.js";
import { EmptyDataStub } from "../EmptyDataStub/index.js";
import { defaultTreeChartConfig } from "./config.js";
import { TreeMapNodeComponent } from "./Node.js";
import { TreeMapLegend } from "./TreeMapLegend/index.js";
import { TreeMapTooltip } from "./TreeMapTooltip/TreeMapTooltip.js";
import type { TreeMapChartProps } from "./types.js";
import { createCustomParentLabelControl } from "./utils.js";

import styles from "./styles.scss";

// Keep tooltip state outside the chart so moving between cells does not render every node.
const TreeMapChartContainer: FunctionalComponent<
  Pick<TreeMapChartProps, "width" | "height" | "rootAriaLabel"> & { isSuccessRate: boolean }
> = ({ width, height, rootAriaLabel, isSuccessRate, children }) => {
  const boundary = useRef<HTMLDivElement>(null);
  const [tooltipText, setTooltipText] = useState("");
  const chartTooltip = useChartTooltip(tooltipText, tooltipText, { followPointer: true, boundary });

  return (
    <div
      ref={boundary}
      role={isSuccessRate ? "group" : "img"}
      aria-label={rootAriaLabel}
      tabIndex={isSuccessRate ? undefined : 0}
      style={{ width, height }}
      className={styles.treeMapChart}
      onMouseMove={
        isSuccessRate
          ? (event) => {
              const text = event.target instanceof SVGElement && event.target.getAttribute("aria-label");
              if (text) {
                setTooltipText(text);
                chartTooltip.triggerProps.onMouseEnter(event);
              } else {
                chartTooltip.triggerProps.onMouseLeave();
              }
            }
          : undefined
      }
      onMouseLeave={isSuccessRate ? chartTooltip.triggerProps.onMouseLeave : undefined}
      onFocus={
        isSuccessRate
          ? (event) => {
              const text = event.target instanceof SVGElement && event.target.getAttribute("aria-label");
              if (text) {
                setTooltipText(text);
                chartTooltip.triggerProps.onFocus(event);
              }
            }
          : undefined
      }
      onBlur={isSuccessRate ? chartTooltip.triggerProps.onBlur : undefined}
    >
      {children}
      {isSuccessRate && chartTooltip.tooltip}
    </div>
  );
};

export const TreeMapChart: FunctionalComponent<
  TreeMapChartProps & {
    labelColor?: (node: any) => string;
  }
> = ({
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
  missingValueColor,
  legendDomain,
  parentSkipSize,
  tooltipRows,
  labelColor,
  ...restProps
}) => {
  const isSuccessRate = "successRateText" in data;
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
    <TreeMapChartContainer width={width} height={height} rootAriaLabel={rootAriaLabel} isSuccessRate={isSuccessRate}>
      <ResponsiveTreeMapChart<TreeMapNode>
        data={data}
        parentLabel={parentLabel}
        tooltip={tooltipControl}
        {...defaultTreeChartConfig}
        {...restProps}
        isInteractive={!isSuccessRate && restProps.isInteractive !== false}
        theme={CHART_THEME}
        motionConfig={CHART_MOTION_CONFIG}
        animate={!REDUCE_MOTION}
        colors={(n) =>
          n.data.colorValue === undefined && missingValueColor !== undefined
            ? missingValueColor
            : colors(n.data.colorValue ?? 0)
        }
        labelTextColor={labelColor}
        parentLabelTextColor={labelColor}
        borderColor={"var(--color-bg-primary)"}
        borderWidth={1}
        nodeComponent={TreeMapNodeComponent}
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
    </TreeMapChartContainer>
  );
};

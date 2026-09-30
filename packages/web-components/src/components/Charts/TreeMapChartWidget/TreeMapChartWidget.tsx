import type { TreeMapNode } from "@allurereport/charts-api";
import { ChartType } from "@allurereport/charts-api";
import type { FunctionalComponent } from "preact";

import { useTheme } from "@/components/ThemeProvider/index.js";

import { Widget } from "../../Widget/index.js";
import {
  defaultSuccessRateI18n,
  formatAvailableSuccessRate,
  formatChartPercentage,
  successRateDescription,
  type SuccessRateI18n,
} from "../SuccessRatePieChart/successRate.js";
import { TreeMapChart } from "../TreeMapChart/index.js";
import { resolveCSSVarColor } from "../utils.js";
import { useCoverageDiffColors, useCoverageDiffTextColors, useSuccessRateDistributionColors } from "./hooks.js";
import type { TreeMapChartWidgetProps } from "./types.js";

export const TreeMapChartWidget: FunctionalComponent<
  TreeMapChartWidgetProps & {
    chartType: ChartType.CoverageDiff | ChartType.SuccessRateDistribution;
    i18n?: SuccessRateI18n;
  }
> = ({ title, translations, chartType, i18n = defaultSuccessRateI18n, data, ...restProps }) => {
  const emptyLabel = translations["no-results"];
  const currentTheme = useTheme();
  const coverageDiffColors = useCoverageDiffColors(currentTheme);
  const successRateDistributionColors = useSuccessRateDistributionColors(currentTheme);
  const coverageDiffTextColors = useCoverageDiffTextColors(currentTheme);
  const successRateMissingValueColor = resolveCSSVarColor("var(--color-status-skipped-chart-fill)");

  type SuccessRateNode = TreeMapNode<{
    passedTests?: number;
    failedTests?: number;
    otherTests?: number;
    eligibleCount?: number;
    successRateText?: string;
  }>;
  const root = data as SuccessRateNode;
  const reportTotal = (root.passedTests ?? 0) + (root.failedTests ?? 0) + (root.otherTests ?? 0);
  const describeNode = (node: SuccessRateNode): SuccessRateNode => {
    const total = (node.passedTests ?? 0) + (node.failedTests ?? 0) + (node.otherTests ?? 0);
    const eligibleCount = node.eligibleCount ?? total;
    const label = i18n("successRate", {
      rate: total ? formatAvailableSuccessRate((node.colorValue ?? 0) * 100, eligibleCount, i18n) : "???",
    });

    return {
      ...node,
      successRateText: `${node.id}: ${label}\n${i18n("slice", { count: total, percent: formatChartPercentage(reportTotal ? (total / reportTotal) * 100 : 0) })}\n${successRateDescription(total, eligibleCount, i18n)}`,
      children: node.children?.map(describeNode),
    };
  };

  return (
    <Widget title={title}>
      <TreeMapChart
        data={chartType === ChartType.SuccessRateDistribution ? describeNode(data) : data}
        emptyLabel={emptyLabel}
        emptyAriaLabel={emptyLabel}
        {...restProps}
        isInteractive={chartType !== ChartType.SuccessRateDistribution}
        colors={chartType === ChartType.CoverageDiff ? coverageDiffColors : successRateDistributionColors}
        missingValueColor={chartType === ChartType.SuccessRateDistribution ? successRateMissingValueColor : undefined}
        showLegend={false}
        labelColor={
          chartType === ChartType.CoverageDiff
            ? (n: any) => coverageDiffTextColors(n.data.colorValue ?? 0)
            : () => "var(--color-text-inverse)"
        }
      />
    </Widget>
  );
};

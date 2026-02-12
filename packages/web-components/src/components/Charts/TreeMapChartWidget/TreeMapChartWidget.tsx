import { ChartType } from "@allurereport/charts-api";
import type { FunctionalComponent } from "preact";
import { useTheme } from "@/components/ThemeProvider/index.js";
import { Widget } from "../../Widget/index.js";
import { TreeMapChart } from "../TreeMapChart/index.js";
import { useCoverageDiffColors, useCoverageDiffTextColors, useSuccessRateDistributionColors } from "./hooks.js";
import type { TreeMapChartWidgetProps } from "./types.js";

export const TreeMapChartWidget: FunctionalComponent<
  TreeMapChartWidgetProps & {
    chartType: ChartType.CoverageDiff | ChartType.SuccessRateDistribution;
  }
> = ({ title, translations, chartType, ...restProps }) => {
  const emptyLabel = translations["no-results"];
  const currentTheme = useTheme();
  const coverageDiffColors = useCoverageDiffColors(currentTheme);
  const successRateDistributionColors = useSuccessRateDistributionColors(currentTheme);
  const coverageDiffTextColors = useCoverageDiffTextColors(currentTheme);

  return (
    <Widget title={title}>
      <TreeMapChart
        emptyLabel={emptyLabel}
        emptyAriaLabel={emptyLabel}
        {...restProps}
        colors={chartType === ChartType.CoverageDiff ? coverageDiffColors : successRateDistributionColors}
        showLegend={false}
        labelColor={
          chartType === ChartType.CoverageDiff
            ? (n: any) => coverageDiffTextColors(n.data.colorValue ?? 0)
            : () => "var(--constant-on-text-primary)"
        }
      />
    </Widget>
  );
};

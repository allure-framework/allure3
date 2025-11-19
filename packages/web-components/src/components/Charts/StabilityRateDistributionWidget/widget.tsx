import type { AxisProps } from "@nivo/axes";
import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { Widget } from "../../Widget/index.js";
import { defaultBarChartAxisBottomConfig, defaultBarChartAxisLeftConfig } from "../BarChart/config.js";
import { BarChart } from "../BarChart/index.js";
import type { StabilityRateDistributionWidgetProps } from "./types.js";

export const StabilityRateDistributionWidget: FunctionalComponent<StabilityRateDistributionWidgetProps> = ({
  title,
  data,
  keys,
  indexBy,
  groupMode = "grouped",
  height = 400,
  width = "100%",
  rootAriaLabel,
  translations,
  xAxisConfig = {},
  yAxisConfig = {},
  layout = "vertical",
  threshold = 90,
}) => {
  const emptyLabel = translations["no-results"];
  const xAxisLegend = translations[xAxisConfig.legend!] ?? xAxisConfig?.legend;

  const yAxisLegend = translations[yAxisConfig.legend!] ?? yAxisConfig?.legend;

  const xFormat = xAxisConfig.format;

  const xAxisComputedConfig = useMemo<AxisProps<BarDatum>>(
    () => ({
      ...defaultBarChartAxisBottomConfig,
      legend: xAxisLegend,
      legendPosition: "middle",
      legendOffset: 32,
      format: xFormat,
      tickValues: xAxisConfig.tickValues as unknown as BarDatum[],
    }),
    [xAxisLegend, xFormat, xAxisConfig.tickValues],
  );

  const yAxisComputedConfig = useMemo<AxisProps<BarDatum>>(
    () => ({
      ...defaultBarChartAxisLeftConfig,
      legend: yAxisLegend,
      legendPosition: "middle",
      legendOffset: -60,
      format: (value: any) => `${value}%`,
      tickValues: yAxisConfig.tickValues as unknown as BarDatum[],
    }),
    [yAxisLegend, yAxisConfig.tickValues],
  );

  // Get domain from config if provided
  const minValue = yAxisConfig?.domain?.[0];
  const maxValue = yAxisConfig?.domain?.[1];

  return (
    <Widget title={title}>
      <BarChart
        data={data}
        height={height}
        width={width}
        emptyLabel={emptyLabel}
        emptyAriaLabel={emptyLabel}
        rootAriaLabel={rootAriaLabel}
        keys={keys}
        indexBy={indexBy}
        groupMode={groupMode}
        colors={({ data: barData }) => {
          const value = barData.stabilityRate as number;

          if (value >= threshold) {
            return "var(--bg-support-castor)";
          }

          return "var(--bg-support-capella)";
        }}
        tooltip={() => null}
        markers={[
          {
            axis: "y",
            value: threshold,
            lineStyle: { stroke: "var(--on-text-primary)", strokeWidth: 2 },
            legend: `${threshold}%`,
            legendOrientation: "horizontal",
          },
        ]}
        axisBottom={xAxisConfig?.enabled === false ? undefined : xAxisComputedConfig}
        axisLeft={yAxisConfig?.enabled === false ? undefined : yAxisComputedConfig}
        layout={layout}
        minValue={minValue}
        maxValue={maxValue}
        valueFormat={(value: number) => `${value}%`}
      />
    </Widget>
  );
};

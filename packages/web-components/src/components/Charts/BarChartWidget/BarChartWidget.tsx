import { ChartMode } from "@allurereport/charts-api";
import type { AxisProps } from "@nivo/axes";
import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { Widget } from "../../Widget/index.js";
import {
  defaultBarChartAxisBottomConfig,
  defaultBarChartAxisLeftConfig,
  defaultBarChartLegendsConfig,
} from "../BarChart/config.js";
import { BarChart } from "../BarChart/index.js";
import type { BarChartWidgetProps } from "./types.js";

export const BarChartWidget: FunctionalComponent<BarChartWidgetProps> = ({
  title,
  mode,
  data,
  keys,
  indexBy,
  groupMode = "grouped",
  height = 400,
  width = "100%",
  rootAriaLabel,
  colors,
  translations,
  xAxisConfig = {},
  yAxisConfig = {},
}) => {
  const emptyLabel = translations["no-results"];
  const xAxisLegend =
    translations[xAxisConfig.legend!] ??
    xAxisConfig?.legend ??
    (groupMode === "stacked" ? "Data Points" : "Test Severity");

  const yAxisLegend =
    translations[yAxisConfig.legend!] ??
    yAxisConfig?.legend ??
    (mode === ChartMode.Percent ? "Percentage of Tests" : "Number of Tests");

  const yFormat = yAxisConfig.format ?? (mode === ChartMode.Percent ? " >-.2%" : " >-.2f");
  const xFormat = xAxisConfig.format ?? undefined;

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
      format: yFormat,
      tickValues: yAxisConfig.tickValues as unknown as BarDatum[],
    }),
    [yFormat, yAxisLegend, yAxisConfig.tickValues],
  );

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
        colors={({ id }) => colors[id]}
        axisBottom={xAxisConfig?.enabled === false ? undefined : xAxisComputedConfig}
        axisLeft={yAxisConfig?.enabled === false ? undefined : yAxisComputedConfig}
        legends={[defaultBarChartLegendsConfig]}
      />
    </Widget>
  );
};

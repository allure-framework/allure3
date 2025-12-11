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
} from "../LegacyBarChart/config.js";
import { LegacyBarChart } from "../LegacyBarChart/index.js";
import type { BarChartWidgetProps } from "./types.js";

/**
 * @deprecated Use BarChart instead
 */
export const LegacyBarChartWidget: FunctionalComponent<BarChartWidgetProps> = ({
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
  layout = "vertical",
}) => {
  const emptyLabel = translations["no-results"];
  const xAxisLegend =
    translations[xAxisConfig.legend!] ??
    xAxisConfig?.legend ??
    (groupMode === "stacked" ? "Data Points" : "Test Severity");

  let yAxisLegend = translations[yAxisConfig.legend!] ?? yAxisConfig?.legend;

  if (!yAxisLegend) {
    if (mode === ChartMode.Percent) {
      yAxisLegend = "Percentage of Tests";
    }
    if (mode === ChartMode.Raw) {
      yAxisLegend = "Number of Tests";
    }
  }

  const yFormat = yAxisConfig.format ?? (mode === ChartMode.Percent ? " >-.2%" : " >-.2f");
  const xFormat = xAxisConfig.format ?? undefined;

  const xAxisComputedConfig = useMemo<AxisProps<BarDatum>>(
    () => ({
      ...defaultBarChartAxisBottomConfig,
      legend: xAxisLegend,
      legendPosition: "middle",
      legendOffset: 32,
      format:
        mode === ChartMode.Diverging
          ? (value: any) => `${Math.abs(value)}%`
          : xFormat === "preserve"
            ? undefined
            : xFormat,
      tickValues: xAxisConfig.tickValues as unknown as BarDatum[],
    }),
    [xAxisLegend, xFormat, xAxisConfig.tickValues, mode],
  );

  const yAxisComputedConfig = useMemo<AxisProps<BarDatum>>(
    () => ({
      ...defaultBarChartAxisLeftConfig,
      legend: yAxisLegend,
      legendPosition: "middle",
      legendOffset: -60,
      format: yFormat === "preserve" ? undefined : yFormat,
      tickValues: yAxisConfig.tickValues as unknown as BarDatum[],
    }),
    [yFormat, yAxisLegend, yAxisConfig.tickValues],
  );

  // Get domain from config if provided
  const minValue = yAxisConfig?.domain?.[0];
  const maxValue = yAxisConfig?.domain?.[1];

  return (
    <Widget title={title}>
      <LegacyBarChart
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
        layout={layout}
        // @ts-ignore
        minValue={minValue}
        maxValue={maxValue}
        valueFormat={mode === ChartMode.Diverging ? (value: number) => `${Math.abs(value)}` : undefined}
      />
    </Widget>
  );
};

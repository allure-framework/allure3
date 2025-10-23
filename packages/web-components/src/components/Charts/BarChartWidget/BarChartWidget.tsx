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
}) => {
  const emptyLabel = translations["no-results"];

  const yFormat = useMemo(() => (mode === ChartMode.Percent ? " >-.2%" : " >-.2f"), [mode]);

  const bottomAxisConfig = useMemo<AxisProps<BarDatum>>(
    () => ({
      ...defaultBarChartAxisBottomConfig,
      legend: groupMode === "stacked" ? "Data Points" : "Test Severity",
      legendPosition: "middle",
      legendOffset: 32,
    }),
    [groupMode],
  );

  const leftAxisConfig = useMemo<AxisProps<BarDatum>>(
    () => ({
      ...defaultBarChartAxisLeftConfig,
      legend: mode === ChartMode.Percent ? "Percentage of Tests" : "Number of Tests",
      legendPosition: "middle",
      legendOffset: -60,
      format: yFormat,
    }),
    [mode, yFormat],
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
        axisBottom={bottomAxisConfig}
        axisLeft={leftAxisConfig}
        legends={[defaultBarChartLegendsConfig]}
      />
    </Widget>
  );
};

import { TestStatusTransition, statusesList } from "@allurereport/core-api";
import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart.js";
import { formatNumber } from "../Legend/LegendItem/index.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import type { Props } from "./types.js";

const getColorFromTransition = (transition: TestStatusTransition): string => {
  switch (transition) {
    case "new":
      return "var(--on-support-sirius)";
    case "fixed":
      return "var(--on-support-castor)";
    case "regressed":
      return "var(--on-support-capella)";
    case "malfunctioned":
      return "var(--on-support-atlas)";
  }
};

const transitionsList = ["fixed", "regressed", "malfunctioned"] as const;

export const StatusTransitionsChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, i18n, lines = ["regressed", "malfunctioned"], hideEmptyLines = true } = props;

  const currentData = data.find((item) => item.id === "current");
  const legend: LegendItemValue<BarDatum>[] = transitionsList.map((transition) => ({
    id: transition,
    label: i18n(`transitions.${transition}`),
    color: getColorFromTransition(transition),
    value: transition === "fixed" ? 1 : -1,
  }));

  const chartData = data.map((item) => ({
    id: item.id,
    timestamp: item.timestamp,
    prevItemTimestamp: item.prevItemTimestamp,
    fixed: item.fixed,
    // Inverted values for regressed and malfunctioned to make them appear
    // on the bottom side of the chart
    regressed: item.regressed === 0 ? 0 : -item.regressed,
    malfunctioned: item.malfunctioned === 0 ? 0 : -item.malfunctioned,
  }));

  const isChartEmpty = chartData.every((item) => item.fixed === 0 && item.regressed === 0 && item.malfunctioned === 0);
  const noChartHistory = chartData
    .filter((item) => item.id !== "current")
    .every((item) => item.fixed === 0 && item.regressed === 0 && item.malfunctioned === 0);

  // No data at all
  if (!currentData || isChartEmpty) {
    return (
      <Widget title={title}>
        <EmptyView title={i18n("no-results")} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  // We have data only for current run, but no history
  if ((data.length === 1 && currentData) || noChartHistory) {
    return (
      <Widget title={title}>
        <EmptyView title={i18n("no-history")} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  const maxStackedValue = Math.max(
    ...chartData.map((item) => {
      const negativeSumm = Math.abs(item.malfunctioned) + Math.abs(item.regressed);

      // On one side is fixed, on the other is regressed and malfunctioned
      // So we need to take the maximum of the two
      if (negativeSumm > item.fixed) {
        return negativeSumm;
      }

      return item.fixed;
    }),
  );

  // 10% "headroom" above the actual maximum
  const domainValue = Math.ceil(maxStackedValue * 1.1);

  return (
    <Widget title={title}>
      <BarChart
        lineKeys={lines}
        hideEmptyTrendLines={hideEmptyLines}
        groupMode="stacked"
        data={chartData}
        legend={legend}
        indexBy="id"
        hasValueFn={() => true}
        formatIndexBy={(arg) => {
          if (arg.id === "current") {
            return i18n("tooltips.current");
          }

          return i18n("tooltips.history", { timestamp: arg?.timestamp });
        }}
        formatBottomTick={(id) => {
          if (id === "current") {
            return i18n("ticks.current");
          }

          const item = chartData.find((item) => item.id === id);

          if (!item) {
            return "";
          }

          return i18n("ticks.history", { timestamp: item?.timestamp });
        }}
        bottomTickRotation={45}
        formatLegendValue={({ value }) => {
          if (!value) {
            return "-";
          }

          return formatNumber(Math.abs(Number(value)));
        }}
        noLegend
        formatLeftTick={(value) => formatNumber(Math.abs(Number(value)))}
        // Diverging chart requires minValue and maxValue to be set
        // Also minValue should be negative and maxValue should be positive
        minValue={-domainValue}
        maxValue={domainValue}
      />
    </Widget>
  );
};

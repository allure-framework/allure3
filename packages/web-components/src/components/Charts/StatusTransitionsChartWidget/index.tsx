import type { TestStatusTransition } from "@allurereport/core-api";
import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart.js";
import { formatNumber } from "../Legend/LegendItem/index.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import { getTrendForDivergingChart } from "../utils.js";
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
  const { title, data, i18n } = props;

  const maxValue = Math.ceil(Math.max(...data.map((item) => item.fixed + item.regressed + item.malfunctioned)) * 1.01);

  const chartData = data.map((item) => {
    const absTotal = maxValue * 2;
    const broken = item.regressed + item.malfunctioned;

    const trend = getTrendForDivergingChart({
      positiveValue: item.fixed,
      negativeValue: broken,
      absTotal,
      // This means that the was no transitions at all,
      // so we do not use it to calculate the trend line direction
      noValuePercentage: -1,
    });

    return {
      id: item.id,
      timestamp: item.timestamp,
      prevItemTimestamp: item.prevItemTimestamp,
      fixed: item.fixed,
      // Inverted values for regressed and malfunctioned to make them appear
      // on the bottom side of the chart
      regressed: item.regressed === 0 ? 0 : -item.regressed,
      malfunctioned: item.malfunctioned === 0 ? 0 : -item.malfunctioned,
      trend,
    };
  });

  const currentData = data.find((item) => item.id === "current");

  const legend: LegendItemValue<BarDatum>[] = useMemo(
    () => [
      ...transitionsList.map((transition) => ({
        id: transition,
        label: i18n(`transitions.${transition}`),
        color: getColorFromTransition(transition),
        value: transition === "fixed" ? 1 : -1,
      })),
      {
        id: "trend",
        label: i18n("legend.trend"),
        color: "var(--bg-support-betelgeuse-medium)",
        type: "point",
      },
    ],
    [i18n],
  );

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

  const domainValue = maxValue;

  return (
    <Widget title={title}>
      <BarChart
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

          const item = chartData.find((chartItem) => chartItem.id === id);

          if (!item) {
            return "";
          }

          return i18n("ticks.history", { timestamp: item?.timestamp });
        }}
        bottomTickRotation={45}
        formatTrendValue={(value) => {
          if (value === -1) {
            return undefined;
          }

          return value;
        }}
        formatLegendValue={({ value, id }) => {
          if (id === "trend") {
            return "";
          }

          if (!value) {
            return "-";
          }

          return formatNumber(Math.abs(Number(value)));
        }}
        noLegend
        formatLeftTick={(value) => {
          const numberedValue = Math.abs(Number(value));

          // Do not show half values on the left axis
          if (!Number.isInteger(numberedValue)) {
            return "";
          }

          return formatNumber(Math.abs(Number(value)));
        }}
        // Diverging chart requires minValue and maxValue to be set
        // Also minValue should be negative and maxValue should be positive
        minValue={-domainValue}
        maxValue={domainValue}
      />
    </Widget>
  );
};

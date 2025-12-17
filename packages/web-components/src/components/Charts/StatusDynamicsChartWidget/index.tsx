import type { Statistic } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart";
import { formatNumber } from "../Legend/LegendItem";
import type { LegendItemValue } from "../Legend/LegendItem/types";
import { getColorFromStatus } from "../utils";
import type { Props } from "./types";

export const StatusDynamicsChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, statuses = statusesList, i18n } = props;

  const currentData = data.find((item) => item.id === "current");
  const legend: LegendItemValue<BarDatum>[] = statuses.map((status) => ({
    id: status,
    label: i18n(`status.${status}`),
    color: getColorFromStatus(status),
  }));

  const chartData: ({
    id: string;
    name: string;
    timestamp: number;
  } & Statistic)[] = data.map((item) => ({
    id: item.id,
    name: item.name,
    timestamp: item.timestamp,
    ...item.statistic,
  }));

  const isChartEmpty = chartData.every((item) => item.total === 0);
  const noChartHistory = chartData.filter((item) => item.id !== "current").every((item) => item.total === 0);
  const maxTotalValue = chartData.reduce((max, item) => Math.max(max, item.total), 0);
  const headroomedMaxTotalValue = maxTotalValue * 1.01;

  // No data at all
  if (isChartEmpty || !currentData || currentData.statistic.total === 0) {
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

  return (
    <Widget title={title}>
      <BarChart
        groupMode="stacked"
        data={chartData}
        legend={legend}
        indexBy={"id"}
        hasValueFn={(arg) => arg.total > 0}
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
        formatLeftTick={(value) => {
          const numberedValue = Math.abs(Number(value));

          // Do not show half values on the left axis
          if (!Number.isInteger(numberedValue)) {
            return "";
          }

          return formatNumber(Math.abs(Number(value)));
        }}
        formatLegendValue={({ value }) => {
          if (!value) {
            return "-";
          }

          return formatNumber(value);
        }}
        noLegend
        maxValue={headroomedMaxTotalValue}
      />
    </Widget>
  );
};

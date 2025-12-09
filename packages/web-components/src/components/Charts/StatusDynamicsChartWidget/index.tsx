import { Statistic, formatDuration, statusesList } from "@allurereport/core-api";
import type { BarDatum } from "@nivo/bar";
import { Text } from "@nivo/text";
import type { FunctionalComponent } from "preact";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { formatNumber } from "../Legend/LegendItem";
import type { LegendItemValue } from "../Legend/LegendItem/types";
import { getColorFromStatus } from "../utils";
import { BarChart } from "./BarChart/BarChart";
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

  // No data at all
  if (!currentData || currentData.statistic.total === 0) {
    return (
      <Widget title={title}>
        <EmptyView title={i18n("no-results")} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  // We have data only for current run, but no history
  if (data.length === 1 && currentData) {
    return (
      <Widget title={title}>
        <EmptyView title={i18n("no-history")} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  return (
    <Widget title={title}>
      <BarChart
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

          return formatNumber(value);
        }}
        noLegend
      />
    </Widget>
  );
};

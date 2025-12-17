import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart.js";
import { formatNumber } from "../Legend/LegendItem/index.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import { getColorFromStatus } from "../utils.js";
import type { Props } from "./types.js";

export const TrSeveritiesChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, i18n, statuses } = props;

  const legend: LegendItemValue<BarDatum>[] = useMemo(
    () =>
      statuses.map((status) => {
        return {
          id: status,
          label: i18n(`status.${status}`),
          color: getColorFromStatus(status),
        };
      }),
    [statuses, i18n],
  );

  const chartData = data;

  const isChartEmpty = chartData.every((item) => statuses.every((status) => item[status] === 0));

  // No data at all
  if (isChartEmpty) {
    return (
      <Widget title={title}>
        <EmptyView title={i18n("no-results")} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  return (
    <Widget title={title}>
      <BarChart
        groupMode="stacked"
        data={chartData}
        legend={legend}
        indexBy="id"
        hasValueFn={() => true}
        formatIndexBy={(arg) => i18n(`severity.${arg.id}`)}
        formatBottomTick={(id) => i18n(`severity.${id}` as any)}
        formatLegendValue={({ value }) => {
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
      />
    </Widget>
  );
};

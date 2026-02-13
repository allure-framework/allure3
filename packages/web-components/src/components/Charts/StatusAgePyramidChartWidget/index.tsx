import type { BarDatum } from "@nivo/bar";
import { truncate } from "lodash";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart.js";
import { formatNumber } from "../Legend/LegendItem/index.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import { getColorFromStatus } from "../utils.js";
import type { FBSUStatus, Props } from "./types.js";

const isPositiveStatus = (status: FBSUStatus): status is Exclude<FBSUStatus, "failed" | "broken"> => {
  return status === "skipped" || status === "unknown";
};

const isNegativeStatus = (status: FBSUStatus): status is Exclude<FBSUStatus, "skipped" | "unknown"> => {
  return status === "failed" || status === "broken";
};

const getStatusStats = (data: Props["data"][number], statuses: FBSUStatus[]) => {
  return statuses.reduce(
    (acc, status) => {
      if (isPositiveStatus(status)) {
        acc[status] = data[status] ?? 0;
      }

      if (isNegativeStatus(status)) {
        acc[status] = -(data[status] ?? 0);
      }

      return acc;
    },
    {} as Record<FBSUStatus, number>,
  );
};

export const StatusAgePyramidChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, i18n, statuses } = props;

  const currentData = data.find((item) => item.id === "current");

  const legend: LegendItemValue<BarDatum>[] = useMemo(
    () =>
      statuses.map((status) => {
        return {
          id: status,
          label: i18n(`status.${status}`),
          color: getColorFromStatus(status),
          value: isPositiveStatus(status) ? 1 : -1,
        };
      }),
    [statuses, i18n],
  );

  const chartData = useMemo(
    () =>
      data.map((item) => {
        return {
          id: item.id,
          timestamp: item.timestamp,
          ...getStatusStats(item, statuses),
        };
      }),
    [data, statuses],
  );

  const isChartEmpty = chartData.every((item) => statuses.every((status) => item[status] === 0));
  const noChartHistory = chartData
    .filter((item) => item.id !== "current")
    .every((item) => statuses.every((status) => item[status] === 0));

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
      const negativeSumm = Math.abs(
        statuses.filter((status) => isNegativeStatus(status)).reduce((acc, value) => acc + (item[value] ?? 0), 0),
      );

      const positiveSumm = Math.abs(
        statuses.filter((status) => isPositiveStatus(status)).reduce((acc, value) => acc + (item[value] ?? 0), 0),
      );

      return Math.max(negativeSumm, positiveSumm);
    }),
  );

  // 1% "headroom" above the actual maximum
  const domainValue = Math.ceil(maxStackedValue * 1.01);

  return (
    <Widget title={title}>
      <BarChart
        groupMode="stacked"
        layout="horizontal"
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
            return truncate(i18n("ticks.current"), { length: 15 });
          }

          const item = chartData.find((chartItem) => chartItem.id === id);

          if (!item) {
            return "";
          }

          return truncate(i18n("ticks.history", { timestamp: item?.timestamp }), { length: 15 });
        }}
        bottomTickSize={10}
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
        // Diverging chart requires minValue and maxValue to be set
        // Also minValue should be negative and maxValue should be positive
        minValue={-domainValue}
        maxValue={domainValue}
      />
    </Widget>
  );
};

import type { TestStatus } from "@allurereport/core-api";
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
import type { Props, StatusWithPrefix } from "./types.js";

const isNewStatus = (status: StatusWithPrefix): boolean => {
  return status.startsWith("new:");
};

const isRemovedStatus = (status: StatusWithPrefix): boolean => {
  return status.startsWith("removed:");
};

const getStatusStats = (
  data: Props["data"][number],
  statuses: StatusWithPrefix[],
): Record<StatusWithPrefix, number> => {
  return statuses.reduce(
    (acc, status) => {
      if (isNewStatus(status)) {
        acc[status] = data[status] ?? 0;
      }

      if (isRemovedStatus(status)) {
        acc[status] = -(data[status] ?? 0);
      }

      return acc;
    },
    {} as Record<StatusWithPrefix, number>,
  );
};

export const TestBaseGrowthDynamicsChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, i18n, statuses } = props;

  const currentData = data.find((item) => item.id === "current");

  const statusesWithPrefixes = useMemo(() => {
    const result: StatusWithPrefix[] = [];

    for (const status of statuses) {
      result.push(`new:${status}`);
    }

    for (const status of statuses) {
      result.push(`removed:${status}`);
    }

    return result;
  }, [statuses]);

  const legend: LegendItemValue<BarDatum>[] = useMemo(
    () =>
      statusesWithPrefixes.map((status) => {
        const statusForI18n = status.replace(":", "");
        const statusWithoutPrefix = status.replace("new:", "").replace("removed:", "");

        return {
          id: status,
          label: i18n(`status.${statusForI18n}` as any),
          color: getColorFromStatus(statusWithoutPrefix as TestStatus),
          value: isNewStatus(status) ? 1 : -1,
        };
      }),
    [statusesWithPrefixes, i18n],
  );

  const chartData = useMemo(
    () =>
      data.map((item) => {
        return {
          id: item.id,
          timestamp: item.timestamp,
          ...getStatusStats(item, statusesWithPrefixes),
        };
      }),
    [data, statusesWithPrefixes],
  );

  const isChartEmpty = chartData.every((item) => statusesWithPrefixes.every((status) => item[status] === 0));
  const noChartHistory = chartData
    .filter((item) => item.id !== "current")
    .every((item) => statusesWithPrefixes.every((status) => item[status] === 0));

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
        statusesWithPrefixes
          .filter((status) => isRemovedStatus(status))
          .reduce((acc, value) => acc + (item[value] ?? 0), 0),
      );

      const positiveSumm = Math.abs(
        statusesWithPrefixes
          .filter((status) => isNewStatus(status))
          .reduce((acc, value) => acc + (item[value] ?? 0), 0),
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

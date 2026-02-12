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
import { getColorFromStatus, getTrendForDivergingChart } from "../utils.js";
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
    () => [
      ...statusesWithPrefixes.map((status) => {
        const statusForI18n = status.replace(":", "");
        const statusWithoutPrefix = status.replace("new:", "").replace("removed:", "");

        return {
          id: status,
          label: i18n(`status.${statusForI18n}` as any),
          color: getColorFromStatus(statusWithoutPrefix as TestStatus),
          value: isNewStatus(status) ? 1 : -1,
        };
      }),
      {
        id: "trend",
        label: i18n("legend.trend"),
        color: "var(--bg-support-betelgeuse-medium)",
        type: "point",
      },
    ],
    [statusesWithPrefixes, i18n],
  );

  const maxValue = Math.ceil(
    Math.max(
      ...data.map((item) => {
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

        return Math.max(positiveSumm, negativeSumm);
      }),
    ) * 1.01,
  );

  const chartData = useMemo(
    () =>
      data.map((item) => {
        const absTotal = maxValue * 2;
        const stats = getStatusStats(item, statusesWithPrefixes);
        const negativeSumm = Math.abs(
          statusesWithPrefixes
            .filter((status) => isRemovedStatus(status))
            .reduce((acc, value) => acc + (stats[value] ?? 0), 0),
        );

        const positiveSumm = Math.abs(
          statusesWithPrefixes
            .filter((status) => isNewStatus(status))
            .reduce((acc, value) => acc + (stats[value] ?? 0), 0),
        );

        const trend = getTrendForDivergingChart({
          positiveValue: positiveSumm,
          negativeValue: negativeSumm,
          absTotal,
          // This means that the was no new nor removed tests at all,
          // so we do not use it to calculate the trend line direction
          noValuePercentage: -1,
        });

        return {
          id: item.id,
          timestamp: item.timestamp,
          ...stats,
          trend,
        };
      }),
    [data, statusesWithPrefixes, maxValue],
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
        minValue={-maxValue}
        maxValue={maxValue}
        formatTrendValue={(value) => {
          if (value === -1) {
            // Do not use this value to calculate the trend line direction
            return undefined;
          }

          return value;
        }}
      />
    </Widget>
  );
};

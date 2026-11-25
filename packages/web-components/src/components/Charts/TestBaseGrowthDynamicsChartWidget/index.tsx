import type { TestStatus } from "@allurereport/core-api";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";

import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { TreeItemIcon } from "@/components/Tree/TreeItemIcon";
import { Text } from "@/components/Typography";
import { Widget } from "@/components/Widget";

import { BarChart } from "../BarChart/BarChart.js";
import { formatNumber } from "../Legend/LegendItem/index.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import { getColorFromStatus, withCumulativeTrend } from "../utils.js";
import type { Props, StatusWithPrefix } from "./types.js";

import styles from "./styles.scss";

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

  const legend = useMemo<
    LegendItemValue<
      { id: string; timestamp: number; diffTrend: number; cumulativeTrend: number } & Record<StatusWithPrefix, number>
    >[]
  >(
    () => [
      ...statusesWithPrefixes.map((status) => {
        const statusForI18n = status.replace(":", "");
        const statusWithoutPrefix = status.replace("new:", "").replace("removed:", "");

        return {
          id: status,
          label: i18n(`status.${statusForI18n}` as any),
          color: getColorFromStatus(statusWithoutPrefix as TestStatus, "chartFill"),
          value: isNewStatus(status) ? 1 : -1,
        };
      }),
      {
        id: "cumulativeTrend",
        label: i18n("legend.cumulativeTrend"),
        color: "var(--color-chart-categorical-9)",
        type: "point",
        lineStyle: "solid",
      },
      {
        id: "diffTrend",
        label: i18n("legend.diffTrend"),
        color: "var(--color-chart-categorical-10)",
        type: "point",
        lineStyle: "dashed",
      },
    ],
    [statusesWithPrefixes, i18n],
  );

  const { chartData, maxValue } = useMemo(() => {
    let maxBarValue = 0;
    const chartData = withCumulativeTrend(
      data.map((item) => {
        const stats = getStatusStats(item, statusesWithPrefixes);
        const added = statusesWithPrefixes.filter(isNewStatus).reduce((sum, status) => sum + stats[status], 0);
        const removed = statusesWithPrefixes.filter(isRemovedStatus).reduce((sum, status) => sum - stats[status], 0);

        maxBarValue = Math.max(maxBarValue, added, removed);

        return { id: item.id, timestamp: item.timestamp, ...stats, diffTrend: added - removed };
      }),
    );

    return { chartData, maxValue: Math.ceil(maxBarValue * 1.01) };
  }, [data, statusesWithPrefixes]);

  const isChartEmpty = chartData.every((item) => statusesWithPrefixes.every((status) => item[status] === 0));
  // No data at all
  if (!currentData || isChartEmpty) {
    return (
      <Widget title={title}>
        <EmptyView title={i18n("no-results")} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  // We have data only for current run, but no history
  if (data.length < 2) {
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
            return i18n("tooltips.current", { timestamp: arg.timestamp });
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
        renderTooltipContent={(item) => {
          const groups = (["new", "removed"] as const)
            .map((kind) => ({
              kind,
              counters: statuses
                .map((status) => ({ status, count: Math.abs(item[`${kind}:${status}`]) }))
                .filter(({ count }) => count > 0),
            }))
            .filter(({ counters }) => counters.length > 0);

          return (
            <>
              {groups.map(({ kind, counters }) => (
                <div key={kind} className={styles.row}>
                  <Text type="ui" size="s" bold>
                    {i18n(kind === "new" ? "tooltips.newTests" : "tooltips.removedTests")}
                  </Text>
                  <div className={styles.counters}>
                    {counters.map(({ status, count }) => {
                      const value = i18n("tooltips.number", { value: count });
                      return (
                        <div
                          key={status}
                          className={styles.counter}
                          style={{
                            backgroundColor: `var(--color-status-${status}-bg)`,
                            color: `var(--color-status-${status}-on-bg)`,
                          }}
                        >
                          <span className={styles.statusText}>
                            {i18n("tooltips.statusCount", { status: i18n(`statuses:${status}`), count: value })}
                          </span>
                          <TreeItemIcon status={status} className={styles.icon} />
                          <b aria-hidden="true">{value}</b>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <Text className={styles.empty} type="ui" size="s">
                  {i18n("tooltips.noChanges")}
                </Text>
              )}
            </>
          );
        }}
        noLegend
        valueTrends={{ rate: "growthRate", t: i18n }}
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
      />
    </Widget>
  );
};

import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import type { Props } from "./types.js";

const isDataItemEmpty = (item: { duration: number; sequentialDuration: number }) => {
  return item.duration === 0 && item.sequentialDuration === 0;
};
export const DurationDynamicsChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, i18n } = props;

  const chartData = data;

  const legend: LegendItemValue<BarDatum>[] = useMemo(() => {
    return [
      {
        id: "sequentialDuration",
        label: i18n("durations.sequential"),
        color: "var(--bg-support-rigel)",
        type: "default",
      },
      {
        id: "duration",
        label: i18n("durations.duration"),
        color: "var(--bg-support-betelgeuse)",
        type: "default",
      },
      {
        id: "speedup",
        label: i18n("durations.speedup"),
        color: "var(--bg-support-betelgeuse-medium)",
        type: "point",
      },
    ];
  }, [i18n]);

  const currentData = data.find((item) => item.id === "current");
  const isChartEmpty = chartData.every((item) => isDataItemEmpty(item));

  // No data at all
  if (isChartEmpty || !currentData || isDataItemEmpty(currentData)) {
    return (
      <Widget title={title}>
        <EmptyView title={i18n("no-results")} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  return (
    <Widget title={title}>
      <BarChart
        groupMode="grouped"
        data={chartData}
        legend={legend}
        indexBy={"id"}
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
        formatLeftTick={(value) => i18n("legend.duration", { duration: value })}
        formatLegendValue={({ id, value }) => {
          if (id === "duration" || id === "sequentialDuration") {
            return i18n("legend.duration", { duration: value });
          }

          if (id === "speedup") {
            return i18n("legend.speedup", { speedup: value });
          }
        }}
        formatTrendValue={(value, trendKey) => {
          if (trendKey === "speedup") {
            if (value <= 1) {
              return 0;
            }

            return (1 - 1 / value) * 100;
          }

          return value;
        }}
        noLegend
      />
    </Widget>
  );
};

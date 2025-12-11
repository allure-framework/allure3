import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart.js";
import { formatNumber } from "../Legend/LegendItem/index.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import type { Props } from "./types.js";

const COLORS = [
  "var(--bg-support-sirius)",
  "var(--bg-support-aldebaran)",
  "var(--bg-support-betelgeuse)",
  "var(--bg-support-sirius-medium)",
  "var(--bg-support-aldebaran-medium)",
  "var(--bg-support-betelgeuse-medium)",
  "var(--bg-support-sirius-heavy)",
  "var(--bg-support-aldebaran-heavy)",
  "var(--bg-support-betelgeuse-heavy)",
  "var(--bg-support-mirach)",
  "var(--bg-support-rigel)",
  "var(--bg-support-gliese)",
  "var(--bg-support-mirach-medium)",
  "var(--bg-support-rigel-medium)",
  "var(--bg-support-gliese-medium)",
  "var(--bg-support-mirach-heavy)",
  "var(--bg-support-gliese-heavy)",
  "var(--bg-support-rigel-heavy)",
  "var(--bg-support-rau)",
  "var(--bg-support-rau-medium)",
  "var(--bg-support-rau-heavy)",
];

const getColorsForKeys = (keys: string[]): Record<string, string> => {
  return keys.reduce(
    (acc, key, index) => {
      let color = COLORS[index];

      if (!color) {
        // If we don't have a color for the key,
        // start from the top of the colors array
        // I hope this will rarely happen
        color = COLORS[index - COLORS.length];
      }

      acc[key] = color;
      return acc;
    },
    {} as Record<string, string>,
  );
};

export const DurationsChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, i18n, groupBy, keys } = props;

  const colors = useMemo(() => getColorsForKeys(Object.keys(keys)), [keys]);
  const totalLabel = i18n("legend.total");

  const legend: LegendItemValue<BarDatum>[] = useMemo(
    () =>
      Object.entries(keys).map(([id, label]) => ({
        id,
        label: groupBy === "none" ? totalLabel : label,
        color: colors[id],
      })),
    [keys, colors, groupBy, totalLabel],
  );

  const chartData = useMemo(
    () =>
      data.map((item) => ({
        // create a unique id for the item
        id: `${item.from}-${item.to}`,
        ...item,
      })),
    [data],
  );

  const maxValue = useMemo(() => {
    if (chartData.length === 0) {
      return 0;
    }

    const keyIds = Object.keys(keys);
    return Math.max(
      ...chartData.map((item) => {
        let summ = 0;

        for (const key of keyIds) {
          summ += (item as unknown as Record<string, number>)[key] ?? 0;
        }

        return summ;
      }),
    );
  }, [chartData, keys]);

  const headroomedMaxValue = maxValue * 1.1;

  const isChartEmpty = chartData.length === 0;

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
        hasValueFn={(item) =>
          Object.keys(keys).some((key) => {
            const value = (item as any)[key] as number;
            return value > 0;
          })
        }
        formatIndexBy={(arg) => i18n("tooltips.durationRange", { from: arg.from ?? 0, to: arg.to })}
        formatBottomTick={(_, item) => i18n("ticks.durationRange", { from: item.from ?? 0, to: item.to })}
        bottomTickSize={chartData.length > 4 ? 10 : 12}
        formatLegendValue={({ value }) => {
          // Don't show zero values in legend
          if (!value || Number(value) === 0) {
            return undefined;
          }

          return i18n("legend.value", { value });
        }}
        noLegend
        formatLeftTick={(value) => formatNumber(Math.abs(Number(value)))}
        maxValue={headroomedMaxValue}
      />
    </Widget>
  );
};

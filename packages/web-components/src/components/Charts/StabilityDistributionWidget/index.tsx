import type { BarDatum } from "@nivo/bar";
import { take, truncate } from "lodash";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";
import { BarChart } from "../BarChart/BarChart.js";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import { CHART_THEME } from "../config.js";
import type { Props } from "./types.js";

const MAX_STABILITY_RATE = 100;
const MAX_DATA_LENGTH = 15;

const restrictThreshold = (threshold: number) => {
  if (threshold >= 100) {
    return 100;
  }

  if (threshold <= 0) {
    return 0;
  }

  return threshold;
};

const isAboveThreshold = (stabilityRate: number, threshold: number) => {
  return stabilityRate >= threshold;
};

const getThresholdPoisition = (threshold: number) => {
  if (threshold >= 91) {
    return "bottom-right";
  }

  return "top-right";
};

export const StabilityDistributionWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, i18n, keys, threshold = 90 } = props;

  const chartData = useMemo(
    () =>
      take(data, MAX_DATA_LENGTH).map(({ id, stabilityRate }) => ({
        id,
        stabilityRate,
        [id]: stabilityRate,
      })),
    [data],
  );

  const stabilityRateLabel = i18n("legend.stabilityRate");

  const restrictedThreshold = restrictThreshold(threshold);

  const legend: LegendItemValue<BarDatum>[] = useMemo(() => {
    return chartData.map(({ id, stabilityRate }) => ({
      id,
      label: stabilityRateLabel,
      color: isAboveThreshold(stabilityRate, restrictedThreshold)
        ? "var(--bg-support-castor-heavy)"
        : "var(--bg-support-capella-heavy)",
      value: stabilityRate,
      [id]: stabilityRate,
    }));
  }, [chartData, stabilityRateLabel, restrictedThreshold]);

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
        markers={[
          {
            axis: "y",
            value: threshold,
            legend: `${threshold}%`,
            textStyle: {
              fill: CHART_THEME.markers?.text?.fill,
              fontSize: CHART_THEME.markers?.text?.fontSize,
              fontWeight: CHART_THEME.markers?.text?.fontWeight,
            },
            lineStyle: {
              stroke: CHART_THEME.markers?.lineColor,
              strokeWidth: CHART_THEME.markers?.lineStrokeWidth,
            },
            legendPosition: getThresholdPoisition(restrictedThreshold),
            // @ts-expect-error - legendOffsetY and legendOffsetX are not typed
            legendOffsetY: 10,
            legendOffsetX: 7,
          },
        ]}
        groupMode="stacked"
        data={chartData}
        legend={legend}
        indexBy="id"
        hasValueFn={() => true}
        formatIndexBy={(arg) => keys[arg.id]}
        formatBottomTick={(_, item) => truncate(keys[item.id], { length: 15 })}
        bottomTickSize={chartData.length > 4 ? 10 : 12}
        formatLegendValue={({ value }) => {
          if (value === undefined) {
            return undefined;
          }

          return `${value}%`;
        }}
        noLegend
        formatLeftTick={(value) => `${value}%`}
        maxValue={MAX_STABILITY_RATE}
        bottomTickRotation={45}
      />
    </Widget>
  );
};

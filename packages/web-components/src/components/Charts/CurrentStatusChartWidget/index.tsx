import type { Statistic } from "@allurereport/core-api";
import type { Margin } from "@nivo/core";
import type { PieCustomLayerProps, PieTooltipProps } from "@nivo/pie";
import { Pie } from "@nivo/pie";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { Widget } from "@/components/Widget";
import { DimensionsProvider } from "../../DimensionsProvider";
import { ChartTooltip } from "../ChartTooltip";
import { LegendItem } from "../Legend/LegendItem";
import { CHART_MOTION_CONFIG, CHART_THEME, REDUCE_MOTION } from "../config";
import { AdditionalStats } from "./AdditionalStats";
import { ADD_STATS_KEYS, EMPTY_ARC, GAP, MAX_ADDITIONAL_STATS_WIDTH, MAX_PIE_WIDTH, PIE_PADDING } from "./constants";
import { CenteredMetric } from "./parts";
import styles from "./styles.scss";
import type { ChartDatum, Props } from "./types";
import { toChartData } from "./utils";

const noop = (key: string) => key;

const getSize = (width: number) => {
  if (width >= MAX_PIE_WIDTH) {
    return MAX_PIE_WIDTH - PIE_PADDING * 2;
  }

  return width - PIE_PADDING * 2;
};

const statsHasAdditionalStats = (stats: Statistic) => {
  return ADD_STATS_KEYS.some((key) => key in stats);
};

const MARGIN: Partial<Margin> = { top: PIE_PADDING, right: PIE_PADDING, bottom: PIE_PADDING, left: PIE_PADDING };
// Use colors from value
const colors = { datum: "data.color" } as const;
const borderColor = { theme: "background" } as const;

export const CurrentStatusChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, statuses, metric = "passed", i18n = noop } = props;
  const chartData = useMemo(() => toChartData({ data, i18n, statuses }), [data, i18n, statuses]);
  const totalCount = data.total;

  const isEmpty = totalCount === 0;
  const hasAdditionalStats = statsHasAdditionalStats(data);
  const shiftWidth = hasAdditionalStats ? MAX_PIE_WIDTH + GAP + MAX_ADDITIONAL_STATS_WIDTH : MAX_PIE_WIDTH;

  return (
    <Widget title={title ?? ""} centerContent>
      <DimensionsProvider>
        {(width) => (
          <div className={styles.wrapper} data-layout={width > shiftWidth ? "vertical" : "horizontal"}>
            <div className={styles.pie}>
              <Pie
                width={getSize(hasAdditionalStats ? width - (MAX_ADDITIONAL_STATS_WIDTH + GAP) : width)}
                height={getSize(hasAdditionalStats ? width - (MAX_ADDITIONAL_STATS_WIDTH + GAP) : width)}
                data={isEmpty ? [EMPTY_ARC] : chartData}
                margin={MARGIN}
                colors={colors}
                innerRadius={0.75}
                padAngle={1}
                cornerRadius={4}
                activeOuterRadiusOffset={4}
                borderWidth={0}
                borderColor={borderColor}
                enableArcLabels={false}
                enableArcLinkLabels={false}
                isInteractive={!isEmpty}
                sortByValue
                transitionMode="startAngle"
                layers={[
                  "arcs",
                  (layerProps: PieCustomLayerProps<ChartDatum>) => (
                    <CenteredMetric
                      layerProps={layerProps}
                      i18n={i18n}
                      metricType="percent"
                      metric={metric}
                      isEmpty={isEmpty}
                      total={totalCount}
                    />
                  ),
                ]}
                animate={!REDUCE_MOTION}
                motionConfig={CHART_MOTION_CONFIG}
                tooltip={PieTooltip}
                theme={CHART_THEME}
              />
            </div>
            {hasAdditionalStats && (
              <AdditionalStats stats={data} i18n={i18n} layout={width > shiftWidth ? "vertical" : "horizontal"} />
            )}
          </div>
        )}
      </DimensionsProvider>
    </Widget>
  );
};

const PieTooltip: FunctionalComponent<PieTooltipProps<ChartDatum>> = (props) => {
  const { datum } = props;

  const legend = useMemo(
    () => ({
      id: datum.id.toString(),
      color: datum.color,
      label: datum.label,
      value: datum.value,
    }),
    [datum],
  );

  return (
    <ChartTooltip>
      <LegendItem mode="default" legend={legend} />
    </ChartTooltip>
  );
};

import type { RunTrendPoint } from "@allurereport/charts-api";
import { ResponsiveLine, type SliceTooltipProps } from "@nivo/line";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";

import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";
import { Widget } from "@/components/Widget";

import { ChartTooltip } from "../ChartTooltip";
import { CHART_THEME } from "../config";
import { LegendItem } from "../Legend/LegendItem";

import styles from "./styles.scss";

export type RunTrendSerie = {
  id: string;
  label: string;
  color: string;
  /**
   * One value for each point, in the order of the points
   */
  values: number[];
};

type RunTrendLineSeries = {
  id: string;
  color: string;
  data: { x: string; y: number }[];
};

export type RunTrendChartWidgetProps = {
  title: string;
  points: RunTrendPoint[];
  series: RunTrendSerie[];
  /**
   * Shown when there are less than two runs to compare, as Allure 2 does
   */
  emptyLabel: string;
  formatPoint: (point: RunTrendPoint) => string;
  formatTick: (point: RunTrendPoint) => string;
  formatValue?: (value: number) => string;
  /**
   * Shows only whole numbers on the value axis, for counts
   */
  integer?: boolean;
};

const MAX_TICKS = 5;

/**
 * Whole number ticks from zero up to the largest stacked value
 */
const getIntegerTicks = (series: RunTrendSerie[], pointsCount: number) => {
  let max = 0;

  for (let index = 0; index < pointsCount; index++) {
    max = Math.max(
      max,
      series.reduce((acc, { values }) => acc + (values[index] ?? 0), 0),
    );
  }

  const step = Math.max(1, Math.ceil(max / MAX_TICKS));

  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => index * step);
};

/**
 * Allure 2 like trend over report runs: stacked areas of the series, the oldest run first
 */
export const RunTrendChartWidget: FunctionalComponent<RunTrendChartWidgetProps> = (props) => {
  const {
    title,
    points,
    series,
    emptyLabel,
    formatPoint,
    formatTick,
    formatValue = (value) => `${value}`,
    integer = false,
  } = props;

  const data = useMemo<RunTrendLineSeries[]>(
    () =>
      series.map(({ id, color, values }) => ({
        id,
        color,
        data: points.map((point, index) => ({ x: point.id, y: values[index] ?? 0 })),
      })),
    [points, series],
  );
  const pointById = useMemo(() => new Map(points.map((point) => [point.id, point])), [points]);
  const integerTicks = useMemo(
    () => (integer ? getIntegerTicks(series, points.length) : undefined),
    [integer, series, points.length],
  );

  if (points.length < 2 || series.length === 0) {
    return (
      <Widget title={title}>
        <EmptyView title={emptyLabel} icon={allureIcons.lineChartsBarChartSquare} />
      </Widget>
    );
  }

  return (
    <Widget title={title}>
      <div className={styles.container} data-testid="run-trend-chart">
        <ResponsiveLine
          data={data}
          theme={CHART_THEME}
          margin={{ top: 10, right: 20, bottom: 60, left: 70 }}
          xScale={{ type: "point" }}
          yScale={{
            type: "linear",
            min: 0,
            max: integerTicks ? integerTicks[integerTicks.length - 1] : "auto",
            stacked: true,
            nice: !integerTicks,
          }}
          colors={(serie: { color: string }) => serie.color}
          enableArea
          areaOpacity={0.85}
          lineWidth={0}
          enablePoints={false}
          enableGridX={false}
          enableSlices="x"
          gridYValues={integerTicks ?? MAX_TICKS}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            tickValues: integerTicks ?? MAX_TICKS,
            format: (value: number) => formatValue(value),
          }}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: -45,
            format: (id: string) => {
              const point = pointById.get(id);

              return point ? formatTick(point) : "";
            },
          }}
          sliceTooltip={({ slice }: SliceTooltipProps<RunTrendLineSeries>) => {
            const point = pointById.get(String(slice.points[0]?.data.x));

            return (
              <ChartTooltip label={point ? formatPoint(point) : undefined}>
                {slice.points.map((slicePoint) => {
                  const serie = series.find(({ id }) => id === slicePoint.seriesId);

                  return serie ? (
                    <LegendItem
                      key={serie.id}
                      mode="menu"
                      hideOnEmptyValue={false}
                      legend={{
                        id: serie.id,
                        label: serie.label,
                        color: serie.color,
                        value: formatValue(Number(slicePoint.data.y)),
                      }}
                    />
                  ) : null;
                })}
              </ChartTooltip>
            );
          }}
          animate={false}
        />
      </div>
    </Widget>
  );
};

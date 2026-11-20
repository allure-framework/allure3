import { Axes, type AxisProps, type AxisTickProps } from "@nivo/axes";
import { type BarCustomLayerProps, type BarDatum, type ComputedDatum, ResponsiveBar } from "@nivo/bar";
import type { CartesianMarkerProps } from "@nivo/core";
import type { ComponentChildren } from "preact";
import { useMemo } from "preact/hooks";

import { CHART_MOTION_CONFIG, CHART_THEME, REDUCE_MOTION } from "../config";
import { Legends } from "../Legend";
import { formatNumber } from "../Legend/LegendItem";
import type { LegendItemValue } from "../Legend/LegendItem/types";
import { BarChartTooltip } from "./BarChartTooltip";
import { BottomAxisLine } from "./BottomAxisLine";
import { BarChartStateProvider } from "./context";
import { BarChartBars, BarChartItemHoverLayer } from "./Layers";
import { fitValueTrend, TrendLinesLayer } from "./TrendLinesLayer";
import { computeVerticalAxisMargin, isEmptyChart } from "./utils";

import styles from "./styles.scss";

type BarChartProps<T extends BarDatum> = {
  data: T[];
  legend: LegendItemValue<T>[];
  indexBy: Extract<keyof T, string>;
  lines?: {
    /**
     * Corresponding key of the line in the legend
     */
    key: Extract<keyof T, string>;
    curveSharpness?: number;
  }[];
  hideEmptyTrendLines?: boolean;
  valueTrends?: { helpLabel: string; helpDescription: string };
  formatTrendValue?: (value: number, trendKey: Extract<keyof T, string>) => number | undefined;
  formatLegendValue?: (legend: LegendItemValue<T>) => string | number | undefined;
  renderTooltipContent?: (value: T) => ComponentChildren;
  formatIndexBy?: (value: T, indexBy: Extract<keyof T, string>) => string;
  renderBottomTick?: (props: AxisTickProps<number | string>) => any;
  bottomTickSize?: number;
  onBarClick?: (value: { data: T }) => void;
  padding?: number;
  hasValueFn?: (data: T) => boolean;
  currentLocale?: string;
  formatBottomTick?: (value: number | string, item: T) => string | number;
  formatLeftTick?: (value: number | string) => string | number;
  leftAxisTickValues?: number[];
  bottomTickRotation?: number;
  noLegend?: boolean;
  minValue?: number;
  maxValue?: number;
  groupMode?: "grouped" | "stacked";
  markers?: readonly CartesianMarkerProps<string | number>[];
  colors?: (data: ComputedDatum<T>) => string;
  layout?: "horizontal" | "vertical";
};

export const BarChart = <T extends BarDatum>(props: BarChartProps<T>) => {
  const {
    data,
    legend,
    indexBy,
    renderBottomTick,
    onBarClick,
    padding = 0.5,
    formatLegendValue,
    renderTooltipContent,
    formatIndexBy,
    hasValueFn,
    currentLocale = "en-US",
    formatBottomTick = (value: number | string) => value,
    formatLeftTick = (value: number | string) => formatNumber(value, currentLocale),
    bottomTickRotation = 0,
    noLegend = false,
    minValue,
    maxValue,
    groupMode = "stacked",
    bottomTickSize = 12,
    markers = [],
    colors,
    leftAxisTickValues,
    layout = "vertical",
    formatTrendValue,
    valueTrends,
  } = props;
  const legendMap = useMemo(() => new Map(legend.map((item) => [item.id, item])), [legend]);
  const barKeys = useMemo(
    () => legend.filter((item) => item.type !== "point" && item.type !== "tree").map((item) => item.id),
    [legend],
  );
  const tooltipLegend = useMemo(
    () => (valueTrends ? legend.filter((item) => item.type !== "point") : legend),
    [legend, valueTrends],
  );
  const domain = useMemo(() => {
    if (!valueTrends || minValue === undefined || maxValue === undefined || data.length < 2) {
      return { min: minValue, max: maxValue };
    }

    // The ends of a fitted line can extend beyond the tallest bars.
    const trendExtent = Math.max(
      ...legend
        .filter((item) => item.type === "point")
        .flatMap(({ id }) => fitValueTrend(data, id).map(([, value]) => Math.abs(value))),
    );

    if (trendExtent < Math.min(-minValue, maxValue)) {
      return { min: minValue, max: maxValue };
    }

    const limit = Math.ceil(trendExtent * 1.01);
    return { min: Math.min(minValue, -limit), max: Math.max(maxValue, limit) };
  }, [data, legend, maxValue, minValue, valueTrends]);
  const isEmpty = useMemo(() => isEmptyChart(data, indexBy), [data, indexBy]);
  const visibleLegend =
    !isEmpty && !noLegend ? legend : valueTrends ? legend.filter((item) => item.type === "point") : [];

  const barSize = useMemo(() => {
    if (data.length >= 8) {
      return "s";
    }

    if (data.length >= 6) {
      return "m";
    }

    return "l";
  }, [data]);

  const isInverted = layout === "horizontal";

  const axisBottom: AxisProps<number | string> = {
    tickSize: 0,
    tickPadding: 5,
    tickRotation: bottomTickRotation,
    truncateTickAt: 0,
    renderTick: renderBottomTick,
    style: {
      ticks: {
        text: {
          fontSize: bottomTickSize,
        },
      },
    },
    format: isInverted
      ? formatLeftTick
      : (id) =>
          formatBottomTick(
            id,
            data.find((item) => item[indexBy] === id)!,
          ),
    tickValues: data.length > 30 ? data.filter((_, index) => !(index % 2)).map((item) => item[indexBy]) : undefined,
  };
  const axisLeft: AxisProps<number | string> = {
    tickSize: 0,
    tickPadding: 8,
    tickRotation: 0,
    truncateTickAt: 0,
    format: isInverted
      ? formatBottomTick
        ? (id) =>
            formatBottomTick(
              id,
              data.find((item) => item[indexBy] === id)!,
            )
        : undefined
      : formatLeftTick,
    tickValues: leftAxisTickValues,
  };

  return (
    <div className={styles.container} data-value-trends={valueTrends ? true : undefined}>
      <div className={styles.barContainer}>
        <BarChartStateProvider>
          <ResponsiveBar
            data={data}
            theme={CHART_THEME}
            groupMode={groupMode}
            layout={layout}
            defaultHeight={275}
            keys={barKeys}
            indexBy={indexBy}
            margin={{
              top: 10,
              right: 20,
              bottom: bottomTickRotation > 0 ? 60 : 40,
              left: computeVerticalAxisMargin({
                data,
                layout,
                keys: barKeys,
                indexBy,
                stacked: true,
                position: "left",
                formatLeftTick,
                formatBottomTick,
              }),
            }}
            padding={padding}
            innerPadding={0}
            valueScale={{ type: "linear", nice: true, ...domain }}
            indexScale={{ type: "band", round: !valueTrends }}
            layers={[
              "grid",
              valueTrends
                ? ({ xScale, yScale, innerWidth, innerHeight }: BarCustomLayerProps<T>) => {
                    // Thin date ticks on narrow cards while keeping the current run labeled.
                    const domain = xScale.domain() as (string | number)[];
                    const step = xScale.type === "band" ? Math.ceil(52 / Math.max(xScale.step(), 1)) : 1;
                    const tickValues = domain.filter((_, i) => (domain.length - 1 - i) % step === 0);

                    return (
                      <Axes
                        xScale={xScale}
                        yScale={yScale}
                        width={innerWidth}
                        height={innerHeight}
                        bottom={{ ...axisBottom, tickValues }}
                        left={axisLeft}
                      />
                    );
                  }
                : "axes",
              BottomAxisLine,
              (layerProps: BarCustomLayerProps<T>) => (
                <BarChartBars<T>
                  {...layerProps}
                  indexBy={indexBy}
                  layout={layout}
                  legend={legend}
                  barSize={barSize}
                  groupMode={groupMode}
                />
              ),
              (layerProps: BarCustomLayerProps<T>) => (
                <TrendLinesLayer
                  {...layerProps}
                  legend={legend}
                  indexBy={indexBy}
                  formatValue={formatTrendValue}
                  valueTrendData={valueTrends ? data : undefined}
                />
              ),
              "markers",
              (layerProps: BarCustomLayerProps<T>) => (
                <BarChartItemHoverLayer<T>
                  {...layerProps}
                  hasValueFn={hasValueFn}
                  inspectionLabel={
                    renderTooltipContent && formatIndexBy ? (item) => formatIndexBy(item, indexBy) : undefined
                  }
                  indexBy={indexBy}
                  layout={layout}
                  onBarClick={onBarClick}
                  tooltip={({ value }) =>
                    (
                      <BarChartTooltip
                        allowZeroValues
                        value={value}
                        indexBy={indexBy}
                        legend={tooltipLegend}
                        formatLegendValue={formatLegendValue}
                        formatIndexBy={formatIndexBy}
                      >
                        {renderTooltipContent?.(value)}
                      </BarChartTooltip>
                    ) as any
                  }
                />
              ),
            ]}
            markers={markers}
            colors={
              typeof colors === "function"
                ? colors
                : (d) => legendMap.get(d.id as Extract<keyof T, string>)?.color ?? "var(--color-bg-secondary)"
            }
            enableLabel={false}
            enableTotals={false}
            axisTop={null}
            axisRight={null}
            axisBottom={valueTrends ? null : axisBottom}
            axisLeft={valueTrends ? null : axisLeft}
            animate={!REDUCE_MOTION}
            motionConfig={CHART_MOTION_CONFIG}
            onClick={onBarClick}
          />
        </BarChartStateProvider>
      </div>
      {visibleLegend.length > 0 && <Legends data={visibleLegend} />}
      {valueTrends && (
        <details className={styles.trendHelp}>
          <summary>{valueTrends.helpLabel}</summary>
          <p>{valueTrends.helpDescription}</p>
        </details>
      )}
    </div>
  );
};

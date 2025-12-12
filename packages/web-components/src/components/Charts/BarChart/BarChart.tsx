import type { AxisTickProps } from "@nivo/axes";
import {
  type BarCustomLayerProps,
  type BarDatum,
  type BarItemProps,
  type ComputedDatum,
  ResponsiveBar,
} from "@nivo/bar";
import type { CartesianMarkerProps } from "@nivo/core";
import { useMemo } from "preact/hooks";
import { Legends } from "../Legend";
import { formatNumber } from "../Legend/LegendItem";
import type { LegendItemValue } from "../Legend/LegendItem/types";
import { CHART_MOTION_CONFIG, CHART_THEME, REDUCE_MOTION } from "../config";
import { BarChartItem, BarChartItemHoverLayer } from "./BarChartItem";
import { BarChartTooltip } from "./BarChartTooltip";
import { BottomAxisLine } from "./BottomAxisLine";
import { TrendLinesLayer } from "./TrendLinesLayer";
import { BarChartStateProvider } from "./context";
import styles from "./styles.scss";
import { computeVerticalAxisMargin, isEmptyChart } from "./utils";

type BarChartProps<T extends BarDatum> = {
  data: T[];
  legend: LegendItemValue<T>[];
  indexBy: Extract<keyof T, string>;
  lineKeys?: Extract<keyof T, string>[];
  hideEmptyTrendLines?: boolean;
  formatLegendValue?: (legend: LegendItemValue<T>) => string | number | undefined;
  formatIndexBy?: (value: T, indexBy: Extract<keyof T, string>) => string;
  renderBottomTick?: (props: AxisTickProps<number | string>) => any;
  bottomTickSize?: number;
  onBarClick?: (value: ComputedDatum<T>) => void;
  padding?: number;
  hasValueFn?: (data: T) => boolean;
  currentLocale?: string;
  formatBottomTick?: (value: number | string, item: T) => string | number;
  formatLeftTick?: (value: number | string) => string | number;
  bottomTickRotation?: number;
  noLegend?: boolean;
  minValue?: number;
  maxValue?: number;
  groupMode?: "grouped" | "stacked";
  markers?: readonly CartesianMarkerProps<string | number>[];
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
    formatIndexBy,
    hasValueFn,
    currentLocale = "en-US",
    formatBottomTick = (value: number) => value,
    formatLeftTick = (value: number | string) => formatNumber(value, currentLocale),
    bottomTickRotation = 0,
    noLegend = false,
    minValue,
    maxValue,
    groupMode = "stacked",
    lineKeys = [],
    hideEmptyTrendLines = true,
    bottomTickSize = 12,
    markers = [],
  } = props;
  const legendMap = useMemo(() => new Map(legend.map((item) => [item.id, item])), [legend]);
  const keys = useMemo(() => [...legendMap.keys()], [legendMap]);
  const isEmpty = useMemo(() => isEmptyChart(data, indexBy), [data, indexBy]);

  const barSize = useMemo(() => {
    if (data.length >= 8) {
      return "s";
    }

    if (data.length >= 6) {
      return "m";
    }

    return "l";
  }, [data]);

  return (
    <div className={styles.container}>
      <div className={styles.barContainer}>
        <BarChartStateProvider>
          <ResponsiveBar
            data={data}
            theme={CHART_THEME}
            groupMode={groupMode}
            keys={keys}
            indexBy={indexBy}
            margin={{
              top: 10,
              right: 10,
              bottom: bottomTickRotation > 0 ? 60 : 40,
              left: computeVerticalAxisMargin({
                data,
                keys: keys,
                stacked: true,
                position: "left",
                format: formatLeftTick,
              }),
            }}
            padding={padding}
            innerPadding={0}
            valueScale={{ type: "linear", nice: true, min: minValue, max: maxValue }}
            indexScale={{ type: "band", round: true }}
            layers={[
              "grid",
              "axes",
              (layerProps: BarCustomLayerProps<T>) => (
                <BarChartItemHoverLayer<T>
                  {...layerProps}
                  hasValueFn={hasValueFn}
                  indexBy={indexBy}
                  tooltip={({ value }) =>
                    (
                      <BarChartTooltip
                        allowZeroValues
                        value={value}
                        indexBy={indexBy}
                        legend={legend}
                        formatLegendValue={formatLegendValue}
                        formatIndexBy={formatIndexBy}
                      />
                    ) as any
                  }
                />
              ),
              "bars",
              (layerProps: BarCustomLayerProps<T>) =>
                lineKeys.length > 0 && (
                  <TrendLinesLayer
                    {...layerProps}
                    legend={legend}
                    trendKeys={lineKeys}
                    minValue={minValue}
                    maxValue={maxValue}
                    hideEmptyTrendLines={hideEmptyTrendLines}
                    barSize={barSize}
                  />
                ),
              "markers",
              BottomAxisLine,
            ]}
            markers={markers}
            colors={(d) => legendMap.get(d.id as Extract<keyof T, string>)?.color ?? ""}
            enableLabel={false}
            enableTotals={false}
            axisTop={null}
            axisRight={null}
            axisBottom={{
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
              format: (id) => formatBottomTick(id, data.find((item) => item[indexBy] === id)!),
              tickValues:
                data.length > 30 ? data.filter((_, index) => !(index % 2)).map((item) => item[indexBy]) : undefined,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
              tickRotation: 0,
              truncateTickAt: 0,
              format: formatLeftTick,
            }}
            animate={!REDUCE_MOTION}
            motionConfig={CHART_MOTION_CONFIG}
            onClick={onBarClick}
            barComponent={(barProps: BarItemProps<T>) => (
              <BarChartItem {...barProps} legend={legend} indexBy={indexBy} barSize={barSize} />
            )}
          />
        </BarChartStateProvider>
      </div>
      {!isEmpty && !noLegend && <Legends data={legend} />}
    </div>
  );
};

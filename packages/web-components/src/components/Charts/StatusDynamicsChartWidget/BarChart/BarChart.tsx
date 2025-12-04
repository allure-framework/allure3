import type { AxisProps } from "@nivo/axes";
import {
  type BarCustomLayerProps,
  type BarDatum,
  type BarItemProps,
  type ComputedDatum,
  ResponsiveBar,
} from "@nivo/bar";
import { useMemo } from "preact/hooks";
import { Legends } from "../../Legend";
import { formatNumber } from "../../Legend/LegendItem";
import type { LegendItemValue } from "../../Legend/LegendItem/types";
import { CHART_MOTION_CONFIG, CHART_THEME, REDUCE_MOTION } from "../../config";
import { BarChartItem, BarChartItemHoverLayer } from "./BarChartItem";
import { BarChartTooltip } from "./BarChartTooltip";
import { BottomAxisLine } from "./BottomAxisLine";
import { BarChartStateProvider } from "./context";
import styles from "./styles.scss";
import { computeVerticalAxisMargin, isEmptyChart } from "./utils";

type BarChartProps<T extends BarDatum> = {
  data: T[];
  legend: LegendItemValue<T>[];
  indexBy: Extract<keyof T, string>;
  formatLegendValue?: (legend: LegendItemValue<T>) => string;
  formatIndexBy?: (value: T, indexBy: Extract<keyof T, string>) => string;
  renderBottomTick?: AxisProps["renderTick"];
  onBarClick?: (value: ComputedDatum<T>) => void;
  padding?: number;
  hasValueFn?: (data: T) => boolean;
  currentLocale?: string;
  formatBottomTick?: (value: number | string) => string | number;
  formatLeftTick?: (value: number | string) => string | number;
  bottomTickRotation?: number;
  noLegend?: boolean;
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
  } = props;
  const legendMap = useMemo(() => new Map(legend.map((item) => [item.id, item])), [legend]);
  const keys = useMemo(() => [...legendMap.keys()], [legendMap]);
  const isEmpty = useMemo(() => isEmptyChart(data, indexBy), [data, indexBy]);

  return (
    <div className={styles.container}>
      <div className={styles.barContainer}>
        <BarChartStateProvider>
          <ResponsiveBar
            data={data}
            theme={CHART_THEME}
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
            valueScale={{ type: "linear", nice: true }}
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
              BottomAxisLine,
            ]}
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
              format: formatBottomTick,
              tickValues:
                data.length > 30 ? data.filter((_, index) => !(index % 2)).map((item) => item[indexBy]) : undefined,
            }}
            // Without Infinity 0 is shown on Y axe @TODO: check if this is still needed
            // maxValue={isEmpty ? Infinity : undefined}
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
            barComponent={(barProps: BarItemProps<T>) => <BarChartItem {...barProps} legend={legend} />}
          />
        </BarChartStateProvider>
      </div>
      {!isEmpty && !noLegend && <Legends data={legend} />}
    </div>
  );
};

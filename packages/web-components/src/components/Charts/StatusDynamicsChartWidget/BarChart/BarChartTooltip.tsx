import type { BarDatum } from "@nivo/bar";
import { ChartTooltip } from "../../ChartTooltip";
import { LegendItem, isPresent } from "../../Legend/LegendItem";
import type { LegendItemValue } from "../../Legend/LegendItem/types";

export interface BarChartTooltipProps<T extends BarDatum> {
  value: T;
  indexBy: Extract<keyof T, string>;
  legend: LegendItemValue<T>[];
  formatIndexBy?: (value: T, indexBy: Extract<keyof T, string>) => string;
  formatLegendValue?: (legend: LegendItemValue<T>) => string;
  allowZeroValues?: boolean;
}

export const BarChartTooltip = <T extends BarDatum>({
  value,
  indexBy,
  legend,
  formatIndexBy = (val, key) => val[key]?.toString() ?? "",
  formatLegendValue = (l) => (l.value ?? 0).toString() ?? "",
  allowZeroValues = false,
}: BarChartTooltipProps<T>) => {
  const chartLegend = allowZeroValues
    ? legend
    : legend.filter((item) => isPresent(value[item.id]) && Number(value[item.id]) !== 0);

  return (
    <ChartTooltip label={formatIndexBy(value, indexBy)}>
      {chartLegend.map((item) => (
        <LegendItem
          key={item.id}
          mode="menu"
          legend={{
            ...item,
            value: formatLegendValue({
              ...item,
              value: value[item.id],
            }),
          }}
        />
      ))}
    </ChartTooltip>
  );
};

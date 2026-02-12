import type { HeatMapDatum, TooltipProps } from "@nivo/heatmap";
import { useMemo } from "preact/hooks";
import { ChartTooltip } from "../ChartTooltip";
import { LegendItem } from "../Legend/LegendItem";

export const HeatMapTooltip = <T extends HeatMapDatum>(props: TooltipProps<T>) => {
  const { cell } = props;

  const legend = useMemo(
    () => ({
      id: cell.id.toString(),
      color: cell.color,
      label: cell.data.x,
      value: cell.label,
    }),
    [cell],
  );

  return (
    <ChartTooltip label={cell.serieId}>
      <LegendItem mode="default" legend={legend} />
    </ChartTooltip>
  );
};

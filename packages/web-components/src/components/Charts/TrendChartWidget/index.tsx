import type { CSSProperties } from "preact/compat";
import { useCallback, useMemo, useState } from "preact/hooks";
import type { Serie, Slice } from "@/components/Charts/TrendChart";
import { TrendChart, TrendChartKind, makeSymlogScale } from "@/components/Charts/TrendChart";
import { Widget } from "@/components/Widget";
import { ChartMode } from "@allurereport/web-commons";

interface TrendChartWidgetPropsTranslations {
  "no-results": string;
}

interface TrendChartWidgetProps<TSlice = { metadata: { executionId: string } }> {
  title: string;
  mode: ChartMode;
  items: readonly Serie[];
  slices: readonly TSlice[];
  min: number;
  max: number;
  height?: CSSProperties["height"];
  width?: CSSProperties["width"];
  rootAriaLabel?: string;
  translations: TrendChartWidgetPropsTranslations;
}

export const TrendChartWidget = ({
  title,
  mode,
  items,
  slices,
  min,
  max,
  height = 400,
  width = "100%",
  rootAriaLabel,
  translations,
}: TrendChartWidgetProps) => {
  const [selectedSliceIds, setSelectedSliceIds] = useState<string[]>([]);

  const emptyLabel = translations["no-results"];

  const yScale = useMemo(() => makeSymlogScale(min, max, { constant: 8 }), [max, min]);
  const yFormat = useMemo(() => (mode === ChartMode.Percent ? " >-.2%" : " >-.2f"), [mode]);

  const handleSliceClick = useCallback((slice: Slice) => {
    const executionIds = slice.points.reduce((acc, point) => {
      acc.push(point.data.x as string);

      return acc;
    }, [] as string[]);

    setSelectedSliceIds(() => executionIds);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectedSlices = useMemo(
    () => slices.filter((slice) => selectedSliceIds.includes(slice.metadata.executionId)),
    [slices, selectedSliceIds],
  );

  return (
    <Widget title={title}>
      <TrendChart
        kind={TrendChartKind.SlicesX}
        data={items}
        height={height}
        width={width}
        emptyLabel={emptyLabel}
        emptyAriaLabel={emptyLabel}
        rootAriaLabel={rootAriaLabel}
        colors={({ color }) => color}
        yScale={yScale}
        yFormat={yFormat}
        onSliceClick={handleSliceClick}
        onSliceTouchEnd={handleSliceClick}
      />
    </Widget>
  );
};

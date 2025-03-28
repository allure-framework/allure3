import { TrendChart, TrendChartKind, makeSymlogScale } from "@allurereport/web-components";
import type { Serie, Slice } from "@allurereport/web-components";
import type { CSSProperties } from "preact/compat";
import { useCallback, useMemo, useState } from "preact/hooks";
import { Widget } from "../Widget";

interface TrendChartWidgetProps<TSlice = { metadata: { executionId: string } }> {
  title: string;
  items: readonly Serie[];
  slices: readonly TSlice[];
  min: number;
  max: number;
  height?: CSSProperties["height"];
  width?: CSSProperties["width"];
  rootAriaLabel?: string;
}

export const TrendChartWidget = ({
  title,
  items,
  slices,
  min,
  max,
  height = 400,
  width = "100%",
  rootAriaLabel,
}: TrendChartWidgetProps) => {
  const [selectedSliceIds, setSelectedSliceIds] = useState<string[]>([]);

  const yScale = useMemo(() => makeSymlogScale(min, max, { constant: 8 }), [max, min]);

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
        rootAriaLabel={rootAriaLabel}
        height={height}
        width={width}
        colors={({ color }) => color}
        yScale={yScale}
        onSliceClick={handleSliceClick}
        onSliceTouchEnd={handleSliceClick}
      />
    </Widget>
  );
};

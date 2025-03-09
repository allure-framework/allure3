import { TrendChart, makeSymlogScale, TrendChartKind } from "@allurereport/web-components";
import type { Serie, Slice } from "@allurereport/web-components";
import { Widget} from "../Widget";
import { useCallback, useMemo, useState } from "preact/hooks";

interface TrendChartWidgetProps<TSlice = { metadata: { executionId: string } }> {
  title: string;
  items: readonly Serie[];
  slices: readonly TSlice[];
  min: number;
  max: number;
}

export const TrendChartWidget = ({ title, items, slices, min, max }: TrendChartWidgetProps) => {
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
  const selectedSlices = slices.filter((slice) => selectedSliceIds.includes(slice.metadata.executionId));

  return (
    <Widget title={title}>
      <div>
          <TrendChart
            kind={TrendChartKind.slicesX}
            data={items}
            rootArialLabel="Test Results Trend"
            height={400}
            width="100%"
            colors={({ color }) => color}
            yScale={yScale}
            onSliceClick={handleSliceClick}
            onSliceTouchEnd={handleSliceClick}
          />
        </div>
    </Widget>
  );
};

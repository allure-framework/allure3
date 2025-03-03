import { TrendChart, makeSymlogScale, TrendChartKind } from "@allurereport/web-components";
import type { TrendChartData } from "@allurereport/web-components";
import { Widget} from "../Widget";
import { useCallback, useMemo, useState } from "preact/hooks";

interface TrendChartWidgetProps {
  data: TrendChartData[];
}

export const TrendChartWidget = ({ data }: TrendChartWidgetProps) => {
  const [selectedSliceId, setSelectedSliceId] = useState<string | null>(null);
  const ys = useMemo(() => data.flatMap(series => series.data).map<number>(point => point.y), [data]);
  const max = useMemo(() => Math.max(...ys), [ys]);

  const trendDataAsPercentage: TrendChartData[] = useMemo(() => data.map(series => ({
    ...series,
    data: series.data.map(point => ({
      ...point,
      y: point.y / max * 100,
    })),
  })),
  [data, max]);

  const yScale = useMemo(() => makeSymlogScale(0, 100, { constant: 8 }), []);

  const handleSliceClick = useCallback(() => {
    setSelectedSliceId(null);
  }, []);

  console.log("selectedSliceId", selectedSliceId);

  return (
    <Widget title="Test Results Trend">
      <div>
          <TrendChart
            kind={TrendChartKind.slicesX}
            data={trendDataAsPercentage}
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

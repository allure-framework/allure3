import { TrendChart, TrendChartData, makeSymlogScale } from "@allurereport/web-components";
import { Widget } from "../Widget";
import { useMemo } from "preact/hooks";

const Y_SCALE_CONSTANT = 8;

interface TrendChartWidgetProps {
  data: TrendChartData[];
}

export const TrendChartWidget = ({ data }: TrendChartWidgetProps) => {
  const ys = useMemo(() => data.flatMap(series => series.data).map<number>(point => point.y), [data]);
  const min = useMemo(() => Math.min(...ys), [ys]);
  const max = useMemo(() => Math.max(...ys), [ys]);

  const trendDataAsPercentage: TrendChartData[] = useMemo(() => data.map(series => ({
    ...series,
    data: series.data.map(point => ({
      ...point,
      y: point.y / max * 100,
    })),
  })),
  [data, max]);

  const yScale = useMemo(() => makeSymlogScale(min, max, { constant: Y_SCALE_CONSTANT }), [min, max]);

  return (
    <Widget title="Test Results Trend">
      <TrendChart
        data={trendDataAsPercentage}
        rootArialLabel="Test Results Trend"
        height={400}
        width="100%"
        colors={({ color }) => color}
        yScale={yScale}
      />
    </Widget>
  );
};

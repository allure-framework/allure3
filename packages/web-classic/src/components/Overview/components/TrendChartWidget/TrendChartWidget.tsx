import { TrendChart, TrendChartData, defaultAxisBottomConfig } from "@allurereport/web-components";
import type { ScaleSymlogSpec } from "@nivo/scales";
import { Widget } from "../Widget";

const Y_SCALE_CONSTANT = 8;

interface TrendChartWidgetProps {
  data: TrendChartData[];
}

export const TrendChartWidget = ({ data }: TrendChartWidgetProps) => {
  const maxValue = data.flatMap(series => series.data).reduce((acc, point) => Math.max(acc, point.y), -Infinity);
  const trendDataAsPercentage: TrendChartData[] = data.map(series => ({
    ...series,
    data: series.data.map(point => ({
      ...point,
      x: `xxx.yyy.zzzz-${point.x}`,
      y: point.y / maxValue * 100,
    })),
  }));

  const { min, max } = trendDataAsPercentage.flatMap(series => series.data).reduce<{min: number; max: number}>((acc, point) => ({
    min: Math.min(acc.min, point.y),
    max: Math.max(acc.max, point.y),
  }), { min: Infinity, max: -Infinity });

  const yScaleConfig: ScaleSymlogSpec = {
    type: "symlog",
    constant: Y_SCALE_CONSTANT,
    min,
    max,
  };

  return (
    <Widget title="Test Results Trend">
      <TrendChart
        data={trendDataAsPercentage}
        rootArialLabel="Test Results Trend"
        height={400}
        width="100%"
        colors={({ color }) => color}
        yScale={yScaleConfig}
        axisBottom={{
          ...defaultAxisBottomConfig,
          truncateTickAt: 16,
        }}
      />
    </Widget>
  );
}; 
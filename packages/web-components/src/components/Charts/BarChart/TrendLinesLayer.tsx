import { BarCustomLayerProps, BarDatum } from "@nivo/bar";
import { curveFromProp, useMotionConfig } from "@nivo/core";
import { animated, useSpring } from "@react-spring/web";
import { line } from "d3-shape";
import { useMemo } from "preact/hooks";
import { LegendItemValue } from "../Legend/LegendItem/types";
import { getBarWidth } from "./BarChartItem";

const STROKE_WIDTH = 2;
const LINE_CAP_OFFSET = 1;

export const TrendLinesLayer = <T extends BarDatum>(
  props: BarCustomLayerProps<T> & {
    legend: LegendItemValue<T>[];
    trendKeys: Extract<keyof T, string>[];
    minValue?: number;
    maxValue?: number;
    hideEmptyTrendLines?: boolean;
  },
) => {
  const { legend, bars, trendKeys, hideEmptyTrendLines } = props;

  const barsCount = Math.max(...bars.map((bar) => bar.data.index + 1));

  const lineData = useMemo(() => {
    const legendMap = new Map(legend.map((item) => [item.id, item]));

    const lines = trendKeys
      .map((trendKey) => ({
        bars: bars.filter((bar) => bar.data.id === trendKey),
        key: trendKey,
      }))
      .filter(({ bars }) => !hideEmptyTrendLines || !bars.every((bar) => bar.data.value === 0))
      .map(({ bars, key }) => {
        const color = legendMap.get(key)?.color ?? "";

        const firstX = Math.min(...bars.map((bar) => bar.x));
        const lastX = Math.max(...bars.map((bar) => bar.x));

        return {
          key,
          color,
          points: bars.map((bar) => {
            const isBlank = bar.data.value === 0;

            const barCenter = bar.x + bar.width / 2;
            const halfBarWidth = getBarWidth(bar.width) / 2;
            let x = barCenter;

            if (bar.x === firstX) {
              // Offseting line start so that it starts from the left edge of the bar
              x = barCenter - halfBarWidth + LINE_CAP_OFFSET;
            }

            if (bar.x === lastX) {
              // Offseting line end so that it ends at the right edge of the bar
              x = barCenter + halfBarWidth - LINE_CAP_OFFSET;
            }

            if (!isBlank) {
              // Otherwise, the line is going through the center of the bar
              x = barCenter;
            }

            return {
              x,
              y: bar.y + bar.height / 2,
              key: bar.key,
              isBlank,
            };
          }),
        };
      });

    for (let i = 0; i < barsCount; i++) {
      const points = lines.map((line) => line.points[i]);

      if (points.length === 0) {
        continue;
      }

      const intersectingOnYPoints = points.filter((point) =>
        points.some((p) => p.key !== point.key && p.y === point.y),
      );

      const centerIndex = (intersectingOnYPoints.length - 1) / 2;

      intersectingOnYPoints.forEach((point, index) => {
        // Offseting line so that it doesn't intersect with other lines
        const offset = (index - centerIndex) * STROKE_WIDTH;
        point.y = point.y + offset;
      });
    }
    return lines;
  }, [bars, trendKeys, hideEmptyTrendLines]);

  return (
    <animated.g data-testid="trend-lines-layer" style={{ pointerEvents: "none" }}>
      {lineData.map(({ key, points, color }) => (
        <Line key={key} points={points} color={color} />
      ))}
    </animated.g>
  );
};

const lineGenerator = line<{ x: number; y: number }>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveFromProp("monotoneX"));

const Line = (props: { points: { x: number; y: number }[]; color: string }) => {
  const { points, color } = props;
  const { animate, config: motionConfig } = useMotionConfig();

  const { d } = useSpring({
    d: lineGenerator(points) ?? undefined,
    config: motionConfig,
    immediate: !animate,
  });

  return (
    <animated.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeOpacity={0.98}
    />
  );
};

import type { BarCustomLayerProps, BarDatum } from "@nivo/bar";
import { useMotionConfig } from "@nivo/core";
import { animated, useSpring } from "@react-spring/web";
import { line } from "d3-shape";
import { useMemo } from "preact/hooks";
import type { LegendItemValue } from "../Legend/LegendItem/types";
import { getBarWidth } from "./BarChartItem";
import { curveAllureBumpX } from "./curveAllureBumpX";

const STROKE_WIDTH = 2;
const LINE_CAP_OFFSET = 1;

export const TrendLinesLayer = <T extends BarDatum>(
  props: BarCustomLayerProps<T> & {
    legend: LegendItemValue<T>[];
    lines: {
      key: Extract<keyof T, string>;
      curveSharpness?: number;
    }[];
    minValue?: number;
    maxValue?: number;
    hideEmptyTrendLines?: boolean;
    barSize: "s" | "m" | "l";
  },
) => {
  const { legend, bars, lines, hideEmptyTrendLines, barSize, innerHeight, innerWidth, minValue } = props;

  const [leftBorderPoint, rightBorderPoint] = useMemo(() => {
    let y = 0;

    if (typeof minValue === "number" && minValue < 0) {
      // Graph is diverging, so we need to place the lines in the middle of the graph
      y = innerHeight / 2;
    }

    return [
      { x: 0, y },
      { x: innerWidth, y },
    ] as const;
  }, [innerHeight, innerWidth, minValue]);

  const lineData = useMemo(() => {
    const legendMap = new Map(legend.map((item) => [item.id, item]));

    const linesData = lines
      .map(({ key, curveSharpness }) => ({
        bars: bars.filter((bar) => bar.data.id === key),
        key,
        curveSharpness,
      }))
      .sort((a, b) => {
        const aValue = Number(legendMap.get(a.key)?.value ?? 0);
        const bValue = Number(legendMap.get(b.key)?.value ?? 0);

        // Sort positive (or zero) values first, then negative values last; within groups, sort by ascending value
        if (aValue < 0 && bValue >= 0) {
          return 1;
        }
        if (aValue >= 0 && bValue < 0) {
          return -1;
        }

        return aValue - bValue;
      })
      .filter(({ bars: trendBars }) => !hideEmptyTrendLines || !trendBars.every((bar) => bar.data.value === 0))
      .map(({ bars: trendBars, key, curveSharpness }) => {
        const color = legendMap.get(key)?.color ?? "";
        const isBelowZero = Number(legendMap.get(key)?.value ?? 0) < 0;

        const firstX = Math.min(...trendBars.map((bar) => bar.x));
        const lastX = Math.max(...trendBars.map((bar) => bar.x));

        const trendKeyPoints = trendBars.reduce(
          (points, bar) => {
            const isBlank = bar.data.value === 0;

            const barCenter = bar.x + bar.width / 2;
            const halfBarWidth = getBarWidth(bar.width, barSize) / 2;
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

            let yOffset = bar.height / 2;

            if (bar.height > STROKE_WIDTH * 4) {
              yOffset = STROKE_WIDTH * 2;

              if (isBelowZero) {
                yOffset = bar.height - STROKE_WIDTH * 2;
              }
            }

            if (isBlank) {
              yOffset = 0;
            }

            return points.concat({
              x,
              y: bar.y + yOffset,
              key: bar.key,
              isBlank,
            });
          },
          [] as { x: number; y: number; key: string; isBlank: boolean }[],
        );

        return {
          key,
          color,
          curveSharpness,
          points: [
            { ...leftBorderPoint, key: `${key}/leftBorderPoint`, isBlank: false },
            ...trendKeyPoints,
            { ...rightBorderPoint, key: `${key}/rightBorderPoint`, isBlank: false },
          ],
        };
      });

    const maxPointsCount = Math.max(...linesData.map((l) => l.points.length));

    for (let i = 0; i < maxPointsCount; i++) {
      const points = linesData.map((l) => l.points[i]);

      if (points.length === 0) {
        continue;
      }

      const intersectingOnYPoints = points.filter((point) =>
        points.some((p) => p && p.key !== point.key && p.y === point.y),
      );

      const centerIndex = (intersectingOnYPoints.length - 1) / 2;

      intersectingOnYPoints.forEach((point, index) => {
        // Offseting line so that it doesn't intersect with other lines
        const offset = (index - centerIndex) * STROKE_WIDTH;
        point.y = point.y + offset;
      });
    }

    return linesData.map(({ points, ...rest }) => ({ ...rest, points: points.filter((point) => !point.isBlank) }));
  }, [bars, lines, hideEmptyTrendLines, barSize, legend, leftBorderPoint, rightBorderPoint]);

  return (
    <animated.g data-testid="trend-lines-layer" style={{ pointerEvents: "none" }}>
      {lineData.map(({ key, points, color, curveSharpness }) => (
        <Line key={key} points={points} color={color} curveSharpness={curveSharpness} />
      ))}
    </animated.g>
  );
};

const useLineGenerator = (sharpness: number = 0.2) => {
  return useMemo(
    () =>
      line<{ x: number; y: number }>()
        .x((point) => point.x)
        .y((point) => point.y)
        .curve(curveAllureBumpX(sharpness)),
    [sharpness],
  );
};

const Line = (props: { points: { x: number; y: number }[]; color: string; curveSharpness?: number }) => {
  const { points, color, curveSharpness } = props;
  const { animate, config: motionConfig } = useMotionConfig();
  const lineGenerator = useLineGenerator(curveSharpness);

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

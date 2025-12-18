import type { BarCustomLayerProps, BarDatum, ComputedBarDatum } from "@nivo/bar";
import { useMotionConfig } from "@nivo/core";
import { computeXYScalesForSeries } from "@nivo/scales";
import { animated, useSpring } from "@react-spring/web";
import { regressionLinear } from "d3-regression";
import { line } from "d3-shape";
import { toNumber } from "lodash";
import { useMemo } from "preact/hooks";
import type { LegendItemValue } from "../Legend/LegendItem/types";

const STROKE_WIDTH = 2;
const CIRCLE_RADIUS = 3;

// Linear regression function from d3-regression
const linearRegression = regressionLinear<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y);

const lineGenerator = line<[number, number]>()
  .x((point) => point[0])
  .y((point) => point[1]);

const getTrendBars = (bars: readonly ComputedBarDatum<any>[]) => {
  const barsCount = Math.max(...bars.map((bar) => bar.data.index + 1));

  return bars.slice(0, barsCount);
};

export const TrendLinesLayer = <T extends BarDatum>(
  props: BarCustomLayerProps<T> & {
    legend: LegendItemValue<T>[];
    indexBy: Extract<keyof T, string>;
    formatValue?: (value: number, trendKey: Extract<keyof T, string>) => number;
  },
) => {
  const { legend, indexBy, bars: allBars, innerHeight, innerWidth, formatValue = (value) => toNumber(value) } = props;

  const trendKeys = useMemo(() => legend.filter((item) => item.type === "point").map((item) => item.id), [legend]);

  const colors = useMemo(
    () =>
      legend
        .filter((item) => item.type === "point")
        .reduce(
          (acc, item) => {
            acc[item.id] = item.color;
            return acc;
          },
          {} as Record<string, string>,
        ),
    [legend],
  );

  const trendBars = useMemo(() => getTrendBars(allBars), [allBars]);

  const scale = useMemo(
    () =>
      computeXYScalesForSeries(
        trendKeys.map((trendKey) => ({
          id: trendKey,
          data: trendBars.map((bar) => ({
            x: toNumber(bar.data.data[indexBy] ?? 0),
            y: formatValue(toNumber(bar.data.data[trendKey] ?? 0), trendKey),
          })),
        })),
        { type: "linear" },
        { type: "linear", nice: true, min: 0, max: 100 },
        innerWidth,
        innerHeight,
      ),
    [trendKeys, trendBars, indexBy, formatValue, innerWidth, innerHeight],
  );

  const lineData = useMemo(
    () =>
      trendKeys.map((trendKey) => {
        return {
          trendKey,
          color: colors[trendKey] ?? "",
          points: trendBars.map((bar) => ({
            x: toNumber(bar.x + bar.width / 2),
            y: toNumber(scale.yScale(formatValue(toNumber(bar.data.data[trendKey] ?? 0), trendKey)) ?? 0),
            id: bar.key,
          })),
        };
      }),
    [trendKeys, trendBars, formatValue, scale, colors],
  );

  if (trendKeys.length === 0) {
    return null;
  }

  return (
    <animated.g data-testid="trend-lines-layer" pointerEvents="none">
      {lineData.map(({ trendKey, points, color }) => (
        <animated.g key={trendKey} data-testid="trend-line-group" data-trend-key={trendKey}>
          <Line key={trendKey} points={points} color={color} />
          {points.map(({ x, y, id }) => (
            <Circle key={id} x={x} y={y} color={color} />
          ))}
        </animated.g>
      ))}
    </animated.g>
  );
};

const Line = (props: { points: { x: number; y: number }[]; color: string }) => {
  const { points, color } = props;
  const { animate, config: motionConfig } = useMotionConfig();

  const trendLinePoints = useMemo(() => {
    if (points.length === 0 || points.length < 2) {
      return [];
    }

    return linearRegression(points);
  }, [points]);

  const { d } = useSpring({
    d: lineGenerator(trendLinePoints) ?? undefined,
    config: motionConfig,
    immediate: !animate,
  });

  if (points.length === 0 || points.length < 2 || trendLinePoints.length === 0) {
    return null;
  }

  return (
    <animated.path
      d={d}
      data-testid="trend-line"
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeOpacity={0.87}
      pointerEvents="none"
      strokeDasharray="4"
    />
  );
};

const Circle = (props: { x: number; y: number; color: string }) => {
  const { x, y, color } = props;
  const { animate, config: motionConfig } = useMotionConfig();

  const { cx, cy } = useSpring({
    cx: x,
    cy: y,
    config: motionConfig,
    immediate: !animate,
  });

  return (
    <animated.circle
      data-testid="trend-line-point"
      cx={cx}
      cy={cy}
      r={CIRCLE_RADIUS}
      strokeWidth={STROKE_WIDTH}
      fill="white"
      stroke={color}
      pointerEvents="none"
    />
  );
};

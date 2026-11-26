import type { BarCustomLayerProps, BarDatum, ComputedBarDatum } from "@nivo/bar";
import { useMotionConfig } from "@nivo/core";
import { computeXYScalesForSeries } from "@nivo/scales";
import { animated, useSpring } from "@react-spring/web";
import { regressionLinear } from "d3-regression";
import { line } from "d3-shape";
import toNumber from "lodash/toNumber.js";
import { useId, useMemo } from "preact/hooks";

import type { LegendItemValue } from "../Legend/LegendItem/types";

const STROKE_WIDTH = 2;
const CIRCLE_RADIUS = 3;

// Linear regression function from d3-regression
const linearRegression = regressionLinear<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y);

// Band centers are uniformly spaced. Fit in report units before applying the chart scales.
export const fitValueTrend = <T extends BarDatum>(data: readonly T[], key: keyof T) =>
  linearRegression(data.map((item, x) => ({ x, y: Number(item[key]) })));

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
    valueTrendData?: readonly T[];
    formatValue?: (value: number, trendKey: Extract<keyof T, string>) => number | undefined;
  },
) => {
  const {
    legend,
    indexBy,
    bars: allBars,
    innerHeight,
    innerWidth,
    valueTrendData,
    xScale,
    yScale,
    formatValue = (value) => toNumber(value),
  } = props;

  const trends = useMemo(() => legend.filter((item) => item.type === "point"), [legend]);
  const clipPathId = useId();

  const trendBars = useMemo(() => getTrendBars(allBars), [allBars]);

  const scale = useMemo(
    () =>
      valueTrendData
        ? undefined
        : computeXYScalesForSeries(
            trends.map(({ id: trendKey }) => ({
              id: trendKey,
              data: trendBars
                .map((bar) => {
                  const y = formatValue(toNumber(bar.data.data[trendKey] ?? 0), trendKey);

                  // Skip bars where formatValue returns undefined
                  if (y === undefined) {
                    return null;
                  }

                  return {
                    x: toNumber(bar.data.data[indexBy] ?? 0),
                    y,
                  };
                })
                .filter((point): point is { x: number; y: number } => point !== null),
            })),
            { type: "linear" },
            { type: "linear", nice: true, min: 0, max: 100 },
            innerWidth,
            innerHeight,
          ),
    [trends, trendBars, indexBy, formatValue, innerWidth, innerHeight, valueTrendData],
  );

  const lineData = useMemo(
    () =>
      trends
        .map(({ id: trendKey, color, lineStyle }) => {
          if (valueTrendData) {
            if (valueTrendData.length < 2 || xScale.type !== "band" || yScale.type !== "linear") {
              return null;
            }

            const halfBand = xScale.bandwidth() / 2;
            const points = valueTrendData.map((item) => {
              const id = item[indexBy];
              const value = Number(item[trendKey]);

              return { id, x: Number(xScale(id)) + halfBand, y: yScale(value), value };
            });

            return { trendKey, color, lineStyle, points };
          }

          if (!scale) {
            return null;
          }

          // Regression won't work if we have less than 2 points to work with
          if (trendBars.length < 2) {
            return null;
          }

          const points = trendBars
            .map((bar) => {
              const value = formatValue(toNumber(bar.data.data[trendKey] ?? 0), trendKey);

              // Skip points where formatValue returns undefined
              if (value === undefined) {
                return null;
              }

              return {
                x: toNumber(bar.x + bar.width / 2),
                y: toNumber(scale.yScale(value) ?? 0),
                id: bar.key,
                value,
              };
            })
            .filter((p) => p !== null);

          // No need to predict points if we have the same number of bars and points
          if (trendBars.length === points.length) {
            return {
              trendKey,
              color,
              lineStyle,
              points,
            };
          }

          // Can't predict points if we have less than 2 points
          if (points.length < 2) {
            return null;
          }

          const progression = linearRegression(points);

          const predictedPoints = trendBars.map((bar) => {
            const value = formatValue(toNumber(bar.data.data[trendKey] ?? 0), trendKey);
            const x = toNumber(bar.x + bar.width / 2);

            let y = progression.predict(x);

            if (value !== undefined) {
              y = toNumber(scale.yScale(value) ?? 0);
            }

            return {
              x,
              y,
              id: bar.key,
              value,
            };
          });

          return {
            trendKey,
            color,
            lineStyle,
            points: predictedPoints,
          };
        })
        .filter((l) => l !== null),
    [trends, trendBars, formatValue, scale, valueTrendData, indexBy, xScale, yScale],
  );

  if (lineData.length === 0) {
    return null;
  }

  const clipOffset = valueTrendData ? 0 : STROKE_WIDTH + CIRCLE_RADIUS;

  return (
    <animated.g data-testid="trend-lines-layer" pointerEvents="none" clipPath={`url(#${clipPathId})`}>
      <defs>
        <clipPath id={clipPathId}>
          <rect x={-clipOffset} y={-clipOffset} width={innerWidth + clipOffset} height={innerHeight + clipOffset} />
        </clipPath>
      </defs>
      {lineData.map(({ trendKey, points, color, lineStyle }) => (
        <animated.g key={trendKey} data-testid="trend-line-group" data-trend-key={trendKey}>
          <Line key={trendKey} points={points} color={color} solid={lineStyle === "solid"} />
          {lineStyle !== "solid" &&
            points
              .filter(
                (point) => valueTrendData || (point.value !== undefined && point.value >= 0 && point.value <= 100),
              )
              .map(({ x, y, id }) => <Circle key={id} x={x} y={y} color={color} />)}
        </animated.g>
      ))}
    </animated.g>
  );
};

const Line = (props: { points: { x: number; y: number }[]; color: string; solid: boolean }) => {
  const { points, color, solid } = props;
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
      pointerEvents="none"
      strokeDasharray={solid ? undefined : "4"}
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

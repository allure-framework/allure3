import type { BarCustomLayerProps, BarDatum, BarItemProps } from "@nivo/bar";
import { useMotionConfig } from "@nivo/core";
import { useTheme } from "@nivo/theming";
import { animated, to, useSpring } from "@react-spring/web";
import { toNumber } from "lodash";
import { createElement } from "preact";
import { createPortal } from "preact/compat";
import { useCallback, useId } from "preact/hooks";
import { useTooltip } from "@/components/Charts/hooks/useTooltip";
import type { LegendItemValue } from "../Legend/LegendItem/types";
import { useBarChartState } from "./context";

export interface BarChartTooltipProps<T extends BarDatum> {
  value: T;
}

const BORDER_RADIUS = 4;
const BORDER_WIDTH = 1;
export const MAX_BAR_WIDTH = 16;

export function getBarWidth(width: number) {
  return Math.min(width, MAX_BAR_WIDTH);
}

// Copy https://github.com/plouc/nivo/blob/0f5ac2fec4da359ec2baf8a8daf8a40c0ff0230d/packages/bar/src/BarItem.tsx
// add border top, border top radius
export const BarChartItem = <T extends BarDatum>({
  bar,
  style,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  legend,
}: Omit<BarItemProps<T>, "tooltip"> & {
  legend: LegendItemValue<T>[];
  indexBy: Extract<keyof T, string>;
}) => {
  const { width, height, color, data, key } = bar;
  const { background: chartBackgroundColor } = useTheme();

  const isBelowZero = data.value < 0;

  const orders: LegendItemValue<T>[] = legend.filter((item) => {
    if (!(item.id in data.data)) {
      return false;
    }

    const itemValue = Number(item.value ?? 0) ?? 0;

    // If this bar is on opposite side of zero,
    // we need to filter out the legend items that are on the same side
    if (isBelowZero) {
      return itemValue < 0;
    }

    return itemValue >= 0;
  });
  const lastOrderId = orders[orders.length - 1]?.id;
  const firstOrderId = orders[0]?.id;

  const isTopBar = data.id === lastOrderId;
  const isLastBar = data.id === firstOrderId;

  const isSmallBar = height < BORDER_RADIUS;

  const id = useId();

  const computedWidth = to(width, (value) => Math.max(value, 0));
  const barWidth = to(width, (value) => {
    if (value < 0) {
      return 0;
    }

    return getBarWidth(value);
  });
  const diff: number = computedWidth.toJSON() - barWidth.toJSON();
  const margin = diff < 0 ? 0 : diff / 2;

  const borderRadius = isSmallBar ? BORDER_RADIUS / 2 : BORDER_RADIUS;

  const hasTopBorderRadius = isTopBar && !isBelowZero;
  const hasGap = !hasTopBorderRadius;

  const hasBottomBorderRadius = isLastBar && isBelowZero;
  const hasBorderRadius = hasTopBorderRadius || hasBottomBorderRadius;

  const borderWidth = BORDER_WIDTH > height ? height : BORDER_WIDTH;

  if (height === 0) {
    return null;
  }

  return (
    <animated.g key={key} transform={style.transform} pointerEvents="none" data-testid="bar-chart-item" data-id={key}>
      <defs>
        <clipPath id={`clip-${id}`}>
          {
            /* Adds top border radius */
            hasTopBorderRadius && (
              <animated.rect
                x={margin}
                y={0}
                width={barWidth}
                height={borderRadius * 2} // Rounding height
                rx={borderRadius}
                ry={borderRadius}
              />
            )
          }
          {
            /* Adds bottom border radius */
            hasBottomBorderRadius && (
              <animated.rect
                x={margin}
                y={height - borderRadius * 2}
                width={barWidth}
                height={borderRadius * 2} // Rounding height
                rx={borderRadius}
                ry={borderRadius}
              />
            )
          }
          {
            /* clip nothing */
            !hasBorderRadius && (
              <animated.rect
                x={margin}
                y={0}
                width={barWidth}
                height={to(height, (value) => Math.max(value, 0))} // Rounding height
              />
            )
          }
          {
            /* Removes bottom border radius */
            hasTopBorderRadius && (
              <animated.rect
                x={margin}
                y={borderRadius}
                width={barWidth}
                height={to(height - borderRadius, (value) => Math.max(value, 0))}
              />
            )
          }
          {
            /* Removes top border radius */
            hasBottomBorderRadius && (
              <animated.rect
                x={margin}
                y={0}
                width={barWidth}
                height={to(height - borderRadius, (value) => Math.max(value, 0))}
              />
            )
          }
        </clipPath>
      </defs>
      <animated.rect
        x={margin}
        width={barWidth}
        height={to(height, (value) => Math.max(value, 0))}
        fill={color}
        aria-label={ariaLabel ? ariaLabel(data) : undefined}
        aria-labelledby={ariaLabelledBy ? ariaLabelledBy(data) : undefined}
        aria-describedby={ariaDescribedBy ? ariaDescribedBy(data) : undefined}
        clipPath={`url(#clip-${id})`}
      />
      {
        /* Adds gap to the bar to separate it from the bar above */
        hasGap && (
          <animated.rect
            x={margin}
            // -borderWidth / 2 to center the gap
            y={-borderWidth / 2}
            width={barWidth}
            height={borderWidth}
            fill={chartBackgroundColor}
          />
        )
      }
    </animated.g>
  );
};

export const BarChartItemHoverLayer = <T extends BarDatum>(
  props: Omit<BarCustomLayerProps<T>, "tooltip"> & {
    tooltip: (props: BarChartTooltipProps<T>) => any;
    indexBy: Extract<keyof T, string>;
    hasValueFn?: (data: T) => boolean;
  },
): any => {
  const {
    isInteractive,
    isFocusable,
    xScale,
    innerHeight,
    tooltip,
    indexBy,
    hasValueFn = (data: T) =>
      Object.entries(data)
        .filter(([key]) => key !== props.indexBy)
        .reduce((acc, [, val]) => acc + toNumber(val ?? 0), 0) > 0,
  } = props;
  const bars = props.bars.slice(0, xScale.domain().length);

  const { handleShowTooltip, isVisible, handleHideTooltip, tooltipRef, data } = useTooltip<T>("left");
  const { animate, config: motionConfig } = useMotionConfig();

  const { opacity: tooltipOpacity } = useSpring({
    opacity: isVisible ? 1 : 0,
    config: { ...motionConfig, duration: 75 },
    immediate: !animate,
  });

  const [firstBar, secondBar] = bars;

  if (!firstBar) {
    return null;
  }

  const width = secondBar?.x ? secondBar.x - firstBar.x : firstBar.width;
  const diff = width - firstBar.width;

  if (!isInteractive) {
    return null;
  }

  return (
    <animated.g data-testid="hover-layer">
      {bars.map((bar, index) => {
        const x = bar.x - diff / 2;

        const hasValue = hasValueFn(bar.data.data);

        if (!hasValue) {
          return null;
        }

        return (
          <BarChartItemHoverArea
            key={index}
            x={x}
            width={width}
            height={innerHeight}
            value={bar.data.data}
            indexBy={indexBy}
            absX={bar.absX}
            absY={bar.absY}
            isInteractive={isInteractive}
            isFocusable={isFocusable}
            onTooltipShow={handleShowTooltip}
            onTooltipHide={handleHideTooltip}
          />
        );
      })}
      {createPortal(
        <animated.div ref={tooltipRef} style={{ display: tooltipOpacity ? "block" : "none", opacity: tooltipOpacity }}>
          {isVisible && data && createElement(tooltip, { value: data })}
        </animated.div>,
        document.body,
      )}
    </animated.g>
  );
};

const BarChartItemHoverArea = <T extends BarDatum>({
  absX,
  absY,
  x,
  width,
  height,
  value,
  isInteractive = true,
  isFocusable = true,
  indexBy,
  onTooltipShow,
  onTooltipHide,
}: {
  absX: number;
  absY: number;
  x: number;
  width: number;
  height: number;
  value: T;
  isInteractive?: boolean;
  isFocusable?: boolean;
  indexBy: Extract<keyof T, string>;
  onTooltipShow: (target: HTMLElement, data: T) => void;
  onTooltipHide: (target: HTMLElement) => void;
}) => {
  const [hoverState, setHoverState] = useBarChartState();
  const { animate, config: motionConfig } = useMotionConfig();

  const indexByValue = value[indexBy];
  const isHovered = hoverState === String(indexByValue);

  const { fill: animatedFill } = useSpring({
    from: { fill: "#ffffff00" },
    to: { fill: "var(--bg-control-flat-medium)" },
    config: { ...motionConfig, duration: 150 },
    reverse: !isHovered,
    immediate: !animate,
  });

  const handleTooltip = useCallback(
    (event: MouseEvent) => {
      onTooltipShow(event.target as HTMLElement, value);
    },
    [onTooltipShow, value],
  );

  const handleMouseEnter = useCallback(
    (event: MouseEvent) => {
      onTooltipShow(event.target as HTMLElement, value);
      setHoverState(String(indexByValue));
    },
    [onTooltipShow, value, setHoverState, indexByValue],
  );

  const handleMouseLeave = useCallback(
    (event: MouseEvent) => {
      onTooltipHide(event.target as HTMLElement);
      setHoverState(undefined);
    },
    [onTooltipHide, setHoverState],
  );

  const handleFocus = useCallback(
    (event: FocusEvent) => {
      onTooltipShow(event.target as HTMLElement, value);
      setHoverState(String(indexByValue));
    },
    [onTooltipShow, value, absX, width, absY, setHoverState, indexByValue],
  );

  const handleBlur = useCallback(
    (event: FocusEvent) => {
      onTooltipHide(event.target as HTMLElement);
      setHoverState(undefined);
    },
    [onTooltipHide, setHoverState],
  );

  return (
    <animated.rect
      x={x}
      y={0}
      data-testid="hover-rect"
      width={width}
      height={height}
      fill={animatedFill}
      onMouseMove={isInteractive ? handleTooltip : undefined}
      onMouseEnter={isInteractive ? handleMouseEnter : undefined}
      onMouseLeave={isInteractive ? handleMouseLeave : undefined}
      onFocus={isInteractive && isFocusable ? handleFocus : undefined}
      onBlur={isInteractive && isFocusable ? handleBlur : undefined}
    />
  );
};

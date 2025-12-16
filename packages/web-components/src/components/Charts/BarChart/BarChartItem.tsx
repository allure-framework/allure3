import type { BarCustomLayerProps, BarDatum, BarItemProps } from "@nivo/bar";
import { useMotionConfig } from "@nivo/core";
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
// Slightly larger than horizontal border so that it looks the same as horizontal border
// Seems like it's an optical illusion
const VERTICAL_BORDER_WIDTH = 2;
const MIN_BAR_SIZE_FOR_CLIPPING = 4;

const BAR_SIZE_WIDTH = {
  s: 16,
  m: 24,
  l: 32,
};

export const getBarWidth = (width: number, barSize: "s" | "m" | "l") => {
  return Math.min(width, BAR_SIZE_WIDTH[barSize]);
};

export const getRadius = (size: number) => {
  if (size <= BORDER_RADIUS) {
    return 0;
  }

  if (size <= BAR_SIZE_WIDTH.s / 3) {
    return 1;
  }

  if (size <= BAR_SIZE_WIDTH.s / 2) {
    return 1.5;
  }

  if (size < BAR_SIZE_WIDTH.s) {
    return 2;
  }

  if (size >= BAR_SIZE_WIDTH.s && size < BAR_SIZE_WIDTH.m) {
    return 4;
  }

  if (size >= BAR_SIZE_WIDTH.m) {
    return 6;
  }

  return 0;
};

// Copy https://github.com/plouc/nivo/blob/0f5ac2fec4da359ec2baf8a8daf8a40c0ff0230d/packages/bar/src/BarItem.tsx
// add border top, border top radius
export const BarChartItem = <T extends BarDatum>(
  props: Omit<BarItemProps<T>, "tooltip"> & {
    legend: LegendItemValue<T>[];
    indexBy: Extract<keyof T, string>;
    barSize: "s" | "m" | "l";
    layout?: "vertical" | "horizontal";
  },
) => {
  const { bar, style, ariaLabel, ariaLabelledBy, ariaDescribedBy, legend, barSize, layout = "horizontal" } = props;
  const { width, height, color, data, key } = bar;

  const isBelowZero = data.value < 0;
  const isInverted = layout === "horizontal";

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

  const isBarredBar = data.id === lastOrderId;

  const id = useId();

  if (height <= 0 || width <= 0) {
    return null;
  }

  const barWidth = getBarWidth(width, barSize);
  const barX = Math.max(width - barWidth, 0) / 2;
  const barY = 0;

  const borderRadius = getRadius(barWidth);

  const borderWidth = BORDER_WIDTH > height ? height : BORDER_WIDTH;

  const hasTopBorderRadius = isBarredBar && !isBelowZero;
  const hasBottomBorderRadius = isBarredBar && isBelowZero;
  const hasBorderRadius = hasTopBorderRadius || hasBottomBorderRadius;

  const hasGapBottom = !hasBottomBorderRadius;
  const hasGapTop = !hasTopBorderRadius;

  const heightIsLessThanBorderRadius = height < borderRadius * 2;
  const shouldHalfWidth = heightIsLessThanBorderRadius && hasBorderRadius;
  const barWidthConsideringBorder = shouldHalfWidth ? barWidth - borderRadius : barWidth;

  const noClip = height <= MIN_BAR_SIZE_FOR_CLIPPING;

  if (isInverted) {
    const barHeight = getBarWidth(height, barSize);

    const offsetY = Math.max(height - barHeight, 0) / 2;

    const borderRadiusInverted = getRadius(barHeight);
    const radiusRectW = borderRadiusInverted * 2;
    const noClipInverted = width <= VERTICAL_BORDER_WIDTH * 2;
    const borderWidthInverted = VERTICAL_BORDER_WIDTH > width ? width : VERTICAL_BORDER_WIDTH;
    const hasLeftBorderRadius = hasBottomBorderRadius;
    const hasRightBorderRadius = hasTopBorderRadius;
    const barRectW = width;
    const borderSize = borderWidthInverted / 2;

    return (
      <animated.g key={key} transform={style.transform} pointerEvents="none" data-testid="bar-chart-item" data-id={key}>
        <defs>
          <clipPath id={`clip-${id}`}>
            <animated.rect
              data-testid="gap"
              x={hasLeftBorderRadius ? borderRadiusInverted : borderSize}
              y={offsetY}
              width={hasRightBorderRadius ? barRectW - borderRadiusInverted : barRectW - borderSize}
              height={barHeight}
            />
            {hasRightBorderRadius && (
              <animated.rect
                data-testid="right-border-radius"
                x={barRectW - radiusRectW}
                y={offsetY}
                width={radiusRectW}
                height={barHeight}
                rx={borderRadiusInverted}
                ry={borderRadiusInverted}
              />
            )}
            {hasLeftBorderRadius && (
              <animated.rect
                data-testid="left-border-radius"
                x={0}
                y={offsetY}
                width={radiusRectW}
                height={barHeight}
                rx={borderRadiusInverted}
                ry={borderRadiusInverted}
              />
            )}
          </clipPath>
        </defs>
        <animated.rect
          clipPath={noClipInverted ? undefined : `url(#clip-${id})`}
          x={0}
          y={offsetY}
          width={barRectW}
          height={barHeight}
          fill={color}
        />
      </animated.g>
    );
  }

  return (
    <animated.g key={key} transform={style.transform} pointerEvents="none" data-testid="bar-chart-item" data-id={key}>
      <defs>
        <clipPath id={`clip-${id}`}>
          {
            /* Adds top border radius */
            hasTopBorderRadius && !heightIsLessThanBorderRadius && (
              <animated.rect
                data-testid="adds-top-border-radius"
                x={barX}
                y={barY}
                width={barWidth}
                height={borderRadius * 2}
                rx={borderRadius}
                ry={borderRadius}
              />
            )
          }
          {
            /* Adds bottom border radius */
            hasBottomBorderRadius && !heightIsLessThanBorderRadius && (
              <animated.rect
                data-testid="adds-bottom-border-radius"
                x={barX}
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
                data-testid="!hasBorderRadius"
                x={barX}
                y={hasGapTop ? borderWidth / 2 : 0}
                width={barWidth}
                height={Math.max(height - (hasGapTop ? borderWidth / 2 : 0) - (hasGapBottom ? borderWidth / 2 : 0), 0)}
              />
            )
          }
          {
            /* Removes bottom border radius */
            hasTopBorderRadius && (
              <animated.rect
                data-testid="hasTopBorderRadius"
                x={barX}
                y={borderRadius}
                width={barWidth}
                height={Math.max(height - borderRadius - (hasGapBottom ? borderWidth / 2 : 0), 0)}
              />
            )
          }
          {
            /* Removes top border radius */
            hasBottomBorderRadius && (
              <animated.rect
                data-testid="hasBottomBorderRadius"
                x={barX}
                y={hasGapTop ? borderWidth / 2 : 0}
                width={barWidth}
                height={Math.max(height - borderRadius, 0)}
              />
            )
          }
        </clipPath>
      </defs>
      <animated.rect
        x={shouldHalfWidth ? barX + borderRadius / 2 : barX}
        y={barY}
        width={barWidthConsideringBorder}
        height={Math.max(height, 0)}
        fill={color}
        aria-label={ariaLabel ? ariaLabel(data) : undefined}
        aria-labelledby={ariaLabelledBy ? ariaLabelledBy(data) : undefined}
        aria-describedby={ariaDescribedBy ? ariaDescribedBy(data) : undefined}
        clipPath={noClip ? undefined : `url(#clip-${id})`}
      />
    </animated.g>
  );
};

export const BarChartItemHoverLayer = <T extends BarDatum>(
  props: Omit<BarCustomLayerProps<T>, "tooltip"> & {
    tooltip: (props: BarChartTooltipProps<T>) => any;
    indexBy: Extract<keyof T, string>;
    hasValueFn?: (data: T) => boolean;
    layout?: "vertical" | "horizontal";
  },
): any => {
  const {
    isInteractive,
    isFocusable,
    innerHeight,
    innerWidth,
    tooltip,
    indexBy,
    layout = "vertical",
    bars: allBars,
    hasValueFn = (item: T) =>
      Object.entries(item)
        .filter(([key]) => key !== props.indexBy)
        .reduce((acc, [, val]) => acc + toNumber(val ?? 0), 0) > 0,
  } = props;
  const isInverted = layout === "horizontal";
  const { handleShowTooltip, isVisible, handleHideTooltip, tooltipRef, data } = useTooltip<T>(
    isInverted ? "bottom" : "left",
  );
  const { animate, config: motionConfig } = useMotionConfig();

  const { opacity: tooltipOpacity } = useSpring({
    opacity: isVisible ? 1 : 0,
    config: { ...motionConfig, duration: 75 },
    immediate: !animate,
  });

  if (!isInteractive) {
    return null;
  }

  const barsCount = Math.max(...allBars.map((bar) => bar.data.index + 1));

  const bars = allBars.slice(0, barsCount);

  if (bars.length <= 0) {
    return null;
  }

  const [firstBar, secondBar] = bars;

  if (!firstBar) {
    return null;
  }

  const width = secondBar?.x ? secondBar.x - firstBar.x : firstBar.width;
  const diff = width - firstBar.width;
  const height = secondBar?.y ? firstBar.y - secondBar.y : firstBar.height;
  const heightDiff = height - firstBar.height;

  return (
    <animated.g data-testid="hover-layer">
      {bars.map((bar, index) => {
        const x = bar.x - diff / 2;
        const y = bar.y - heightDiff / 2;

        const hasValue = hasValueFn(bar.data.data);

        if (!hasValue) {
          return null;
        }

        return (
          <BarChartItemHoverArea
            key={index}
            x={isInverted ? 0 : x}
            y={isInverted ? y : 0}
            width={isInverted ? innerWidth : width}
            height={isInverted ? height : innerHeight}
            value={bar.data.data}
            indexBy={indexBy}
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
  x,
  y,
  width,
  height,
  value,
  isInteractive = true,
  isFocusable = true,
  indexBy,
  onTooltipShow,
  onTooltipHide,
}: {
  x: number;
  y: number;
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
    [onTooltipShow, value, setHoverState, indexByValue],
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
      y={y}
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

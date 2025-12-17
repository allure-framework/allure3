import type { BarCustomLayerProps, BarDatum, BarSvgProps, ComputedBarDatum } from "@nivo/bar";
import { useMotionConfig } from "@nivo/core";
import { animated, useSpring } from "@react-spring/web";
import { toNumber } from "lodash";
import { createContext, createElement } from "preact";
import { createPortal } from "preact/compat";
import { useCallback, useContext, useId, useMemo } from "preact/hooks";
import { useTooltip } from "@/components/Charts/hooks/useTooltip";
import type { LegendItemValue } from "../Legend/LegendItem/types.js";
import { useBarChartState } from "./context.js";

export interface BarChartTooltipProps<T extends BarDatum> {
  value: T;
}

const BORDER_RADIUS = 4;
const BORDER_WIDTH = 1;

const BAR_SIZE_WIDTH = {
  s: 16,
  m: 24,
  l: 32,
};

export const getBarSize = (size: number, barSize: "s" | "m" | "l") => {
  return Math.min(size, BAR_SIZE_WIDTH[barSize]);
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

type BarGroup<T extends BarDatum> = {
  id: string;
  bars: ComputedBarDatum<T>[];
  x: number;
  y: number;
  width: number;
  height: number;
};

const splitBarsIntoGroups = <T extends BarDatum>(
  bars: readonly ComputedBarDatum<T>[],
  indexBy: Extract<keyof T, string>,
  layout: "vertical" | "horizontal",
) => {
  const groups = new Map<string, BarGroup<T>>();

  for (const bar of bars) {
    const groupId = bar.data.data[indexBy] as string;

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        bars: [],
        x: Infinity,
        y: Infinity,
        width: 0,
        height: 0,
      });
    }

    const group = groups.get(groupId)!;

    group.bars.push(bar);

    group.x = Math.min(group.x, bar.x);
    group.y = Math.min(group.y, bar.y);
    // In vertical layout the groups width is the max width of the bar it consists of
    group.width = layout === "vertical" ? Math.max(group.width, bar.width) : group.width + bar.width;
    // In horizontal layout the groups height is the max height of the bar it consists of
    group.height = layout === "horizontal" ? Math.max(group.height, bar.height) : group.height + bar.height;
  }

  return Array.from(groups.values());
};

const BarGroupsContext = createContext<{
  barSize: "s" | "m" | "l";
  layout: "vertical" | "horizontal";
} | null>(null);

const useBarGroupsContext = () => {
  const context = useContext(BarGroupsContext);

  if (!context) {
    throw new Error("useBarContext must be used within a BarContext");
  }

  return context;
};

export const BarChartBars = <T extends BarDatum>(
  props: BarCustomLayerProps<T> &
    Pick<BarSvgProps<T>, "layout"> & {
      legend: LegendItemValue<T>[];
      indexBy: Extract<keyof T, string>;
      barSize: "s" | "m" | "l";
    },
) => {
  const { bars, indexBy, layout, barSize } = props;

  const groups = splitBarsIntoGroups<T>(bars, indexBy, layout ?? "vertical");
  const offsetY = Math.min(...groups.map((group) => group.y));
  const offsetX = Math.min(...groups.map((group) => group.x));

  return (
    <BarGroupsContext.Provider value={{ barSize, layout: layout ?? "vertical" }}>
      <animated.g data-testid="bars" pointerEvents="none">
        {groups.map((group) => (
          <Group key={group.id} group={group} offsetY={offsetY} offsetX={offsetX} />
        ))}
      </animated.g>
    </BarGroupsContext.Provider>
  );
};

const Group = <T extends BarDatum>(props: { group: BarGroup<T>; offsetY: number; offsetX: number }) => {
  const { group } = props;
  const { barSize, layout } = useBarGroupsContext();
  const { animate, config: motionConfig } = useMotionConfig();
  const id = useId();
  const useHeightAsSizeGuide = layout === "horizontal";

  const groupSizeBasedOnHeight = getBarSize(group.height, barSize);
  const groupSizeBasedOnWidth = getBarSize(group.width, barSize);

  const widthDiff = group.width - groupSizeBasedOnWidth;
  const heightDiff = group.height - groupSizeBasedOnHeight;

  // When layout is horizontal, the X coordinate is the same as the group X coordinate.
  const groupX = useHeightAsSizeGuide ? group.x : group.x + widthDiff / 2;
  // When layout is vertical, the Y coordinate is the same as the group Y coordinate.
  const groupY = useHeightAsSizeGuide ? group.y + heightDiff / 2 : group.y;
  const groupWidth = useHeightAsSizeGuide ? group.width : groupSizeBasedOnWidth;
  const groupHeight = useHeightAsSizeGuide ? groupSizeBasedOnHeight : group.height;
  const borderRadius = getRadius(useHeightAsSizeGuide ? groupSizeBasedOnHeight : groupSizeBasedOnWidth);

  const { transform } = useSpring({
    transform: `translate(${groupX}, ${groupY})`,
    config: motionConfig,
    immediate: !animate,
  });

  const bars = useMemo(() => {
    // Do not render empty bars
    const filteredBars = group.bars.filter((bar) => bar.width > 0 && bar.height > 0);

    // When layout is horizontal, sort bars by X coordinate
    if (layout === "horizontal") {
      return filteredBars.sort((a, b) => a.x - b.x);
    }

    // When layout is vertical, sort bars by Y coordinate
    return filteredBars.sort((a, b) => a.y - b.y);
  }, [group.bars, layout]);

  const noClip = layout === "horizontal" ? groupWidth < borderRadius * 2 : groupHeight < borderRadius * 2;

  return (
    <animated.g
      clipPath={noClip ? undefined : `url(#clip-${id})`}
      transform={transform}
      data-testid="group"
      data-id={group.id}
    >
      {!noClip && (
        <defs>
          <clipPath id={`clip-${id}`}>
            <animated.rect x={0} y={0} width={groupWidth} height={groupHeight} rx={borderRadius} ry={borderRadius} />
          </clipPath>
        </defs>
      )}
      {bars.map((bar, index) => (
        <Bar
          id={bar.data.id}
          key={bar.data.id}
          x={useHeightAsSizeGuide ? bar.x - groupX : 0}
          y={useHeightAsSizeGuide ? 0 : bar.y - groupY}
          width={useHeightAsSizeGuide ? bar.width : groupWidth}
          height={useHeightAsSizeGuide ? groupHeight : bar.height}
          fill={bar.color}
          isFirst={index === 0}
          isLast={index === bars.length - 1}
        />
      ))}
    </animated.g>
  );
};

const Bar = (props: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  isFirst: boolean;
  isLast: boolean;
  id: string | number;
}) => {
  const { isFirst, isLast, id, ...styleProps } = props;
  const { layout } = useBarGroupsContext();
  const { animate, config: motionConfig } = useMotionConfig();
  const size = layout === "horizontal" ? styleProps.width : styleProps.height;
  const borderWidth = BORDER_WIDTH;

  const hasGapStart = !isFirst && size > borderWidth * 2;
  const hasGapEnd = !isLast && size > borderWidth * 2;

  let width = styleProps.width;
  let height = styleProps.height;
  let x = styleProps.x;
  let y = styleProps.y;

  if (layout === "horizontal") {
    if (hasGapStart && hasGapEnd) {
      x += borderWidth / 2;
      width -= borderWidth / 2;
    }

    if (hasGapEnd) {
      width -= borderWidth / 2;
    }
  }

  if (layout === "vertical") {
    if (hasGapStart) {
      y += borderWidth / 2;
      height -= borderWidth / 2;
    }
    if (hasGapEnd) {
      height -= borderWidth / 2;
    }
  }

  const anumatedProps = useSpring({
    x,
    y,
    width,
    height,
    config: motionConfig,
    immediate: !animate,
  });
  return <animated.rect {...anumatedProps} fill={styleProps.fill} data-testid="bar" data-id={id} />;
};

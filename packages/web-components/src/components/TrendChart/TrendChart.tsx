import { ResponsiveLine } from "@nivo/line";
import type { Point } from "@nivo/line";
import type { FunctionalComponent } from "preact";
import { defaultTrendChartConfig } from "./config";
import { TrendChartKind } from "./types";
import type { TrendChartProps, Slice, MeshTrendChartProps, SlicesTrendChartProps } from "./types";
import { getKindConfig } from "./utils";
import { useCallback } from "preact/hooks";

export const TrendChart: FunctionalComponent<TrendChartProps> = ({
  kind = TrendChartKind.mesh,
  width = 600,
  height = 400,
  rootArialLabel,
  ...restProps
}) => {
  const kindConfig = getKindConfig(kind);

  const handleClick = useCallback((data: Point | Slice, event: MouseEvent): void => {
    if (kind === TrendChartKind.mesh) {
      return (restProps as MeshTrendChartProps)?.onClick?.(data as Point, event);
    } else if ([TrendChartKind.slicesX, TrendChartKind.slicesY].includes(kind)) {
      return (restProps as SlicesTrendChartProps)?.onSliceClick?.(data as Slice, event);
    }
  }, [kind, restProps]);

  const handleTouchEnd = useCallback((data: Point | Slice, event: TouchEvent): void => {
    if (kind === TrendChartKind.mesh) {
      return (restProps as MeshTrendChartProps)?.onTouchEnd?.(data as Point, event);
    } else if ([TrendChartKind.slicesX, TrendChartKind.slicesY].includes(kind)) {
      return (restProps as SlicesTrendChartProps)?.onSliceTouchEnd?.(data as Slice, event);
    }
  }, [kind, restProps]);

  return (
    // Accessible container for the trend diagram
    <div role="img" aria-label={rootArialLabel} tabIndex={0} style={{ width, height }}>
      <ResponsiveLine
        {...defaultTrendChartConfig}
        {...kindConfig}
        {...restProps}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
};

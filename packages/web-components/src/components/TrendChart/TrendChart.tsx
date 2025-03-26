import { ResponsiveLine } from "@nivo/line";
import type { Point } from "@nivo/line";
import type { FunctionalComponent } from "preact";
import { useCallback } from "preact/hooks";
import { defaultTrendChartConfig } from "./config";
import * as styles from "./styles.scss";
import { TrendChartKind } from "./types";
import type { MeshTrendChartProps, Slice, SlicesTrendChartProps, TrendChartProps } from "./types";
import { getKindConfig } from "./utils";

export const TrendChart: FunctionalComponent<TrendChartProps> = ({
  kind = TrendChartKind.Mesh,
  width = 600,
  height = 400,
  emptyLabel = "No data available",
  emptyAriaLabel = "No data available",
  rootAriaLabel,
  ...restProps
}) => {
  const kindConfig = getKindConfig(kind);

  const handleClick = useCallback(
    (data: Point | Slice, event: MouseEvent): void => {
      if (kind === TrendChartKind.Mesh) {
        (restProps as MeshTrendChartProps)?.onClick?.(data as Point, event);
      } else if ([TrendChartKind.SlicesX, TrendChartKind.SlicesY].includes(kind)) {
        (restProps as SlicesTrendChartProps)?.onSliceClick?.(data as Slice, event);
      }
    },
    [kind, restProps],
  );

  const handleTouchEnd = useCallback(
    (data: Point | Slice, event: TouchEvent): void => {
      if (kind === TrendChartKind.Mesh) {
        (restProps as MeshTrendChartProps)?.onTouchEnd?.(data as Point, event);
      } else if ([TrendChartKind.SlicesX, TrendChartKind.SlicesY].includes(kind)) {
        (restProps as SlicesTrendChartProps)?.onSliceTouchEnd?.(data as Slice, event);
      }
    },
    [kind, restProps],
  );

  // Check if data is empty
  if (!restProps.data || restProps.data.length === 0 || restProps.data.every((series) => !series.data?.length)) {
    return (
      <div
        role="img"
        aria-label={emptyAriaLabel}
        className={styles["empty-label"]}
        style={{
          width,
          height,
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    // Accessible container for the trend diagram
    <div role="img" aria-label={rootAriaLabel} tabIndex={0} style={{ width, height }}>
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

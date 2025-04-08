import { ResponsiveLine } from "@nivo/line";
import type { Point } from "@nivo/line";
import type { FunctionalComponent } from "preact";
import { useCallback, useMemo } from "preact/hooks";
import { defaultTrendChartConfig, defaultTrendChartAxisBottomConfig } from "./config";
import * as styles from "./styles.scss";
import { TrendChartKind } from "./types";
import type { MeshTrendChartProps, Slice, SlicesTrendChartProps, TrendChartProps } from "./types";
import { getKindConfig } from "./utils";
import { nivoTheme } from "./theme";

export const TrendChart: FunctionalComponent<TrendChartProps> = ({
  kind = TrendChartKind.Mesh,
  width = 600,
  height = 400,
  emptyLabel = "No data available",
  emptyAriaLabel = "No data available",
  axisBottom,
  rootAriaLabel,
  data: items,
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

  // Fix for X-axis values order
  const tickValues = useMemo(() => {
    const xValues = items?.flatMap((item) => item.data?.map((d) => d.x));

    return [...new Set(xValues)].sort((a, b) => {
      const aStr = a?.toString() || "";
      const bStr = b?.toString() || "";

      // Split strings into chunks of numbers and non-numbers
      const aParts = aStr.split(/(\d+)/).filter(Boolean);
      const bParts = bStr.split(/(\d+)/).filter(Boolean);

      // Compare each part
      for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
        const aNum = parseInt(aParts[i], 10);
        const bNum = parseInt(bParts[i], 10);

        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) {
            return aNum - bNum;
          }
        } else {
          const comp = aParts[i].localeCompare(bParts[i]);
          if (comp !== 0) {
            return comp;
          }
        }
      }

      return aParts.length - bParts.length;
    });
  }, [items]);

  // Check if data is empty
  if (!items || items.length === 0 || items.every((series) => !series.data?.length)) {
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
        data={items}
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
        axisBottom={{
          ...defaultTrendChartAxisBottomConfig,
          ...axisBottom,
          tickValues,
        }}
        theme={nivoTheme} // Pass the theme object to ResponsiveLine
      />
    </div>
  );
};

import { ResponsiveHeatMap } from "@nivo/heatmap";
import type { FunctionalComponent } from "preact";
import { useCallback, useMemo } from "preact/hooks";
import { useTheme } from "@/components/ThemeProvider/index.js";
import { EmptyDataStub } from "../EmptyDataStub/index.js";
import { CHART_MOTION_CONFIG, CHART_THEME, REDUCE_MOTION } from "../config.js";
import { getColorScale } from "../utils.js";
import { Cell } from "./Cell.js";
import { HeatMapTooltip } from "./Tooltip.js";
import {
  DEFAULT_HEAT_MAP_EMPTY_ARIA_LABEL,
  DEFAULT_HEAT_MAP_EMPTY_LABEL,
  DEFAULT_HEAT_MAP_FORCE_SQUARE,
  DEFAULT_HEAT_MAP_HEIGHT,
  DEFAULT_HEAT_MAP_VALUE_FORMAT,
  DEFAULT_HEAT_MAP_WIDTH,
  DEFAULT_HEAT_MAP_X_INNER_PADDING,
  DEFAULT_HEAT_MAP_Y_INNER_PADDING,
  defaultHeatMapAxisLeftConfig,
  defaultHeatMapAxisTopConfig,
  defaultHeatMapLegendConfig,
  defaultHeatMapMarginConfig,
} from "./config.js";
import styles from "./styles.scss";
import type { HeatMapProps } from "./types.js";

const useGetColor = (currentTheme: string = "light") => {
  const scale = useMemo(() => {
    return getColorScale(
      [0, 1],
      [
        "var(--bg-support-castor)",
        "var(--bg-support-atlas-heavy)",
        "var(--bg-support-atlas)",
        "var(--bg-support-atlas-heavy)",
        "var(--bg-support-capella)",
      ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- this is intentional
  }, [currentTheme]);

  return useCallback((value: number) => scale(value), [scale]);
};

export const HeatMap: FunctionalComponent<HeatMapProps> = ({
  width = DEFAULT_HEAT_MAP_WIDTH,
  height = DEFAULT_HEAT_MAP_HEIGHT,
  data,
  rootAriaLabel,
  emptyLabel = DEFAULT_HEAT_MAP_EMPTY_LABEL,
  emptyAriaLabel = DEFAULT_HEAT_MAP_EMPTY_ARIA_LABEL,
  margin = defaultHeatMapMarginConfig,
  axisLeft = defaultHeatMapAxisLeftConfig,
  axisTop = defaultHeatMapAxisTopConfig,
  xInnerPadding = DEFAULT_HEAT_MAP_X_INNER_PADDING,
  yInnerPadding = DEFAULT_HEAT_MAP_Y_INNER_PADDING,
  legends = [defaultHeatMapLegendConfig],
  forceSquare = DEFAULT_HEAT_MAP_FORCE_SQUARE,
  valueFormat = DEFAULT_HEAT_MAP_VALUE_FORMAT,
  ...restProps
}) => {
  const isEmpty = useMemo(() => data.length === 0, [data]);
  const currentTheme = useTheme();
  const getColor = useGetColor(currentTheme);

  if (isEmpty) {
    return <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyAriaLabel} />;
  }

  return (
    <div role="img" aria-label={rootAriaLabel} tabIndex={0} style={{ width, height }} className={styles.heatMap}>
      <ResponsiveHeatMap
        data={data}
        margin={margin}
        axisBottom={null}
        axisRight={null}
        axisLeft={axisLeft}
        axisTop={axisTop}
        xInnerPadding={xInnerPadding}
        yInnerPadding={yInnerPadding}
        legends={legends}
        forceSquare={forceSquare}
        theme={CHART_THEME}
        motionConfig={CHART_MOTION_CONFIG}
        animate={!REDUCE_MOTION}
        valueFormat={valueFormat}
        colors={(n) => getColor(n.data.y ?? 0)}
        labelTextColor={"var(--constant-on-text-primary)"}
        tooltip={HeatMapTooltip}
        emptyColor={"var(--bg-control-secondary)"}
        inactiveOpacity={0}
        borderRadius={4}
        {...restProps}
      />
    </div>
  );
};

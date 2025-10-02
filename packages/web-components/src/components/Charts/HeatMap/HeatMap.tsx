import { ResponsiveHeatMap } from "@nivo/heatmap";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { EmptyDataStub } from "../EmptyDataStub/index.js";
import {
  defaultHeatMapMarginConfig,
  DEFAULT_HEAT_MAP_EMPTY_COLOR,
  DEFAULT_HEAT_MAP_HEIGHT,
  DEFAULT_HEAT_MAP_WIDTH,
  DEFAULT_HEAT_MAP_EMPTY_LABEL,
  DEFAULT_HEAT_MAP_EMPTY_ARIA_LABEL,
  defaultHeatMapAxisLeftConfig,
  defaultHeatMapAxisTopConfig,
  DEFAULT_HEAT_MAP_X_INNER_PADDING,
  DEFAULT_HEAT_MAP_Y_INNER_PADDING,
  defaultHeatMapLegendConfig,
  DEFAULT_HEAT_MAP_FORCE_SQUARE,
} from "./config.js";
import styles from "./styles.scss";
import type { HeatMapProps } from "./types.js";

export const HeatMap: FunctionalComponent<HeatMapProps> = ({
  width = DEFAULT_HEAT_MAP_WIDTH,
  height = DEFAULT_HEAT_MAP_HEIGHT,
  data,
  rootAriaLabel,
  emptyLabel = DEFAULT_HEAT_MAP_EMPTY_LABEL,
  emptyAriaLabel = DEFAULT_HEAT_MAP_EMPTY_ARIA_LABEL,
  emptyColor = DEFAULT_HEAT_MAP_EMPTY_COLOR,
  margin = defaultHeatMapMarginConfig,
  axisLeft = defaultHeatMapAxisLeftConfig,
  axisTop = defaultHeatMapAxisTopConfig,
  xInnerPadding = DEFAULT_HEAT_MAP_X_INNER_PADDING,
  yInnerPadding = DEFAULT_HEAT_MAP_Y_INNER_PADDING,
  legends = [defaultHeatMapLegendConfig],
  forceSquare = DEFAULT_HEAT_MAP_FORCE_SQUARE,
  ...restProps
}) => {
  const isEmpty = useMemo(() => data.length === 0, [data]);

  if (isEmpty) {
    return <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyAriaLabel} />;
  }

  return (
    <div role="img" aria-label={rootAriaLabel} tabIndex={0} style={{ width, height }} className={styles.heatMap}>
      <ResponsiveHeatMap
        data={data}
        emptyColor={emptyColor}
        margin={margin}
        axisBottom={null}
        axisRight={null}
        axisLeft={axisLeft}
        axisTop={axisTop}
        xInnerPadding={xInnerPadding}
        yInnerPadding={yInnerPadding}
        legends={legends}
        forceSquare={forceSquare}
        {...restProps}
      />
    </div>
  );
};

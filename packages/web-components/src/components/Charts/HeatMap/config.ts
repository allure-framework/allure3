import type { AxisProps } from "@nivo/axes";
import type { HeatMapLegendConfig } from "./types";

// Named constants for default values
export const defaultHeatMapMarginConfig = { top: 60, right: 90, bottom: 60, left: 90 };
export const DEFAULT_HEAT_MAP_EMPTY_COLOR = "#E0E0E0";
export const DEFAULT_HEAT_MAP_HEIGHT = 400;
export const DEFAULT_HEAT_MAP_WIDTH = "100%";
export const DEFAULT_HEAT_MAP_EMPTY_LABEL = "No data available";
export const DEFAULT_HEAT_MAP_EMPTY_ARIA_LABEL = "No data available";
export const DEFAULT_HEAT_MAP_X_INNER_PADDING = 0.05;
export const DEFAULT_HEAT_MAP_Y_INNER_PADDING = 0.05;
export const DEFAULT_HEAT_MAP_FORCE_SQUARE = true;

// Default axis configurations
export const defaultHeatMapAxisLeftConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 0,
};

export const defaultHeatMapAxisTopConfig: AxisProps = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: -90,
};

export const defaultHeatMapLegendConfig: HeatMapLegendConfig = {
  anchor: "bottom",
  translateX: 0,
  translateY: 30,
  length: 400,
  thickness: 8,
  direction: "row",
  tickPosition: "after",
  tickSize: 3,
  tickSpacing: 4,
  tickOverlap: false,
  tickFormat: ">-.2s",
  title: "Value",
  titleAlign: "middle",
  titleOffset: 4
};

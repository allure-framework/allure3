import type { DefaultHeatMapDatum, HeatMapDatum, HeatMapSvgProps } from "@nivo/heatmap";
import type { AnchoredContinuousColorsLegendProps } from "@nivo/legends";
import type { CSSProperties } from "preact/compat";

type ResponsiveHeatMapProps<
  Datum extends HeatMapDatum = DefaultHeatMapDatum,
  ExtraProps extends object = Record<string, unknown>,
> = Omit<HeatMapSvgProps<Datum, ExtraProps>, "width" | "height">;

// Base props extending Nivo's ResponsiveHeatMapProps
type BaseHeatMapProps<
  Datum extends HeatMapDatum = DefaultHeatMapDatum,
  ExtraProps extends object = Record<string, unknown>,
> = Omit<ResponsiveHeatMapProps<Datum, ExtraProps>, "width" | "height" | "colors">;

export interface HeatMapProps<
  Datum extends HeatMapDatum = DefaultHeatMapDatum,
  ExtraProps extends object = Record<string, unknown>,
> extends BaseHeatMapProps<Datum, ExtraProps> {
  // Container dimensions (parent controls)
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];

  // Accessibility
  rootAriaLabel?: string;
  emptyLabel?: string;
  emptyAriaLabel?: string;
}

export type HeatMapLegendConfig = Omit<
  AnchoredContinuousColorsLegendProps,
  "scale" | "containerWidth" | "containerHeight"
>;

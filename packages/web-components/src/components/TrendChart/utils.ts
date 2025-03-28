import type { ScaleSymlogSpec } from "@nivo/scales";
import { SYMLOG_SCALE_CONSTANT } from "./constants";
import { TrendChartKind } from "./types";
import type { Serie, SymlogScaleOptions, TrendChartKindConfig } from "./types";

export const getKindConfig = (kind: TrendChartKind): TrendChartKindConfig => {
  switch (kind) {
    case TrendChartKind.SlicesX:
      return { useMesh: false, enableSlices: "x" as const };
    case TrendChartKind.SlicesY:
      return { useMesh: false, enableSlices: "y" as const };
    case TrendChartKind.Mesh:
    default:
      return { useMesh: true, enableSlices: undefined };
  }
};

export const makeSymlogScale = (min: number, max: number, options?: SymlogScaleOptions): ScaleSymlogSpec => {
  const { constant = SYMLOG_SCALE_CONSTANT, ...restOptions } = options ?? {};

  return {
    type: "symlog",
    min,
    max,
    constant,
    ...restOptions,
  };
};

export const makeSymlogScaleBySeries = (series: Serie[], options?: SymlogScaleOptions): ScaleSymlogSpec => {
  const flattenedData = series.flatMap((serie) => serie.data);
  const ys = flattenedData.map<number>((point) => point.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);

  return makeSymlogScale(min, max, options);
};

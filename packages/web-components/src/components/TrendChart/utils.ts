import type { ScaleSymlogSpec } from "@nivo/scales";
import { TrendChartKind } from "./types";
import type { TrendChartData, TrendChartKindConfig, SymlogScaleOptions } from "./types";
import { SymlogScaleConstant } from "./constants";

export const getKindConfig = (kind: TrendChartKind): TrendChartKindConfig => {
    switch (kind) {
        case TrendChartKind.slicesX:
            return { useMesh: false, enableSlices: "x" as const };
        case TrendChartKind.slicesY:
            return { useMesh: false, enableSlices: "y" as const };
        case TrendChartKind.mesh:
        default:
            return { useMesh: true, enableSlices: undefined };
    }
};

export const makeSymlogScale = (min: number, max: number, options?: SymlogScaleOptions): ScaleSymlogSpec => {
    const { constant = SymlogScaleConstant, ...restOptions } = options ?? {};

    return {
        type: "symlog",
        min,
        max,
        constant,
        ...restOptions,
    };
};

export const makeSymlogScaleByData = (data: TrendChartData[], options?: SymlogScaleOptions): ScaleSymlogSpec => {
    const flattenedData = data.flatMap(series => series.data);
    const ys = flattenedData.map<number>(point => point.y);
    const min = Math.min(...ys);
    const max = Math.max(...ys);

    return makeSymlogScale(min, max, options);
};

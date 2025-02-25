import { TrendChartKind } from "./types";

export const getKindConfig = (kind: TrendChartKind) => {
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

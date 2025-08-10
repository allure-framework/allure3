import { Bar } from "@nivo/bar";
import type { BarSvgProps, BarDatum } from "@nivo/bar";
import { commonProps } from "./constants";

export type BarChartProps<D extends BarDatum> = BarSvgProps<D>;

export const BarChart = <D extends BarDatum>(props: BarChartProps<D>) => {
    return <Bar {...commonProps} {...props} />;
};

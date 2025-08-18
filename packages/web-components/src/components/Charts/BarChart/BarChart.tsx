import { ResponsiveBar } from "@nivo/bar";
import type { BarDatum } from "@nivo/bar";
import type { FunctionalComponent } from "preact";
import { EmptyDataStub } from "../EmptyDataStub";
import { defaultBarChartConfig } from "./config.js";
import { nivoTheme } from "./theme.js";
import type { BarChartProps } from "./types.js";

export const BarChart: FunctionalComponent<BarChartProps<BarDatum>> = ({
	width = "100%",
	height = 400,
	rootAriaLabel,
	emptyLabel = "No data available",
	emptyAriaLabel = "No data available",
	data,
	...restProps
}) => {
	if (!data || data.length === 0) {
		return <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyAriaLabel} />;
	}

	return (
		<div role="img" aria-label={rootAriaLabel} tabIndex={0} style={{ width, height }}>
			<ResponsiveBar data={data} {...defaultBarChartConfig} {...restProps} theme={nivoTheme} />
		</div>
	);
};

import type { BarSvgProps } from "@nivo/bar";

export const commonProps: Partial<BarSvgProps<{}>> = {
    width: 900,
    height: 500,
    margin: { top: 60, right: 110, bottom: 60, left: 80 },
    padding: 0.2,
    labelTextColor: "inherit:darker(1.4)",
    labelSkipWidth: 16,
    labelSkipHeight: 16,
};

import { TreeMapChart } from "@/components/Charts/TreeMapChart";
import type { TreeMapChartProps } from "@allurereport/web-components";
import type { Meta, StoryObj } from "@storybook/react";
import { createTreeMapData, getColor, getColorWithDomain } from "./TreeMapChart/mocks";

const meta: Meta<typeof TreeMapChart> = {
  title: "Charts/TreeMapChart",
  component: TreeMapChart,
  parameters: {
    layout: "centered",
  },
  args: {
    width: 900,
    height: 500,
  },
};

export default meta;

const rootData = createTreeMapData();

type Story = StoryObj<TreeMapChartProps>;

export const Default: Story = {
  args: {
    data: rootData,
    rootAriaLabel: "Feature Success Rate Tree",
    colors: getColor,
  },
};

export const EmptyData: Story = {
  args: {
    title: "Empty Feature Set",
    data: [],
    colors: getColor,
  },
};

export const CustomGradient: Story = {
  args: {
    data: rootData,
    rootAriaLabel: "Feature Success Rate Tree with Custom Gradient",
    colors: getColorWithDomain,
    formatLegend: (value: number) => `${(value * 100).toFixed(0)}%`,
    legendDomain: [0, 0.5, 1], // Three points: 0%, 50%, 100% - minValue/maxValue auto-calculated
  },
};

import { TreeMapChart } from "@allurereport/web-components";
import type { TreeMapChartProps } from "@allurereport/web-components";
import type { Meta, StoryObj } from "@storybook/react";
import { createTreeMapData, getColor } from "./TreeMapChart/mocks";

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

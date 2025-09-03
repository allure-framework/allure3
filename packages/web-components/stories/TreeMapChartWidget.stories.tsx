import { TreeMapChartWidget } from "@allurereport/web-components";
import type { TreeMapChartWidgetProps } from "@allurereport/web-components";
import type { Meta, StoryObj } from "@storybook/react";
import { createTreeMapData, getColor } from "./TreeMapChart/mocks";

const meta: Meta<typeof TreeMapChartWidget> = {
  title: "Charts/TreeMapChartWidget",
  component: TreeMapChartWidget,
  parameters: {
    layout: "centered",
  },
  args: {
    width: 900,
    height: 500,
  }
};

export default meta;

const rootData = createTreeMapData();

type Story = StoryObj<TreeMapChartWidgetProps>;

export const Default: Story = {
  args: {
    title: "Default",
    data: rootData,
    rootAriaLabel: "Feature Success Rate Tree",
    colors: getColor,
    translations: {
      "no-results": "No features available for testing",
    },
  },
};

export const EmptyData: Story = {
  args: {
    title: "Empty Feature Set",
    data: [],
    colors: getColor,
    translations: {
      "no-results": "No features available for testing",
    },
  },
};

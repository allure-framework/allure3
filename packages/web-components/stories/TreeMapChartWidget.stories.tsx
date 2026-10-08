import { ChartType } from "@allurereport/charts-api";
import type { Meta, StoryObj } from "@storybook/preact-vite";
import type { ComponentProps } from "preact";

import { TreeMapChartWidget } from "@/components/Charts/TreeMapChartWidget";

import { createEmptyTreeMapData, createTreeMapData, getColor } from "./TreeMapChart/mocks";

type WidgetProps = ComponentProps<typeof TreeMapChartWidget>;

const meta: Meta<WidgetProps> = {
  title: "Charts/TreeMapChartWidget",
  component: TreeMapChartWidget,
  parameters: {
    layout: "centered",
  },
  args: {
    width: 900,
    height: 500,
    colors: getColor,
    translations: {
      "no-results": "No features available for testing",
    },
  },
};

export default meta;

type Story = StoryObj<WidgetProps>;

export const SuccessRateDistribution: Story = {
  args: {
    title: "Success rate distribution",
    chartType: ChartType.SuccessRateDistribution,
    data: createTreeMapData(),
    rootAriaLabel: "Feature Success Rate Tree",
  },
};

export const CoverageDiff: Story = {
  args: {
    title: "Coverage diff",
    chartType: ChartType.CoverageDiff,
    data: createTreeMapData(),
    rootAriaLabel: "Feature Coverage Diff Tree",
  },
};

export const EmptyData: Story = {
  args: {
    title: "Empty Feature Set",
    chartType: ChartType.SuccessRateDistribution,
    data: createEmptyTreeMapData(),
  },
};

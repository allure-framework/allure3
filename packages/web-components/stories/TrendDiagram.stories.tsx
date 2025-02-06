// StreamChart.stories.tsx
import { TrendDiagram } from "@allurereport/web-components";
import type { TrendDiagramData } from "@allurereport/web-components";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof TrendDiagram> = {
  title: "Commons/TrendDiagram",
  component: TrendDiagram,
};

export default meta;

const makeDaysData = (count: number, maxValue = 100): TrendDiagramData["data"] => {
  return Array.from({ length: count }, (_, index) => ({
    x: `Day${index + 1}`,
    y: Math.floor(Math.random() * maxValue)
  }));
};

const mockDefaultData = (count: number) => [
  {
    id: "Passed",
    data: makeDaysData(count, 200),
  },
  {
    id: "Not Passed",
    data: makeDaysData(count, 30),
  },
  {
    id: "Warning",
    data: makeDaysData(count, 10),
  },
];

type Story = StoryObj<typeof TrendDiagram>;

export const Default: Story = {
  args: {
    data: mockDefaultData(5),
  }
};

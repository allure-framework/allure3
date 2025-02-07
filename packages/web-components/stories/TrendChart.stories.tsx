import { TrendChart, defaultTrendChartLegendConfig, defaultAxisBottomConfig, defaultAxisLeftConfig } from "@allurereport/web-components";
import type { TrendChartDataItem } from "@allurereport/web-components";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof TrendChart> = {
  title: "Commons/TrendChart",
  component: TrendChart,
};

export default meta;

const makeDaysData = (count: number, maxValue = 100): TrendChartDataItem[] => {
  return Array.from({ length: count }, (_, index) => ({
    x: `#${index + 1}`,
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

const mockedData = mockDefaultData(10);

type Story = StoryObj<typeof TrendChart>;

export const Default: Story = {
  args: {
    data: mockedData,
  }
};

export const WithLegend: Story = {
  args: {
    data: mockedData,
    legends: [defaultTrendChartLegendConfig]
  }
};

export const WithAxisLegends: Story = {
  args: {
    data: mockedData,
    axisBottom: {
      ...defaultAxisBottomConfig,
      legendOffset: 36,
      legendPosition: "middle",
      legend: "Day",
    },
    axisLeft: {
      ...defaultAxisLeftConfig,
      legend: "Tests executed",
      legendOffset: -40,
      legendPosition: "middle",
    }
  }
};

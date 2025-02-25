import { TrendChart, defaultTrendChartLegendConfig, defaultAxisBottomConfig, defaultAxisLeftConfig, TrendChartKind } from "@allurereport/web-components";
import type { TrendChartProps, TrendChartDataItem, TrendChartData } from "@allurereport/web-components";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof TrendChart> = {
  title: "Charts/TrendChart",
  component: TrendChart,
};

export default meta;

const makeDaysData = (count: number, maxValue = 100): TrendChartDataItem[] => {
  return Array.from({ length: count }, (_, index) => ({
    x: `#${index + 1}`,
    y: Math.floor(Math.random() * maxValue)
  }));
};

const mockDefaultData = (count: number): TrendChartData[] => [
  {
    id: "Passed",
    data: makeDaysData(count, 150),
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

type Story = StoryObj<TrendChartProps>;

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

export const WithSlices: Story = {
  args: {
    data: mockedData,
    kind: TrendChartKind.slicesX,
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

export const WithLogarithmicScale: Story = {
  args: {
    data: mockedData,
    axisLeft: {
      ...defaultAxisLeftConfig,
      legend: "Tests executed (symlog scale)",
      legendOffset: -40,
      legendPosition: "middle",
    },
    yScale: {
      type: "symlog",
      constant: 48,
      min: mockedData.flatMap(series => series.data).reduce((acc, point) => Math.min(acc, point.y), Infinity),
      max: mockedData.flatMap(series => series.data).reduce((acc, point) => Math.max(acc, point.y), -Infinity),
    },
  }
};

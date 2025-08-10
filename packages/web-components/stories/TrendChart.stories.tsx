import { TrendChart, defaultTrendChartLegendConfig, defaultTrendChartAxisBottomConfig, defaultTrendChartAxisLeftConfig, makeSymlogScaleBySeries, TrendChartKind } from "@allurereport/web-components";
import type { TrendChartProps, Datum, Serie } from "@allurereport/web-components";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof TrendChart> = {
  title: "Charts/TrendChart",
  component: TrendChart,
  args: {
    width: 900,
    height: 500,
  }
};

export default meta;

const makeDaysData = (count: number, maxValue = 100): Datum[] => Array.from({ length: count }, (_, index) => ({
  x: `#${index + 1}`,
  y: Math.floor(Math.random() * maxValue)
}));

const mockDefaultData = (count: number): Serie[] => [
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

export const Empty: Story = {
  args: {
    data: [],
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
      ...defaultTrendChartAxisBottomConfig,
      legendOffset: 36,
      legendPosition: "middle",
      legend: "Day",
    },
    axisLeft: {
      ...defaultTrendChartAxisLeftConfig,
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
      ...defaultTrendChartAxisLeftConfig,
      legend: "Tests executed (symlog scale)",
      legendOffset: -40,
      legendPosition: "middle",
    },
    yScale: makeSymlogScaleBySeries(mockedData, { constant: 48 }),
  }
};

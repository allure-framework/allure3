import { BarChart, defaultBarChartAxisBottomConfig, defaultBarChartAxisLeftConfig, defaultBarChartLegendsConfig } from "@allurereport/web-components";
import type { BarChartProps } from "@allurereport/web-components";
import type { TestStatus } from "@allurereport/core-api";
import { statusColors } from "@allurereport/web-commons";
import type { Meta, StoryObj } from "@storybook/react";
import { TEST_STATUSES, createBarChartData, TREND_CATEGORIES, createTrendBarChartData, trendColors } from "./mocks";
import type { ResponsiveBarSvgProps } from "@nivo/bar";

const meta: Meta<typeof BarChart> = {
  title: "Charts/BarChart",
  component: BarChart,
  parameters: {
    layout: "centered",
  },
  args: {
    width: 900,
    height: 500,
  }
};

export default meta;

const CHART_CONFIG: Partial<ResponsiveBarSvgProps<Record<TestStatus, number>>> = {
  keys: TEST_STATUSES,
  indexBy: "severity",
  groupMode: "grouped",
  colors: ({ id }) => statusColors[id as TestStatus],
};

const mockData = createBarChartData();

const bottomAxisConfig = {
  ...defaultBarChartAxisBottomConfig,
  legend: "Test Severity",
  legendPosition: "middle",
  legendOffset: 32,
};

const leftAxisConfig = {
  ...defaultBarChartAxisLeftConfig,
  legend: "Number of Tests",
  legendPosition: "middle",
  legendOffset: -40
};

type Story = StoryObj<BarChartProps<typeof mockData[0]>>;

export const Default: Story = {
  args: {
    data: mockData,
    ...CHART_CONFIG,
  },
};

export const Empty: Story = {
  args: {
    data: [],
  }
};

export const WithAxisLegends: Story = {
  args: {
    data: mockData,
    axisBottom: bottomAxisConfig,
    axisLeft: leftAxisConfig,
    ...CHART_CONFIG,
  }
};

export const WithLegend: Story = {
  args: {
    data: mockData,
    legends: [defaultBarChartLegendsConfig],
    ...CHART_CONFIG,
  }
};

export const WithLogarithmicScale: Story = {
  args: {
    data: mockData,
    axisLeft: {
      ...leftAxisConfig,
      legend: "Number of Tests (symlog scale)",
    },
    valueScale: {
      type: "symlog",
    },
    ...CHART_CONFIG,
  }
};

export const Full: Story = {
  args: {
    data: mockData,
    axisBottom: bottomAxisConfig,
    axisLeft: leftAxisConfig,
    legends: [defaultBarChartLegendsConfig],
    ...CHART_CONFIG,
  }
};

const trendData = createTrendBarChartData();

const TREND_CHART_CONFIG: Partial<ResponsiveBarSvgProps<Record<string, number>>> = {
  keys: TREND_CATEGORIES,
  indexBy: "point",
  groupMode: "stacked",
  colors: ({ id }) => trendColors[id as keyof typeof trendColors],
};

const trendBottomAxisConfig = {
  ...defaultBarChartAxisBottomConfig,
  legend: "Data Points",
  legendPosition: "middle",
  legendOffset: 32,
};

const trendLeftAxisConfig = {
  ...defaultBarChartAxisLeftConfig,
  legend: "Values",
  legendPosition: "middle",
  legendOffset: -40,
};

type TrendStory = StoryObj<BarChartProps<typeof trendData[0]>>;

export const TrendData: TrendStory = {
  args: {
    data: trendData,
    axisBottom: trendBottomAxisConfig,
    axisLeft: trendLeftAxisConfig,
    legends: [defaultBarChartLegendsConfig],
    ...TREND_CHART_CONFIG,
  },
};

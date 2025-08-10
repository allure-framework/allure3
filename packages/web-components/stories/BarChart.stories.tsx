import { BarChart } from "@allurereport/web-components";
import type { BarChartProps } from "@allurereport/web-components";
import type { TestStatus } from "@allurereport/core-api";
import { statusColors } from "@allurereport/web-commons";
import type { Meta, StoryObj } from "@storybook/react";
import { TEST_STATUSES, createBarChartData } from "./BarChart/mocks";
import type { BarSvgProps } from "@nivo/bar";

const meta: Meta<typeof BarChart> = {
  title: "Charts/BarChart",
  component: BarChart,
  parameters: {
    layout: "centered",
  },
};

export default meta;

// Константы для конфигурации чарта
const CHART_CONFIG: Partial<BarSvgProps<Record<TestStatus, number>>> = {
  keys: TEST_STATUSES,
  indexBy: "severity",
  groupMode: "grouped",
  colors: ({ id }) => statusColors[id as TestStatus],
  axisBottom: {
    tickSize: 5,
    tickPadding: 5,
    tickRotation: 0,
    legend: "Test Severity",
    legendPosition: "middle",
    legendOffset: 32,
  },
  axisLeft: {
    tickSize: 5,
    tickPadding: 5,
    tickRotation: 0,
    legend: "Number of Tests",
    legendPosition: "middle",
    legendOffset: -40
  },
  labelSkipWidth: 16,
  labelSkipHeight: 16,
  legends: [
    {
      dataFrom: "keys",
      anchor: "right",
      direction: "column",
      justify: false,
      translateX: 120,
      translateY: 0,
      itemsSpacing: 2,
      itemWidth: 100,
      itemHeight: 20,
      itemDirection: "left-to-right",
      itemOpacity: 0.85,
      symbolSize: 20,
      effects: [
        {
          on: "hover",
          style: {
            itemOpacity: 1,
          },
        },
      ],
    },
  ],
  tooltip: ({ id, value, indexValue }: { id: string; value: number; indexValue: string }) => (
    <div style={{
      background: "white",
      padding: "9px 12px",
      border: "1px solid #ccc",
      borderRadius: "4px",
    }}>
      <strong>{indexValue}</strong><br />
      {id}: <strong>{value}</strong>
    </div>
  ),
};

const mockData = createBarChartData();

type Story = StoryObj<BarChartProps<typeof mockData[0]>>;

export const Default: Story = {
  args: {
    data: mockData,
    ...CHART_CONFIG,
  },
};


import type { Meta, StoryObj } from "@storybook/preact-vite";

import { StatusTransitionsChartWidget } from "@/components/Charts/StatusTransitionsChartWidget";

import { NOW, chartI18n, historyTimestamps } from "../mocks";

const meta: Meta<typeof StatusTransitionsChartWidget> = {
  title: "Charts/StatusTransitionsChartWidget",
  component: StatusTransitionsChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Status transitions",
    i18n: chartI18n,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const timestamps = historyTimestamps(6);
const history = timestamps.map((timestamp, index) => ({
  id: `h${index}`,
  timestamp,
  prevItemTimestamp: timestamp - 86_400_000,
  fixed: 2 + index,
  regressed: 4 - (index % 3),
  malfunctioned: index % 2,
}));

export const Default: Story = {
  args: {
    data: [
      ...history,
      { id: "current", timestamp: NOW, prevItemTimestamp: timestamps[5], fixed: 5, regressed: 1, malfunctioned: 2 },
    ],
  },
};

export const NoHistory: Story = {
  args: {
    data: [
      { id: "current", timestamp: NOW, prevItemTimestamp: NOW - 86_400_000, fixed: 5, regressed: 1, malfunctioned: 2 },
    ],
  },
};

export const Empty: Story = {
  args: { data: [] },
};

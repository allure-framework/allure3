import type { Meta, StoryObj } from "@storybook/preact-vite";

import { StatusAgePyramidChartWidget } from "@/components/Charts/StatusAgePyramidChartWidget";

import { NOW, chartI18n, historyTimestamps } from "../mocks";

const meta: Meta<typeof StatusAgePyramidChartWidget> = {
  title: "Charts/StatusAgePyramidChartWidget",
  component: StatusAgePyramidChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Status age pyramid",
    i18n: chartI18n,
    statuses: ["failed", "broken", "skipped", "unknown"],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const history = historyTimestamps(5).map((timestamp, index) => ({
  id: `h${index}`,
  timestamp,
  failed: 12 - index * 2,
  broken: 6 - index,
  skipped: 3 + index,
  unknown: index % 2,
}));

export const Default: Story = {
  args: {
    data: [...history, { id: "current", timestamp: NOW, failed: 20, broken: 8, skipped: 4, unknown: 1 }],
  },
};

export const NoHistory: Story = {
  args: {
    data: [{ id: "current", timestamp: NOW, failed: 20, broken: 8, skipped: 4, unknown: 1 }],
  },
};

export const Empty: Story = {
  args: { data: [] },
};

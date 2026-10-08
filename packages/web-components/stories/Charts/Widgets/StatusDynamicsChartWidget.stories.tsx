import type { Meta, StoryObj } from "@storybook/preact-vite";

import { StatusDynamicsChartWidget } from "@/components/Charts/StatusDynamicsChartWidget";

import { NOW, chartI18n, historyTimestamps } from "../mocks";

const meta: Meta<typeof StatusDynamicsChartWidget> = {
  title: "Charts/StatusDynamicsChartWidget",
  component: StatusDynamicsChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Status dynamics",
    i18n: chartI18n,
    statuses: ["passed", "failed", "broken", "skipped", "unknown"],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const point = (id: string, timestamp: number, seed: number) => {
  const failed = 5 + (seed % 4) * 3;
  const broken = 2 + (seed % 3);
  const skipped = 3;
  const unknown = 1;
  const passed = 120 + seed * 4;

  return {
    id,
    timestamp,
    name: `Run ${id}`,
    statistic: { passed, failed, broken, skipped, unknown, total: passed + failed + broken + skipped + unknown },
  };
};

const history = historyTimestamps(6).map((timestamp, index) => point(`h${index}`, timestamp, index));

export const Default: Story = {
  args: { data: [...history, { ...point("current", NOW, 7), id: "current" }] },
};

export const NoHistory: Story = {
  args: { data: [{ ...point("current", NOW, 7), id: "current" }] },
};

export const Empty: Story = {
  args: { data: [] },
};

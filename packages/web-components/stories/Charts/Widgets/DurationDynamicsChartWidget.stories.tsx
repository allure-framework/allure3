import type { Meta, StoryObj } from "@storybook/preact-vite";

import { DurationDynamicsChartWidget } from "@/components/Charts/DurationDynamicsChartWidget";

import { NOW, chartI18n, historyTimestamps } from "../mocks";

const meta: Meta<typeof DurationDynamicsChartWidget> = {
  title: "Charts/DurationDynamicsChartWidget",
  component: DurationDynamicsChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Duration dynamics",
    i18n: chartI18n,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const item = (id: string, timestamp: number, seed: number) => {
  const sequentialDuration = 600_000 + seed * 30_000;
  const duration = 200_000 + (seed % 3) * 20_000;

  return { id, timestamp, sequentialDuration, duration, speedup: sequentialDuration / duration };
};

const history = historyTimestamps(5).map((timestamp, index) => item(`h${index}`, timestamp, index));

export const Default: Story = {
  args: { data: [...history, item("current", NOW, 6)] },
};

export const Empty: Story = {
  args: { data: [{ id: "current", timestamp: NOW, duration: 0, sequentialDuration: 0, speedup: 0 }] },
};

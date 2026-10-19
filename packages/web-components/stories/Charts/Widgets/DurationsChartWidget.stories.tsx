import type { Meta, StoryObj } from "@storybook/preact-vite";

import { DurationsChartWidget } from "@/components/Charts/DurationsChartWidget";

import { chartI18n } from "../mocks";

const meta: Meta<typeof DurationsChartWidget> = {
  title: "Charts/DurationsChartWidget",
  component: DurationsChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Durations",
    i18n: chartI18n,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ByLayer: Story = {
  args: {
    groupBy: "layer",
    keys: { unit: "Unit", api: "API", e2e: "E2E" },
    data: [
      { from: 0, to: 1000, unit: 120, api: 30, e2e: 2 },
      { from: 1000, to: 5000, unit: 40, api: 60, e2e: 8 },
      { from: 5000, to: 30000, unit: 5, api: 25, e2e: 30 },
      { from: 30000, to: 120000, unit: 0, api: 4, e2e: 22 },
    ],
  },
};

export const Ungrouped: Story = {
  args: {
    groupBy: "none",
    keys: { total: "Total" },
    data: [
      { from: 0, to: 1000, total: 152 },
      { from: 1000, to: 5000, total: 108 },
      { from: 5000, to: 30000, total: 60 },
      { from: 30000, to: 120000, total: 26 },
    ],
  },
};

export const Empty: Story = {
  args: { groupBy: "none", keys: { total: "Total" }, data: [] },
};

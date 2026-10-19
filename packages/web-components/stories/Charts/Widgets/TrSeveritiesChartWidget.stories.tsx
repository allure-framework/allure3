import type { Meta, StoryObj } from "@storybook/preact-vite";

import { TrSeveritiesChartWidget } from "@/components/Charts/TrSeveritiesChartWidget";

import { chartI18n } from "../mocks";

const meta: Meta<typeof TrSeveritiesChartWidget> = {
  title: "Charts/TrSeveritiesChartWidget",
  component: TrSeveritiesChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Test results by severity",
    i18n: chartI18n,
    levels: ["blocker", "critical", "normal", "minor", "trivial", "unset"],
    statuses: ["passed", "failed", "broken", "skipped", "unknown"],
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { id: "blocker", passed: 12, failed: 3, broken: 1, skipped: 0, unknown: 0 },
      { id: "critical", passed: 30, failed: 5, broken: 2, skipped: 1, unknown: 0 },
      { id: "normal", passed: 80, failed: 8, broken: 4, skipped: 3, unknown: 1 },
      { id: "minor", passed: 25, failed: 2, broken: 1, skipped: 2, unknown: 0 },
      { id: "trivial", passed: 10, failed: 0, broken: 0, skipped: 1, unknown: 0 },
      { id: "unset", passed: 5, failed: 1, broken: 0, skipped: 0, unknown: 2 },
    ],
  },
};

export const Empty: Story = {
  args: { data: [] },
};

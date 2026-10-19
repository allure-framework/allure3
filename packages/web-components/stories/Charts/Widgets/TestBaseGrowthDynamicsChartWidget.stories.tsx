import type { TestStatus } from "@allurereport/core-api";
import type { Meta, StoryObj } from "@storybook/preact-vite";
import type { ComponentProps } from "preact";

import { TestBaseGrowthDynamicsChartWidget } from "@/components/Charts/TestBaseGrowthDynamicsChartWidget";

import { NOW, chartI18n, historyTimestamps } from "../mocks";

type WidgetProps = ComponentProps<typeof TestBaseGrowthDynamicsChartWidget>;

const statuses: TestStatus[] = ["passed", "failed", "broken", "skipped", "unknown"];

const meta: Meta<WidgetProps> = {
  title: "Charts/TestBaseGrowthDynamicsChartWidget",
  component: TestBaseGrowthDynamicsChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Test base growth dynamics",
    i18n: chartI18n,
    statuses,
  },
};

export default meta;
type Story = StoryObj<WidgetProps>;

const item = (id: string, timestamp: number, seed: number): WidgetProps["data"][number] => ({
  id,
  timestamp,
  "new:passed": 10 + seed,
  "new:failed": seed % 3,
  "new:broken": 1,
  "new:skipped": 0,
  "new:unknown": 0,
  "removed:passed": 4 + (seed % 2),
  "removed:failed": 1,
  "removed:broken": 0,
  "removed:skipped": 1,
  "removed:unknown": 0,
});

const history = historyTimestamps(5).map((timestamp, index) => item(`h${index}`, timestamp, index));

export const Default: Story = {
  args: { data: [...history, item("current", NOW, 6)] },
};

export const NoHistory: Story = {
  args: { data: [item("current", NOW, 6)] },
};

export const Empty: Story = {
  args: { data: [] },
};

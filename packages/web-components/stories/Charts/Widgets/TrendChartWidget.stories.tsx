import { ChartMode } from "@allurereport/charts-api";
import type { Meta, StoryObj } from "@storybook/preact-vite";

import { TrendChartWidget } from "@/components/Charts/TrendChartWidget";

const meta: Meta<typeof TrendChartWidget> = {
  title: "Charts/TrendChartWidget",
  component: TrendChartWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Trend",
    mode: ChartMode.Raw,
    height: 400,
    translations: { "no-results": "No results" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const executions = ["#1", "#2", "#3", "#4", "#5", "#6"];
const slices = executions.map((executionId) => ({ metadata: { executionId }, min: 0, max: 150 }));
const serie = (id: string, color: string, values: number[]) => ({
  id,
  color,
  data: executions.map((x, index) => ({ x, y: values[index] })),
});

export const Default: Story = {
  args: {
    slices,
    min: 0,
    max: 150,
    items: [
      serie("Passed", "var(--color-status-passed-chart-fill)", [110, 120, 118, 130, 140, 145]),
      serie("Failed", "var(--color-status-failed-chart-fill)", [20, 15, 18, 10, 6, 4]),
    ],
  },
};

export const Percent: Story = {
  args: {
    ...Default.args,
    mode: ChartMode.Percent,
    min: 0,
    max: 1,
    items: [
      serie("Passed", "var(--color-status-passed-chart-fill)", [0.82, 0.88, 0.85, 0.93, 0.96, 0.97]),
      serie("Failed", "var(--color-status-failed-chart-fill)", [0.18, 0.12, 0.15, 0.07, 0.04, 0.03]),
    ],
  },
};

export const Empty: Story = {
  args: { items: [], slices: [], min: 0, max: 0 },
};

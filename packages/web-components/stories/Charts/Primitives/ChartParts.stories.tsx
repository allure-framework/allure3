import type { Meta, StoryObj } from "@storybook/preact-vite";

import { ChartTooltip } from "@/components/Charts/ChartTooltip";
import { EmptyDataStub } from "@/components/Charts/EmptyDataStub";
import { Legends } from "@/components/Charts/Legend";
import { LegendIndicator } from "@/components/Charts/Legend/LegendIndicator";
import { LegendItem } from "@/components/Charts/Legend/LegendItem";

const meta: Meta = {
  title: "Charts/Parts",
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj;

const legend = [
  { id: "passed", label: "Passed", color: "var(--color-status-passed-chart-fill)", value: 120 },
  { id: "failed", label: "Failed", color: "var(--color-status-failed-chart-fill)", value: 12 },
  { id: "trend", label: "Trend", color: "var(--color-chart-categorical-9)", value: 3, type: "point" as const },
];

export const LegendList: Story = {
  render: () => <Legends data={legend} />,
};

export const SingleLegendItem: Story = {
  render: () => <LegendItem legend={legend[0]} />,
};

export const ClickableLegendItem: Story = {
  render: () => <LegendItem legend={legend[1]} onClick={() => {}} />,
};

export const Indicator: Story = {
  render: () => <LegendIndicator color="var(--color-status-passed-chart-fill)" />,
};

export const Tooltip: Story = {
  render: () => (
    <ChartTooltip label="Run from Jan 10" labelColor="var(--color-status-passed-chart-fill)">
      <LegendItem legend={legend[0]} />
      <LegendItem legend={legend[1]} />
    </ChartTooltip>
  ),
};

export const EmptyStub: Story = {
  render: () => <EmptyDataStub label="No data available" width={320} height={160} />,
};

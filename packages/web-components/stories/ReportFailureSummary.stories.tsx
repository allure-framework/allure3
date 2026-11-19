import type { Meta, StoryObj } from "@storybook/preact-vite";

import { ReportFailureSummary } from "@/components/ReportFailureSummary";

const meta: Meta<typeof ReportFailureSummary> = {
  title: "Commons/ReportFailureSummary",
  component: ReportFailureSummary,
  parameters: { layout: "padded" },
  argTypes: {
    title: { control: "text", description: "Already translated title of the summary." },
    items: {
      control: "object",
      description: "Failure kinds with already translated labels, a nonzero count is highlighted as failed.",
    },
  },
  args: {
    title: "Report failed",
    items: [
      { count: 3, label: "Unsuccessful tests", testId: "failure-summary-unsuccessful-tests" },
      { count: 2, label: "Failed quality gates", testId: "failure-summary-failed-quality-gates" },
      { count: 1, label: "Global errors", testId: "failure-summary-global-errors" },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof ReportFailureSummary>;

export const AllReasons: Story = {};

export const UnsuccessfulTestsOnly: Story = {
  args: {
    items: [
      { count: 1, label: "Unsuccessful tests" },
      { count: 0, label: "Failed quality gates" },
      { count: 0, label: "Global errors" },
    ],
  },
};

export const FailedQualityGateOnly: Story = {
  args: {
    items: [
      { count: 0, label: "Unsuccessful tests" },
      { count: 1, label: "Failed quality gates" },
      { count: 0, label: "Global errors" },
    ],
  },
};

export const GlobalErrorsOnly: Story = {
  args: {
    items: [
      { count: 0, label: "Unsuccessful tests" },
      { count: 0, label: "Failed quality gates" },
      { count: 2, label: "Global errors" },
    ],
  },
};

export const LargeCounts: Story = {
  args: {
    items: [
      { count: 1284, label: "Unsuccessful tests" },
      { count: 12, label: "Failed quality gates" },
      { count: 105, label: "Global errors" },
    ],
  },
};

// the items wrap to the next line when there is not enough room
export const NarrowContainer: Story = {
  render: (args) => (
    <div style={{ width: 320 }}>
      <ReportFailureSummary {...args} />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/preact-vite";

import { TestingPyramidWidget } from "@/components/Charts/TestingPyramidWidget";

const meta: Meta<typeof TestingPyramidWidget> = {
  title: "Charts/TestingPyramidWidget",
  component: TestingPyramidWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Testing pyramid",
    translations: { "no-results": "No results" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { layer: "Unit", testCount: 600, successRate: 0.99, percentage: 60 },
      { layer: "Integration", testCount: 250, successRate: 0.92, percentage: 25 },
      { layer: "API", testCount: 100, successRate: 0.85, percentage: 10 },
      { layer: "E2E", testCount: 50, successRate: 0.7, percentage: 5 },
    ],
  },
};

export const Empty: Story = {
  args: { data: [] },
};

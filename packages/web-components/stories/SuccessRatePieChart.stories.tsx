import type { TestStatus } from "@allurereport/core-api";
import type { Meta, StoryObj } from "@storybook/react";
import { SuccessRatePieChart } from "../";

const meta: Meta<typeof SuccessRatePieChart> = {
  title: "Commons/SuccessRatePieChart",
  component: SuccessRatePieChart,
  argTypes: {
    percentage: {
      control: "number",
      description: "The percentage value displayed in the center of the chart.",
    },
    slices: {
      control: false,
      description: "Array of slices representing the pie chart segments.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SuccessRatePieChart>;

const mockSlices = [
  { status: "passed" as TestStatus, count: 60, d: "M 50 0 A 50 50 0 0 1 87 50 L 50 50 Z" },
  { status: "failed" as TestStatus, count: 30, d: "M 87 50 A 50 50 0 0 1 50 0 L 50 50 Z" },
  { status: "skipped" as TestStatus, count: 10, d: "M 50 0 A 50 50 0 0 1 50 0 L 50 50 Z" },
];

export const Default: Story = {
  args: {
    slices: mockSlices,
    percentage: 75,
  },
};

export const WithoutPercentage: Story = {
  args: {
    slices: mockSlices,
    percentage: 0,
  },
};

export const CustomSlices: Story = {
  args: {
    slices: [
      { status: "passed" as TestStatus, count: 50, d: "M 50 0 A 50 50 0 0 1 70 70 L 50 50 Z" },
      { status: "broken" as TestStatus, count: 25, d: "M 70 70 A 50 50 0 0 1 50 0 L 50 50 Z" },
      { status: "unknown" as TestStatus, count: 25, d: "M 50 0 A 50 50 0 0 1 50 0 L 50 50 Z" },
    ],
    percentage: 50,
  },
};

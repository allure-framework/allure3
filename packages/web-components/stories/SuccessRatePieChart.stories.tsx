import type { TestStatus } from "@allurereport/core-api";
import { SuccessRatePieChart } from "@allurereport/web-components";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof SuccessRatePieChart> = {
  title: "Commons/SuccessRatePieChart",

  decorators: [
    (Story) => (
      <div style={{ width: "95px", height: "95px" }}>
        <Story />
      </div>
    ),
  ],
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
  {
    d: "M0.96,-47.909A2,2,0,0,1,3.084,-49.905A50,50,0,0,1,44.761,22.282A2,2,0,0,1,41.97,23.123L36.763,20.116A2,2,0,0,1,35.965,17.509A40,40,0,0,0,2.819,-39.901A2,2,0,0,1,0.96,-41.896Z",
    status: "failed",
    count: 2,
  },
  {
    d: "M41.01,24.786A2,2,0,0,1,41.677,27.623A50,50,0,0,1,-41.677,27.623A2,2,0,0,1,-41.01,24.786L-35.802,21.78A2,2,0,0,1,-33.145,22.392A40,40,0,0,0,33.145,22.392A2,2,0,0,1,35.802,21.78Z",
    status: "broken",
    count: 2,
  },
  {
    d: "M-41.97,23.123A2,2,0,0,1,-44.761,22.282A50,50,0,0,1,-3.084,-49.905A2,2,0,0,1,-0.96,-47.909L-0.96,-41.896A2,2,0,0,1,-2.819,-39.901A40,40,0,0,0,-35.965,17.509A2,2,0,0,1,-36.763,20.116Z",
    status: "passed",
    count: 2,
  },
];

export const Default: Story = {
  args: {
    styles: { width: "75px" },

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
    slices: mockSlices,
    percentage: 50,
  },
};

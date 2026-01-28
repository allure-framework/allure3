import { Timeline } from "@/components/Timeline";
import type { Meta, StoryObj } from "@storybook/react";
// @ts-ignore this is fine
import mockData from "./data.mock.json";

const meta: Meta<typeof Timeline> = {
  title: "Charts/Timeline",
  component: Timeline,
  parameters: {
    layout: "padded",
  },
  args: {
    width: "100%",
    translations: {
      empty: "No data",
      selected: (props: { count: number; percentage: string; minDuration: string; maxDuration: string }) =>
        `Selected ${props.count} tests (${props.percentage}%) with duration more than ${props.minDuration} and less than ${props.maxDuration}`,
    },
  },
};

export default meta;

type Story = StoryObj<typeof Timeline>;

export const Default: Story = {
  args: {
    data: mockData,
  },
};

import type { Meta, StoryObj } from "@storybook/preact-vite";

import { HeatMap } from "@/components/Charts/HeatMap";
import type { HeatMapProps } from "@/components/Charts/HeatMap/types";

import { mockData } from "./mocks";

const meta: Meta<HeatMapProps> = {
  title: "Charts/HeatMap",
  component: HeatMap,
  parameters: {
    layout: "centered",
  },
  args: {
    width: 900,
    height: 500,
  },
};

export default meta;
type Story = StoryObj<HeatMapProps>;

export const Default: Story = {
  args: {
    data: mockData,
  },
};

export const Empty: Story = {
  args: {
    data: [],
  },
};

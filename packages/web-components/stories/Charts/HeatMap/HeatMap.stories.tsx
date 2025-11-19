import type { Meta, StoryObj } from "@storybook/preact";
import { HeatMap } from "@allurereport/web-components";
import type { HeatMapProps } from "@allurereport/web-components";
import { mockData } from "./mocks";

const colorsSchema: HeatMapProps["colors"] = {
  type: "diverging",
  colors: ["red", "#ffffff", "green"],
  divergeAt: 0.5,
};

const meta: Meta<HeatMapProps> = {
  title: "Charts/HeatMap",
  component: HeatMap,
  parameters: {
    layout: "centered",
  },
  args: {
    colors: colorsSchema,
    width: 900,
    height: 500,
  },
};

export default meta;
type Story = StoryObj<HeatMapProps>;

// Placeholder story - will be filled with mock data after types are finalized
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

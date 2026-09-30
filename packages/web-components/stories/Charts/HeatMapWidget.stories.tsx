import type { Meta, StoryObj } from "@storybook/preact-vite";

import { HeatMapWidget } from "@/components/Charts/HeatMapWidget";

import { mockData } from "./HeatMap/mocks";

const meta: Meta<typeof HeatMapWidget> = {
  title: "Charts/HeatMapWidget",
  component: HeatMapWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Problems distribution",
    width: "100%",
    height: 400,
    translations: { "no-results": "No results" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data: mockData },
};

export const Empty: Story = {
  args: { data: [] },
};

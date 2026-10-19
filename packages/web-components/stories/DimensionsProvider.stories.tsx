import type { Meta, StoryObj } from "@storybook/preact-vite";

import { DimensionsProvider } from "@/components/DimensionsProvider";

const meta: Meta<typeof DimensionsProvider> = {
  title: "Components/DimensionsProvider",
  component: DimensionsProvider,
  parameters: { layout: "padded" },
  args: {
    children: (width: number, height: number) => (
      <div style={{ padding: "16px" }}>
        {width} x {height}
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: "50%", height: "120px", resize: "both", overflow: "auto", border: "1px dashed gray" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

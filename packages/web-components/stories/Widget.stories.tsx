import type { Meta, StoryObj } from "@storybook/preact-vite";

import { Widget } from "@/components/Widget";

const meta: Meta<typeof Widget> = {
  title: "Components/Widget",
  component: Widget,
  parameters: { layout: "padded" },
  args: {
    title: "Widget title",
    dropShadow: true,
    centerContent: false,
  },
  render: (args) => (
    <Widget {...args}>
      <div style={{ padding: "16px" }}>Widget content</div>
    </Widget>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTitle: Story = {
  args: { title: undefined },
};

export const WithoutShadow: Story = {
  args: { dropShadow: false },
};

export const CenteredContent: Story = {
  args: { centerContent: true },
  render: (args) => (
    <Widget {...args}>
      <div style={{ height: "160px" }}>Centered</div>
    </Widget>
  ),
};

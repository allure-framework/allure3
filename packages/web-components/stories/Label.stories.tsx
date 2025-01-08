import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "@allurereport/web-components";

const meta: Meta<typeof Label> = {
  title: "Commons/Label",
  component: Label,
  args: {
    children: "Label Text",
  },
  argTypes: {
    children: {
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {
    children: "Default Label",
  },
};

export const BoldLabel: Story = {
  args: {
    children: "Bold and Small Label",
  },
};

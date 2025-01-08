import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "../";

const meta: Meta<typeof Spinner> = {
  title: "Commons/Spinner",
  component: Spinner,
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["s", "m"],
      description: "Size of the spinner.",
    },
  },
  args: {
    size: "m",
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Small: Story = {
  args: {
    size: "s",
  },
};

export const Medium: Story = {
  args: {
    size: "m",
  },
};

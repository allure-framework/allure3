import type { Meta, StoryObj } from "@storybook/react";
import { Counter } from "@allurereport/web-components";

const meta: Meta<typeof Counter> = {
  title: "Commons/Counter",
  component: Counter,
  argTypes: {
    count: {
      control: "number",
    },
    size: {
      control: { type: "select" },
      options: ["s", "m", "l"],
    },
    truncateCount: {
      control: "boolean",
    },
    status: {
      control: { type: "select" },
      options: ["passed", "failed", "skipped", "unknown"],
    },
  },
  args: {
    count: 42,
    size: "s",
    truncateCount: false,
    status: undefined,
  },
};

export default meta;
type Story = StoryObj<typeof Counter>;

export const Small: Story = {
  args: {
    size: "s",
    count: 42,
  },
};

export const Medium: Story = {
  args: {
    size: "m",
    count: 100,
  },
};

export const Large: Story = {
  args: {
    size: "l",
    count: 999,
    truncateCount: true,
  },
};

export const Truncated: Story = {
  args: {
    count: 120,
    truncateCount: true,
  },
};

export const WithStatus: Story = {
  args: {
    count: 5,
    status: "passed",
  },
};

export const FailedStatus: Story = {
  args: {
    count: 3,
    status: "failed",
  },
};

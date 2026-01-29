import { StatusLabel } from "@/components/StatusLabel";
import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof StatusLabel> = {
  title: "Commons/StatusLabel",
  component: StatusLabel,
  argTypes: {
    status: {
      control: { type: "select" },
      options: ["passed", "failed", "broken", "skipped", "unknown"],
      description: "Status.",
    },
    label: {
      control: "text",
    },
  },
  args: {
    status: "passed",
    label: "Status label",
  },
};

export default meta;
type Story = StoryObj<typeof StatusLabel>;

export const Default: Story = {
  render: ({ label, ...args }) => {
    return <StatusLabel {...args}>{label}</StatusLabel>;
  },
};

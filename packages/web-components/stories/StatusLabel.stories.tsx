import type { Meta, StoryObj } from "@storybook/preact-vite";

import { StatusLabel } from "@/components/StatusLabel";
import type { StatusLabelProps } from "@/components/StatusLabel";

type StatusLabelStoryProps = StatusLabelProps & { label: string };

const meta: Meta<StatusLabelStoryProps> = {
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
type Story = StoryObj<StatusLabelStoryProps>;

export const Default: Story = {
  render: ({ label, ...args }) => {
    return <StatusLabel {...args}>{label}</StatusLabel>;
  },
};

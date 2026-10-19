import type { Meta, StoryObj } from "@storybook/preact-vite";

import IconLabel from "@/components/IconLabel";
import { allureIcons } from "@/components/SvgIcon";

const meta: Meta<typeof IconLabel> = {
  title: "Components/IconLabel",
  component: IconLabel,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    style: { control: "select", options: ["primary", "secondary"] },
  },
  args: {
    icon: allureIcons.lineGeneralZap,
    style: "secondary",
  },
  render: (args) => <IconLabel {...args}>130</IconLabel>,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: { style: "primary" },
};

export const WithTooltip: Story = {
  args: { tooltip: "130 retries" },
};

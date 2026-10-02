import type { Meta, StoryObj } from "@storybook/preact-vite";

import { Button } from "@/components/Button";
import { EmptyView } from "@/components/EmptyView";
import { allureIcons } from "@/components/SvgIcon";

const meta: Meta<typeof EmptyView> = {
  title: "Components/EmptyView",
  component: EmptyView,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    size: { control: "select", options: ["xs", "s", "m"] },
    iconColor: {
      control: "select",
      options: [
        "purple",
        "blue",
        "green",
        "orange",
        "violet",
        "sky",
        "magenta",
        "rose",
        "red",
        "amber",
        "teal",
        "slate",
      ],
    },
  },
  args: {
    title: "No results",
    description: "Try changing the filters to see more tests",
    icon: allureIcons.lineGeneralInfoCircle,
    iconColor: "blue",
    size: "m",
    fullHeight: false,
    border: true,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutIcon: Story = {
  args: { icon: undefined },
};

export const TitleOnly: Story = {
  args: { description: undefined },
};

export const WithAction: Story = {
  render: (args) => (
    <EmptyView {...args}>
      <Button style="outline" size="m" text="Reset filters" />
    </EmptyView>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <EmptyView {...args} size="m" />
      <EmptyView {...args} size="s" />
      <EmptyView {...args} size="xs" />
    </div>
  ),
};

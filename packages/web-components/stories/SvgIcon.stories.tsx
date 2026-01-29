import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import type { Meta, StoryObj } from "@storybook/react";

// Mock icons
const mockIconId = allureIcons.lineAlertsNotificationBox;

const meta: Meta<typeof SvgIcon> = {
  title: "Commons/SvgIcon",
  component: SvgIcon,
  argTypes: {
    id: {
      control: "text",
      description: "The ID of the SVG symbol to use.",
    },
    size: {
      control: { type: "select" },
      options: ["xs", "s", "m"],
      description: "Size of the SVG icon.",
    },
    className: {
      control: "text",
      description: "Additional class names for custom styling.",
    },
    inline: {
      control: "boolean",
      description: "Whether the icon is displayed inline with text.",
    },
  },
  args: {
    id: mockIconId,
    size: "s",
    inline: false,
  },
};

export default meta;
type Story = StoryObj<typeof SvgIcon>;

export const Small: Story = {
  args: {
    size: "xs",
    id: mockIconId,
  },
};

export const Medium: Story = {
  args: {
    size: "m",
    id: mockIconId,
  },
};

export const InlineIcon: Story = {
  args: {
    inline: true,
    size: "s",
    id: mockIconId,
  },
};

export const CustomClassName: Story = {
  args: {
    className: "custom-class",
    size: "m",
    id: mockIconId,
  },
};

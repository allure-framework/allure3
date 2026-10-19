import type { Meta, StoryObj } from "@storybook/preact-vite";

import { SvgIcon, allureIcons } from "@/components/SvgIcon";

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
      options: ["xs", "s", "m", "l", "xl"],
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

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      {(["xs", "s", "m", "l", "xl"] as const).map((size) => (
        <SvgIcon key={size} {...args} size={size} />
      ))}
    </div>
  ),
};

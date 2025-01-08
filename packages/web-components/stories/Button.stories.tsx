import type { Meta, StoryObj } from "@storybook/react";
import { Button, DropdownButton, IconButton, icons } from "@allurereport/web-components";

const meta: Meta<typeof Button> = {
  title: "Commons/Button",
  component: Button,
  argTypes: {
    text: {
      control: "text",
      description: "Text to be displayed on the button.",
    },
    size: {
      control: { type: "select" },
      options: ["s", "m", "l"],
      description: "Size of the button.",
    },
    style: {
      control: { type: "select" },
      options: ["primary", "outline", "ghost", "flat", "raised"],
      description: "Style of the button.",
    },
    action: {
      control: { type: "select" },
      options: ["default", "danger", "positive"],
      description: "Action type of the button.",
    },
    icon: {
      control: "text",
      description: "Icon to display on the button (provide the icon ID).",
    },
    isPending: {
      control: "boolean",
      description: "Whether the button shows a pending (loading) state.",
    },
    isDisabled: {
      control: "boolean",
      description: "Whether the button is disabled.",
    },
    fullWidth: {
      control: "boolean",
      description: "Whether the button takes the full width of its container.",
    },
    onClick: { action: "clicked", description: "Callback when the button is clicked." },
  },
  args: {
    text: "Button",
    size: "m",
    style: "primary",
    action: "default",
    isPending: false,
    isDisabled: false,
    fullWidth: false,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    text: "Primary Button",
    style: "primary",
  },
};

export const Outline: Story = {
  args: {
    text: "Outline Button",
    style: "outline",
  },
};

export const WithIcon: Story = {
  args: {
    text: "Button with Icon",
    icon: icons.lineArrowsChevronDown,
    style: "primary",
  },
};

export const Pending: Story = {
  args: {
    text: "Loading Button",
    isPending: true,
  },
};

export const Disabled: Story = {
  args: {
    text: "Disabled Button",
    isDisabled: true,
  },
};

// IconButton stories
export const IconOnly: StoryObj<typeof IconButton> = {
  render: (args) => <IconButton {...args} />,
  args: {
    icon: icons.lineArrowsChevronDown,
    style: "ghost",
    size: "m",
    isDisabled: false,
  },
};

// DropdownButton stories
export const Dropdown: StoryObj<typeof DropdownButton> = {
  render: (args) => <DropdownButton {...args} />,
  args: {
    text: "Dropdown Button",
    style: "primary",
    isExpanded: false,
  },
  argTypes: {
    isExpanded: {
      control: "boolean",
      description: "Whether the dropdown is expanded.",
    },
  },
};

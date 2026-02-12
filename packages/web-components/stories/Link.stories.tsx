import type { Meta, StoryObj } from "@storybook/react";
import { Link } from "@/components/Link";

const meta: Meta<typeof Link> = {
  title: "Commons/Link",
  component: Link,
  argTypes: {
    href: {
      control: "text",
      description: "The URL the link points to. If undefined, it behaves as a button.",
    },
    children: {
      control: "text",
      description: "The content of the link.",
    },
    onClick: {
      action: "clicked",
      description: "Callback when the link is clicked.",
    },
  },
  args: {
    children: "Click Me",
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const AnchorLink: Story = {
  args: {
    href: "https://example.com",
    children: "Go to Example",
  },
};

export const ButtonLink: Story = {
  args: {
    href: undefined,
    children: "Pseudo Link",
  },
};

export const CustomOnClick: Story = {
  args: {
    href: undefined,
    children: "Click Me",
  },
  argTypes: {
    onClick: { action: "custom clicked" },
  },
};

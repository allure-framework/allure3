import type { Meta, StoryObj } from "@storybook/react";
import { Text, TooltipWrapper } from "@allurereport/web-components";

const meta: Meta<typeof TooltipWrapper> = {
  title: "Commons/TooltipWrapper",
  component: TooltipWrapper,
  argTypes: {
    tooltipText: {
      control: "text",
      description: "Text to display inside the tooltip.",
    },
    tooltipTextAfterClick: {
      control: "text",
      description: "Text to display in the tooltip after clicking the trigger.",
    },
    placement: {
      control: { type: "select" },
      options: ["top", "bottom", "left", "right"],
      description: "Placement of the tooltip relative to the trigger.",
    },
    triggerMode: {
      control: { type: "select" },
      options: ["hover", "click"],
      description: "How the tooltip is triggered (hover or click).",
    },
    autoHideDelay: {
      control: "number",
      description: "Delay in milliseconds before the tooltip automatically hides (for click mode).",
    },
    isTriggerActive: {
      control: "boolean",
      description: "Whether the trigger for showing the tooltip is active.",
    },
  },
  args: {
    tooltipText: "This is a tooltip",
    placement: "top",
    triggerMode: "hover",
    autoHideDelay: 600,
    isTriggerActive: true,
  },
};

export default meta;
type Story = StoryObj<typeof TooltipWrapper>;

export const Default: Story = {
  render: (args) => (
    <TooltipWrapper {...args}>
      <Text size="m" bold>
        Hover or click me
      </Text>
    </TooltipWrapper>
  ),
};

export const ClickToShow: Story = {
  args: {
    tooltipText: "Click to see this tooltip",
    tooltipTextAfterClick: "You clicked me!",
    triggerMode: "click",
    autoHideDelay: 1000,
  },
  render: (args) => (
    <TooltipWrapper {...args}>
      <Text size="m" bold>
        Click me
      </Text>
    </TooltipWrapper>
  ),
};

export const CustomPlacement: Story = {
  args: {
    tooltipText: "I am on the left",
    placement: "left",
  },
  render: (args) => (
    <TooltipWrapper {...args}>
      <Text size="m" bold>
        Hover me
      </Text>
    </TooltipWrapper>
  ),
};

export const WithCustomComponent: Story = {
  args: {
    tooltipComponent: (
      <div style={{ padding: "8px", backgroundColor: "#333", color: "#fff", borderRadius: "4px" }}>
        Custom Tooltip Content
      </div>
    ),
  },
  render: (args) => (
    <TooltipWrapper {...args}>
      <Text size="m" bold>
        Hover me for custom tooltip
      </Text>
    </TooltipWrapper>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "preact/hooks";
import { Toggle } from "../";

const meta: Meta<typeof Toggle> = {
  title: "Commons/Toggle",
  component: Toggle,
  argTypes: {
    value: {
      control: "boolean",
      description: "The current value of the toggle (checked or not).",
    },
    label: {
      control: "text",
      description: "Accessible label for the toggle.",
    },
    focusable: {
      control: "boolean",
      description: "Whether the toggle is focusable.",
    },
    onChange: {
      action: "changed",
      description: "Callback when the toggle changes state.",
    },
  },
  args: {
    value: false,
    label: "Toggle switch",
    focusable: true,
  },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <Toggle
        {...args}
        value={value}
        onChange={(newValue) => {
          setValue(newValue);
          console.log("Toggle changed:", newValue);
        }}
      />
    );
  },
};

export const DisabledToggle: Story = {
  args: {
    focusable: false,
    value: true,
    label: "Disabled Toggle",
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <Toggle
        {...args}
        value={value}
        onChange={(newValue) => {
          setValue(newValue);
          console.log("Toggle changed:", newValue);
        }}
      />
    );
  },
};

export const WithCustomLabel: Story = {
  args: {
    value: false,
    label: "Custom Toggle Label",
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);

    return (
      <Toggle
        {...args}
        value={value}
        onChange={(newValue) => {
          setValue(newValue);
          console.log("Toggle changed:", newValue);
        }}
      />
    );
  },
};

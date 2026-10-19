import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useState } from "preact/hooks";

import { Toggle } from "@/components/Toggle";

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
    size: {
      control: { type: "select" },
      options: ["s", "m"],
      description: "Size of the toggle.",
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
    size: "m",
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

export const Sizes: Story = {
  render: (args) => {
    const [value, setValue] = useState(true);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Toggle {...args} size="s" label="Small" value={value} onChange={setValue} />
        <Toggle {...args} size="m" label="Medium" value={value} onChange={setValue} />
      </div>
    );
  },
};

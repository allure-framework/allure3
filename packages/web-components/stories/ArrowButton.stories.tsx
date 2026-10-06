import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useState } from "preact/hooks";

import { ArrowButton } from "@/components/ArrowButton";

const meta: Meta<typeof ArrowButton> = {
  title: "Components/ArrowButton",
  component: ArrowButton,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    buttonSize: { control: "select", options: ["xs", "s", "m"] },
    iconSize: { control: "select", options: ["xs", "s", "m"] },
    isOpened: { control: "boolean" },
  },
  args: {
    isOpened: false,
    buttonSize: "m",
    iconSize: "xs",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Opened: Story = {
  args: { isOpened: true },
};

export const Toggleable: Story = {
  render: (args) => {
    const [isOpened, setIsOpened] = useState(false);

    return <ArrowButton {...args} isOpened={isOpened} onClick={() => setIsOpened(!isOpened)} />;
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <ArrowButton buttonSize="xs" iconSize="xs" />
      <ArrowButton buttonSize="s" iconSize="s" />
      <ArrowButton buttonSize="m" iconSize="m" />
    </div>
  ),
};

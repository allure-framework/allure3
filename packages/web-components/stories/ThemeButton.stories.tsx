import type { Meta, StoryObj } from "@storybook/preact-vite";
import { useState } from "preact/hooks";

import type { Theme } from "@/components/ThemeButton";
import { ThemeButton } from "@/components/ThemeButton";

const themes: Theme[] = ["light", "dark", "auto"];

const meta: Meta<typeof ThemeButton> = {
  title: "Components/ThemeButton",
  component: ThemeButton,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    theme: { control: "select", options: themes },
  },
  args: {
    theme: "light",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Cycling: Story = {
  render: () => {
    const [theme, setTheme] = useState<Theme>("light");
    const toggleTheme = () => setTheme(themes[(themes.indexOf(theme) + 1) % themes.length]);

    return <ThemeButton theme={theme} toggleTheme={toggleTheme} />;
  },
};

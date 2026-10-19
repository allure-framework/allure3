import type { Meta, StoryObj } from "@storybook/preact-vite";

import { ThemeProvider, useTheme } from "@/components/ThemeProvider";

const CurrentTheme = () => <span>Current theme: {useTheme()}</span>;

const meta: Meta<typeof ThemeProvider> = {
  title: "Components/ThemeProvider",
  component: ThemeProvider,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    theme: { control: "select", options: ["light", "dark"] },
  },
  args: {
    theme: "dark",
  },
  render: (args) => (
    <ThemeProvider {...args}>
      <CurrentTheme />
    </ThemeProvider>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

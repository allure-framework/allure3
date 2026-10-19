import type { Meta, StoryObj } from "@storybook/preact-vite";

import { ReportLogo } from "@/components/ReportLogo";
import { ReportLogoFull } from "@/components/ReportLogoFull";

const meta: Meta<typeof ReportLogo> = {
  title: "Components/ReportLogo",
  component: ReportLogo,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomLogo: Story = {
  args: { logo: "favicon.svg" },
};

export const Full: Story = {
  render: () => <ReportLogoFull />,
};

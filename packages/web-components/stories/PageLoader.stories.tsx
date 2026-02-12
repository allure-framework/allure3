import type { Meta, StoryObj } from "@storybook/react";
import { PageLoader } from "@/components/PageLoader";

const meta: Meta<typeof PageLoader> = {
  title: "Commons/PageLoader",
  component: PageLoader,
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof PageLoader>;

export const Default: Story = {
  render: () => <PageLoader />,
};

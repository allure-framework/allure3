import type { Meta, StoryObj } from "@storybook/react";
import { PageLoader } from "@allurereport/web-components";

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

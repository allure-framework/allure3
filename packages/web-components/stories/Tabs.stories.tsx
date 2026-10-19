import type { Meta, StoryObj } from "@storybook/preact-vite";

import { Tab, Tabs, TabsList } from "@/components/Tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  parameters: {
    layout: "centered",
  },
  args: {
    initialTab: "overview",
  },
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <Tab tabId="overview">Overview</Tab>
        <Tab tabId="history">History</Tab>
        <Tab tabId="retries">Retries</Tab>
      </TabsList>
    </Tabs>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondTabSelected: Story = {
  args: { initialTab: "history" },
};

import type { Meta, StoryObj } from "@storybook/preact-vite";

import { StabilityDistributionWidget } from "@/components/Charts/StabilityDistributionWidget";

import { chartI18n } from "../mocks";

const meta: Meta<typeof StabilityDistributionWidget> = {
  title: "Charts/StabilityDistributionWidget",
  component: StabilityDistributionWidget,
  parameters: { layout: "padded" },
  args: {
    title: "Stability distribution",
    i18n: chartI18n,
    threshold: 90,
    keys: { auth: "Authorization", cart: "Cart", search: "Search", checkout: "Checkout", profile: "Profile" },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: [
      { id: "auth", stabilityRate: 98 },
      { id: "cart", stabilityRate: 92 },
      { id: "search", stabilityRate: 85 },
      { id: "checkout", stabilityRate: 71 },
      { id: "profile", stabilityRate: 100 },
    ],
  },
};

export const Empty: Story = {
  args: { data: [] },
};

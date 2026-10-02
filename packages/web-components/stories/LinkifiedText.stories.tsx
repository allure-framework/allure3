import type { Meta, StoryObj } from "@storybook/preact-vite";

import { LinkifiedText } from "@/components/LinkifiedText";

const meta: Meta<typeof LinkifiedText> = {
  title: "Components/LinkifiedText",
  component: LinkifiedText,
  parameters: {
    layout: "centered",
  },
  args: {
    text: "See https://allurereport.org/docs for details or write to mailto:team@example.com",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WwwLink: Story = {
  args: { text: "Documentation lives at www.allurereport.org" },
};

export const WithoutLinks: Story = {
  args: { text: "Nothing to linkify here" },
};

export const UnsafeUrlIsNotLinked: Story = {
  args: { text: "javascript:alert(1) stays plain text" },
};

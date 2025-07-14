import type { Meta, StoryObj } from "@storybook/preact";
import { Tag } from "@allurereport/web-components";

const meta: Meta<typeof Tag> = {
  title: "Components/Tag",
  component: Tag,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    skin: {
      control: "select",
      options: [
        "neutral",
        "successful",
        "failed",
        "warning",
        "neutral-light",
        "successful-light",
        "failed-light",
        "warning-light",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Tag>Tag</Tag>,
};

export const SolidSkins: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <Tag skin="neutral">Neutral</Tag>
      <Tag skin="successful">Successful</Tag>
      <Tag skin="failed">Failed</Tag>
      <Tag skin="warning">Warning</Tag>
    </div>
  ),
};

export const LightweightSkins: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <Tag skin="neutral-light">Neutral Light</Tag>
      <Tag skin="successful-light">Successful Light</Tag>
      <Tag skin="failed-light">Failed Light</Tag>
      <Tag skin="warning-light">Warning Light</Tag>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <Tag skin="neutral">Neutral</Tag>
      <Tag skin="neutral-light">Neutral Light</Tag>
      <Tag skin="successful">Successful</Tag>
      <Tag skin="successful-light">Successful Light</Tag>
      <Tag skin="failed">Failed</Tag>
      <Tag skin="failed-light">Failed Light</Tag>
      <Tag skin="warning">Warning</Tag>
      <Tag skin="warning-light">Warning Light</Tag>
    </div>
  ),
};

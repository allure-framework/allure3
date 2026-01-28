import type { Meta, StoryObj } from "@storybook/react";
import { ImageDiff } from "@/components/ImageDiff";
// @ts-ignore this is fine
import diff from "./diff.example.json";
// @ts-ignore this is fine
import diff3 from "./dimensionsdiff.example.json";
// @ts-ignore this is fine
import diff2 from "./smalldiff.example.json";

const meta: Meta<typeof ImageDiff> = {
  title: "Components/ImageDiff",
  component: ImageDiff,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof ImageDiff>;

export const Default: Story = {
  args: {
    diff,
  },
};

export const Small: Story = {
  args: {
    diff: diff2,
  },
};

export const DifferentDimensions: Story = {
  args: {
    diff: diff3,
  },
};

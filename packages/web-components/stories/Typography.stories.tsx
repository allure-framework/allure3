import type { Meta, StoryObj } from "@storybook/react";
import { Code, Heading, Text } from "../";

const meta: Meta<typeof Text> = {
  title: "Commons/Typography",
  component: Text,
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["xs", "s", "m", "l"],
      description: "The size of the text.",
    },
    type: {
      control: { type: "select" },
      options: ["paragraph", "ui"],
      description: "The type of the text.",
    },
    bold: {
      control: "boolean",
      description: "Whether the text should be bold.",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for styling.",
    },
    tag: {
      control: { type: "select" },
      options: ["span", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6"],
      description: "The HTML tag to use for rendering the text.",
    },
  },
  args: {
    size: "m",
    type: "paragraph",
    bold: false,
    tag: "span",
  },
};

export default meta;

type TextStory = StoryObj<typeof Text>;
type CodeStory = StoryObj<typeof Code>;
type HeadingStory = StoryObj<typeof Heading>;

export const DefaultText: TextStory = {
  args: {
    children: "This is a default Text component",
  },
};

export const BoldText: TextStory = {
  args: {
    children: "This is bold Text",
    bold: true,
  },
};

export const UITypedText: TextStory = {
  args: {
    children: "This is UI typed Text",
    type: "ui",
    size: "s",
  },
};

export const DefaultCode: CodeStory = {
  render: () => (
    <Code type="paragraph" size="m">
      const code = "This is a default Code component";
    </Code>
  ),
};

export const BoldCode: CodeStory = {
  render: () => (
    <Code type="paragraph" size="m" bold>
      const code = "This is bold Code text";
    </Code>
  ),
};

export const HeadingSmall: HeadingStory = {
  render: () => (
    <Heading size="s" tag="h3">
      Small Heading
    </Heading>
  ),
};

export const HeadingLarge: HeadingStory = {
  render: () => (
    <Heading size="l" tag="h1">
      Large Heading
    </Heading>
  ),
};

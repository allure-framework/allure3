import type { Meta, StoryObj } from "@storybook/preact-vite";

import { MiddleEllipsis } from "@/components/MiddleEllipsis";

const meta: Meta<typeof MiddleEllipsis> = {
  title: "Commons/MiddleEllipsis",
  component: MiddleEllipsis,
  parameters: { layout: "padded" },
  argTypes: {
    text: { control: "text", description: "The text which is cut out from the middle when there is no room for it." },
    endLength: {
      control: { type: "number", min: 1, max: 20 },
      description: "How many last characters are always shown.",
    },
  },
  args: {
    text: "7978df3c8132d35f922679e1c72c4e3d26c95061",
    endLength: 6,
  },
};

export default meta;
type Story = StoryObj<typeof MiddleEllipsis>;

export const Default: Story = {
  render: (args) => (
    <div style={{ width: 260, outline: "1px dashed rgba(127, 127, 127, 0.5)" }}>
      <MiddleEllipsis {...args} />
    </div>
  ),
};

const captionStyle = { fontSize: 12, opacity: 0.6, marginBottom: 4 } as const;

// the same text with the different numbers of the shown characters
export const StartAndEnd: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[
        [4, 4],
        [6, 6],
        [8, 6],
        [10, 10],
        [20, 8],
      ].map(([startLength, endLength]) => (
        <div key={`${startLength}-${endLength}`} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <span style={{ ...captionStyle, width: 80, marginBottom: 0 }}>
            {startLength} + {endLength}
          </span>
          <MiddleEllipsis {...args} startLength={startLength} endLength={endLength} />
        </div>
      ))}
    </div>
  ),
};

// when even the shortened text doesn't fit, it is cut at the end
export const ContainerWidths: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[60, 100, 160, 260].map((width) => (
        <div key={width}>
          <div style={captionStyle}>container {width}px</div>
          <div style={{ width, outline: "1px dashed rgba(127, 127, 127, 0.5)" }}>
            <MiddleEllipsis {...args} />
          </div>
        </div>
      ))}
    </div>
  ),
};

export const TextsAndTails: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[
        ["A SHA-1 hash, the last 6", "0e439982439152586e01fc4a93e3092992722586", 6],
        ["A SHA-256 hash, the last 8", "a1b2c3d4e5f60718293a4b5c6d7e8f901234567a1b2c3d4e5f60718293a4b5c", 8],
        [
          "A branch with many levels, the last 12",
          "users/someone/feature/ALLURE-123456/rework/of/the/header/and/breadcrumbs",
          12,
        ],
        ["A short text is not split", "release/3.x", 6],
      ].map(([title, text, endLength]) => (
        <div key={String(title)}>
          <div style={captionStyle}>{title}</div>
          <div style={{ width: 200, outline: "1px dashed rgba(127, 127, 127, 0.5)" }}>
            <MiddleEllipsis text={String(text)} endLength={Number(endLength)} />
          </div>
        </div>
      ))}
    </div>
  ),
};

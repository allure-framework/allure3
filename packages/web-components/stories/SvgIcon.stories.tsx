import type { Meta, StoryObj } from "@storybook/preact-vite";

import { SvgIcon, allureIcons } from "@/components/SvgIcon";

// Mock icons
const mockIconId = allureIcons.lineAlertsNotificationBox;

const meta: Meta<typeof SvgIcon> = {
  title: "Commons/SvgIcon",
  component: SvgIcon,
  argTypes: {
    id: {
      control: "text",
      description: "The ID of the SVG symbol to use.",
    },
    size: {
      control: { type: "select" },
      options: ["xs", "s", "m", "l", "xl"],
      description: "Size of the SVG icon.",
    },
    className: {
      control: "text",
      description: "Additional class names for custom styling.",
    },
    inline: {
      control: "boolean",
      description: "Whether the icon is displayed inline with text.",
    },
  },
  args: {
    id: mockIconId,
    size: "s",
    inline: false,
  },
};

export default meta;
type Story = StoryObj<typeof SvgIcon>;

export const Small: Story = {
  args: {
    size: "xs",
    id: mockIconId,
  },
};

export const Medium: Story = {
  args: {
    size: "m",
    id: mockIconId,
  },
};

export const InlineIcon: Story = {
  args: {
    inline: true,
    size: "s",
    id: mockIconId,
  },
};

export const CustomClassName: Story = {
  args: {
    className: "custom-class",
    size: "m",
    id: mockIconId,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
      {(["xs", "s", "m", "l", "xl"] as const).map((size) => (
        <SvgIcon key={size} {...args} size={size} />
      ))}
    </div>
  ),
};

const guide = { outline: "1px dashed rgba(127, 127, 127, 0.45)" } as const;
const logoIds = [
  "github",
  "gitlab",
  "bitbucket",
  "circleci",
  "jenkins",
  "azure",
  "amazon",
  "drone",
  "reportLogo",
] as const;
const lineIds = [
  "lineDevDataflow3",
  "lineDevCodeSquare",
  "lineGeneralLinkExternal",
  "lineGeneralCopy3",
  "lineGeneralLink1",
  "lineChartsTimeline",
  "lineChartsBarChartSquare",
  "lineGeneralCheck",
] as const;

const Row = ({ title, children }: { title: string; children: preact.ComponentChildren }) => (
  <div>
    <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>{title}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>{children}</div>
  </div>
);

// the logos fill their whole box while the line icons have the paddings inside of theirs,
// so in the same box the logos look larger and the logos have to be scaled down (12px in 16px) to look the same
export const OpticalAlignment: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Row title="The same box (size s, 16px): the logos look larger">
        {[...logoIds, ...lineIds].map((name) => (
          <span key={name} style={guide} title={name}>
            <SvgIcon id={allureIcons[name]} size="s" />
          </span>
        ))}
      </Row>
      <Row title="Logos 12px (size xs), line icons 16px: the same optical size">
        {logoIds.map((name) => (
          <span key={name} style={guide} title={name}>
            <SvgIcon id={allureIcons[name]} size="xs" />
          </span>
        ))}
        {lineIds.map((name) => (
          <span key={name} style={guide} title={name}>
            <SvgIcon id={allureIcons[name]} size="s" />
          </span>
        ))}
      </Row>
      <Row title="All the sizes of one line icon and one logo">
        {(["xs", "s", "m", "l", "xl"] as const).map((size) => (
          <span key={size} style={{ ...guide, display: "inline-flex", gap: 8 }}>
            <SvgIcon id={allureIcons.lineDevDataflow3} size={size} />
            <SvgIcon id={allureIcons.github} size={size} />
          </span>
        ))}
      </Row>
    </div>
  ),
};

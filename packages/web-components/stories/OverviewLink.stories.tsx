import type { Meta, StoryObj } from "@storybook/preact-vite";

import { DropdownButton } from "@/components/Button";
import { OverviewLink } from "@/components/OverviewLink";
import { allureIcons } from "@/components/SvgIcon";

const meta: Meta<typeof OverviewLink> = {
  title: "Commons/OverviewLink",
  component: OverviewLink,
  parameters: { layout: "padded" },
  argTypes: {
    href: { control: "text", description: "Link to the overview page of the multi-plugin report." },
    text: { control: "text", description: "Already translated label of the link." },
  },
  args: {
    href: "#",
    text: "Back to overview",
  },
};

export default meta;
type Story = StoryObj<typeof OverviewLink>;

export const Default: Story = {};

export const LongLabel: Story = {
  args: { text: "Back to the overview of the whole multi-plugin report" },
  render: (args) => (
    <div style={{ width: 260 }}>
      <OverviewLink {...args} />
    </div>
  ),
};

const captionStyle = { fontSize: 12, opacity: 0.6, marginBottom: 4 } as const;

// the label is truncated when there is not enough room, the full label is shown in the tooltip then
export const ContainerWidths: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {[40, 64, 100, 140, 220].map((width) => (
        <div key={width}>
          <div style={captionStyle}>container {width}px</div>
          <div style={{ width, outline: "1px dashed rgba(127, 127, 127, 0.5)" }}>
            <OverviewLink {...args} />
          </div>
        </div>
      ))}
    </div>
  ),
};

// the way the link lives in the header of the report: next to the pickers, which must not overlap it.
// Under 768px of the viewport only the icon is left (use the viewport toolbar of Storybook)
export const InTheHeader: Story = {
  args: { width: 520 } as any,
  argTypes: { width: { control: { type: "range", min: 200, max: 900, step: 10 } } } as any,
  render: (args) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: (args as any).width,
        padding: "8px 24px",
        outline: "1px dashed rgba(127, 127, 127, 0.5)",
      }}
    >
      <OverviewLink href={args.href} text={args.text} />
      <DropdownButton style="ghost" size="m" text="Report" icon={allureIcons.reportLogo} iconSize="xs" />
      <DropdownButton style="ghost" size="m" text="Pull request #123" icon={allureIcons.github} iconSize="xs" />
    </div>
  ),
};

// the labels are translated, so the width of the link depends on the language
export const Localized: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
      {[
        ["en", "Back to overview"],
        ["ru", "Назад к обзору"],
        ["de", "Zurück zur Übersicht"],
        ["fr", "Retour à l'aperçu"],
        ["es", "Volver a la descripción general"],
        ["ja", "概要に戻る"],
        ["hy", "Վերադառնալ ակնարկ"],
      ].map(([lang, text]) => (
        <div key={lang} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ ...captionStyle, width: 24, marginBottom: 0 }}>{lang}</span>
          <OverviewLink {...args} text={text} />
        </div>
      ))}
    </div>
  ),
};

export const InNarrowHeaders: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[260, 340, 420, 560].map((width) => (
        <div key={width}>
          <div style={captionStyle}>header {width}px</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width,
              padding: "8px 24px",
              outline: "1px dashed rgba(127, 127, 127, 0.5)",
            }}
          >
            <OverviewLink {...args} />
            <DropdownButton style="ghost" size="m" text="Report" icon={allureIcons.reportLogo} iconSize="xs" />
            <DropdownButton
              style="ghost"
              size="m"
              text="Pull request #123"
              icon={allureIcons.github}
              iconSize="xs"
              isTextTruncated
            />
          </div>
        </div>
      ))}
    </div>
  ),
};

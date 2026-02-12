import type { Meta, StoryObj } from "@storybook/react";
import { ReportSummaryCard } from "@/components/ReportSummaryCard";

const meta: Meta<typeof ReportSummaryCard> = {
  title: "Components/ReportSummaryCard",
  component: ReportSummaryCard,
};

export default meta;
type Story = StoryObj<typeof ReportSummaryCard>;

const defaultSummary = {
  name: "First sample report",
  href: "#",
  stats: {
    passed: 100,
    failed: 31,
    broken: 5,
    skipped: 1,
    unknown: 2,
    total: 139,
  },
  duration: 1240812,
  status: "failed",
  newTests: [
    {
      name: "New test 1",
      id: "1",
      status: "passed",
      duration: 100,
    },
    {
      name: "New test 2",
      id: "2",
      status: "passed",
      duration: 100,
    },
    {
      name: "New test 3",
      id: "3",
      status: "passed",
      duration: 100,
    },
  ],
  flakyTests: [
    {
      name: "New test 1",
      id: "1",
      status: "passed",
      duration: 100,
    },
  ],
  retryTests: [
    {
      name: "New test 1",
      id: "1",
      status: "passed",
      duration: 100,
    },
    {
      name: "New test 2",
      id: "2",
      status: "passed",
      duration: 100,
    },
  ],
  createdAt: Date.now(),
};

const enLocales: Record<string, string> = {
  "status.failed": "failed",
  "status.broken": "broken",
  "status.passed": "passed",
  "status.skipped": "skipped",
  "status.unknown": "unknown",
  "in": "in",
  "total": "Total",
  "metadata.new": "new",
  "metadata.flaky": "flaky",
  "metadata.retry": "retry",
};

const enI18n = (key: string, props: Record<string, any>) => {
  if (key === "createdAt") {
    return new Date(props?.createdAt as number).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  }
  return enLocales[key];
};

export const Default: Story = {
  args: {
    i18n: enI18n,
    summary: defaultSummary,
  },
  render: (args) => (
    <div style={{ display: "block", width: "500px" }}>
      <ReportSummaryCard {...args} />
    </div>
  ),
};

export const SmallContainer: Story = {
  args: {
    i18n: enI18n,
    summary: defaultSummary,
  },
  render: (args) => (
    <div style={{ display: "block", width: "300px" }}>
      <ReportSummaryCard {...args} />
    </div>
  ),
};

export const NoHref: Story = {
  args: {
    i18n: enI18n,
    summary: defaultSummary,
  },
  render: (args) => (
    <div style={{ display: "block", width: "500px" }}>
      <ReportSummaryCard {...args} summary={{ ...defaultSummary, href: undefined }} />
    </div>
  ),
};

export const LongName: Story = {
  args: {
    i18n: enI18n,
    summary: defaultSummary,
  },
  render: (args) => (
    <div style={{ display: "block", width: "500px" }}>
      <ReportSummaryCard
        {...args}
        summary={{
          ...defaultSummary,
          name: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        }}
      />
    </div>
  ),
};

export const LongStatuses: Story = {
  args: {
    i18n: enI18n,
    summary: defaultSummary,
  },
  render: (args) => (
    <div style={{ display: "block", width: "500px" }}>
      <ReportSummaryCard
        {...args}
        summary={{
          ...defaultSummary,
          stats: {
            ...defaultSummary.stats,
            failed: 10000000,
            broken: 10000000,
            passed: 10000000,
            skipped: 10000000,
            unknown: 10000000,
            total: 10000000 * 5,
          },
          status: "failed",
        }}
      />
    </div>
  ),
};

export const SeveralCardsInAGrid: Story = {
  args: {
    i18n: enI18n,
    summary: defaultSummary,
  },
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
      <ReportSummaryCard {...args} />
      <ReportSummaryCard {...args} />
      <ReportSummaryCard {...args} />
      <ReportSummaryCard {...args} />
      <ReportSummaryCard {...args} />
    </div>
  ),
};

export const WithPluginNames: Story = {
  args: {
    i18n: enI18n,
    summary: defaultSummary,
  },
  render: (args) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
      <ReportSummaryCard {...args} summary={{ ...defaultSummary, plugin: "Awesome" }} />
      <ReportSummaryCard {...args} summary={{ ...defaultSummary, plugin: "Dashboard" }} />
    </div>
  ),
};

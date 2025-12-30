import { CurrentStatusChartWidget } from "@allurereport/web-components";
import type { Meta, StoryObj } from "@storybook/preact";
import type { ComponentProps } from "preact";
// @ts-ignore this is fine
import mockData from "./data.mock.json";

const i18n = (key: string, props?: Record<string, unknown>) => {
  if (key === "status.passed") {
    return "Passed";
  }
  if (key === "status.failed") {
    return "Failed";
  }
  if (key === "status.skipped") {
    return "Skipped";
  }
  if (key === "status.unknown") {
    return "Unknown";
  }
  if (key === "status.broken") {
    return "Broken";
  }

  if (key === "percentage") {
    return `${props?.percentage as string}%`;
  }

  if (key === "of") {
    return `of ${props?.total as string}`;
  }

  if (key === "tests.new") {
    return `${props?.count as string} new tests`;
  }

  if (key === "tests.flaky") {
    return `${props?.count as string} flaky tests`;
  }

  if (key === "tests.retries") {
    return `${props?.count as string} retries`;
  }

  if (key === "total") {
    return "total";
  }

  return key;
};

const meta: Meta<ComponentProps<typeof CurrentStatusChartWidget>> = {
  title: "Charts/CurrentStatusChartWidget",
  component: CurrentStatusChartWidget,
  parameters: {
    layout: "padded",
  },
  args: {
    title: "Current Status",
    data: {
      total: 0,
      failed: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
    },
    i18n,
  },
};

export default meta;

type Story = StoryObj<ComponentProps<typeof CurrentStatusChartWidget>>;

export const Default: Story = {
  args: {
    data: mockData,
  },
};

export const WithAdditionalStats: Story = {
  args: {
    data: {
      ...mockData,
      new: 10,
      flaky: 20,
      retries: 130,
    },
  },
};

export const AllStats: Story = {
  args: {
    data: {
      total: 500,
      passed: 100,
      failed: 100,
      skipped: 100,
      unknown: 100,
      broken: 100,
      new: 10,
      flaky: 20,
      retries: 30,
    },
  },
};

export const Empty: Story = {
  args: {
    data: {
      total: 0,
      failed: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
    },
  },
};

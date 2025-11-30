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
    centerMetric: {
      by: "passed",
      type: "percent",
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

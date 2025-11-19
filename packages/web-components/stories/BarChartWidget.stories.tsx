import { BarChartWidget } from "@allurereport/web-components";
import type { BarChartWidgetProps } from "@allurereport/web-components";
import { ChartMode } from "@allurereport/charts-api";
import type { Meta, StoryObj } from "@storybook/react";
import { TREND_CATEGORIES, createTrendBarChartData, trendColors } from "./BarChart/mocks";

const meta: Meta<typeof BarChartWidget> = {
  title: "Charts/BarChartWidget",
  component: BarChartWidget,
  parameters: {
    layout: "centered",
  },
  args: {
    width: 900,
    height: 500,
  }
};

export default meta;

const transformTrendDataForWidget = () => {
  const trendData = createTrendBarChartData();
  return trendData.map(item => ({
    groupId: item.point as string,
    fixed: item.fixed as number,
    failed: item.failed as number,
    broken: item.broken as number,
  }));
};

const trendWidgetData = transformTrendDataForWidget();

type Story = StoryObj<BarChartWidgetProps>;

export const Default: Story = {
  args: {
    title: "Test Results by Severity",
    mode: ChartMode.Raw,
    data: trendWidgetData,
    keys: TREND_CATEGORIES,
    indexBy: "groupId",
    groupMode: "stacked",
    colors: trendColors,
    translations: {
      "no-results": "No data available",
    },
  },
};

export const TrendData: Story = {
  args: {
    title: "Trend Analysis (Fixed, Failed, Broken)",
    mode: ChartMode.Raw,
    data: trendWidgetData,
    keys: TREND_CATEGORIES,
    indexBy: "groupId",
    groupMode: "stacked",
    colors: trendColors,
    translations: {
      "no-results": "No trend data available",
    },
  },
};

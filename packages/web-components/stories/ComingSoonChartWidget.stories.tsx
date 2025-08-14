import type { Meta, StoryObj } from "@storybook/preact";
import { ComingSoonChartWidget, type ComingSoonChartWidgetProps } from "@allurereport/web-components";

const meta: Meta<ComingSoonChartWidgetProps> = {
  title: "Charts/ComingSoonChartWidget",
  component: ComingSoonChartWidget,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    title: {
      control: "text",
    }
  },
};

export default meta;
type Story = StoryObj<ComingSoonChartWidgetProps>;

export const Default: Story = {
  args: {
    title: "Heat Map Chart",
  },
};

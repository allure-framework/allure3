import { useMotionConfig } from "@nivo/core";
import type { FunnelCustomLayerProps, FunnelDatum, FunnelPartWithHandlers } from "@nivo/funnel";
import { ResponsiveFunnel } from "@nivo/funnel";
import { Text } from "@nivo/text";
import { type PartialTheme, useTheme } from "@nivo/theming";
import { animated, useSpring } from "@react-spring/web";
import type { JSX } from "preact";
import { useMemo } from "preact/hooks";

import { Widget } from "@/components/Widget";

import { useChartTooltip } from "../ChartTooltip/useChartTooltip";
import { EmptyDataStub } from "../EmptyDataStub";
import {
  defaultSuccessRateI18n,
  formatChartPercentage,
  successRateDescription,
  type SuccessRateI18n,
} from "../SuccessRatePieChart/successRate";

const chartTheme: PartialTheme = {
  background: "var(--color-bg-primary)", // Chart background
  axis: {
    ticks: {
      // axis ticks (values on the axis)
      text: {
        fill: "var(--color-text-secondary)",
      },
    },
    legend: {
      // legend text (axis title)
      text: {
        fill: "var(--color-text-primary)",
      },
    },
  },
  grid: {
    // grid lines
    line: {
      stroke: "var(--color-border-default)",
    },
  },
  legends: {
    // Symbol legends text (e.g., below the chart)
    text: {
      fill: "var(--color-text-secondary)",
    },
  },
  tooltip: {
    container: {
      background: "var(--color-bg-raised)",
      color: "var(--color-text-primary)",
    },
  },
  text: {
    fill: "var(--color-text-primary)",
  },
};

type Props = {
  data: {
    layer: string;
    testCount: number;
    successRate: number;
    eligibleCount?: number;
    percentage: number;
  }[];
  title: string;
  translations: Record<string, string>;
  i18n?: SuccessRateI18n;
  width?: JSX.CSSProperties["width"];
  height?: JSX.CSSProperties["height"];
};

type TPFunnelDatum = FunnelDatum & {
  color: string;
  successRate: number;
  layer: string;
  percentage: number;
  eligibleCount: number;
  layerLabel: string;
  countLabel: string;
  rateLabel: string;
  description: string;
};

const Part = (part: FunnelPartWithHandlers<TPFunnelDatum>) => {
  const theme = useTheme();

  const { animate, config: motionConfig } = useMotionConfig();

  const animatedProps = useSpring({
    transform: `translate(10, ${part.y})`,
    color: part.labelColor,
    config: motionConfig,
    immediate: !animate,
  });

  const { value, layerLabel, countLabel, rateLabel, description } = part.data;
  const lines = [layerLabel, countLabel];

  if (value > 0) {
    lines.push(rateLabel);
  }

  const { triggerProps, tooltip } = useChartTooltip(`${lines.join("\n")}\n${description}`);

  return (
    <animated.g {...triggerProps} role="img" aria-label={lines.join("; ")} transform={animatedProps.transform}>
      {tooltip}
      <title>{lines.join("; ")}</title>
      <Text
        key={part.data.id}
        style={{
          ...theme.labels.text,
          pointerEvents: "all",
        }}
        lineHeight={1.2}
      >
        {lines.map((line, idx) => (
          <animated.tspan key={idx} x={0} dy={idx === 0 ? 0 : "1.2em"}>
            {line}
          </animated.tspan>
        ))}
      </Text>
    </animated.g>
  );
};

const PyramidLabelsLayer = (layerProps: FunnelCustomLayerProps<TPFunnelDatum>) => {
  const { parts } = layerProps;

  return parts.map((part) => {
    return <Part key={part.data.id} {...part} />;
  });
};

export const TestingPyramidWidget = (props: Props) => {
  const { data, title, translations, i18n = defaultSuccessRateI18n, height = 400, width = "100%" } = props;
  const emptyLabel = translations["no-results"];

  const funnelData: TPFunnelDatum[] = useMemo(
    () =>
      // Reverse the data to show the first layer at the bottom
      [...data].reverse().map((item) => ({
        id: item.layer,
        value: item.testCount,
        label: item.layer,
        successRate: item.successRate,
        eligibleCount: item.eligibleCount ?? item.testCount,
        layerLabel: i18n("layer", { layer: item.layer }),
        countLabel: item.testCount
          ? i18n("slice", { count: item.testCount, percent: formatChartPercentage(item.percentage) })
          : i18n("noResults"),
        rateLabel: i18n("successRate", {
          rate: item.testCount ? `${formatChartPercentage(item.successRate)}%` : "???",
        }),
        description: successRateDescription(item.testCount, item.eligibleCount ?? item.testCount, i18n),
        percentage: item.percentage,
        layer: item.layer,
        color: item.testCount > 0 ? "var(--color-intent-primary-bg)" : "var(--color-status-skipped-chart-fill)",
      })),
    [data, i18n],
  );

  if (!data || data.length === 0) {
    return (
      <Widget title={title}>
        <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyLabel} />
      </Widget>
    );
  }

  return (
    <Widget title={title}>
      <div role="group" aria-label={title} style={{ width, height }}>
        <ResponsiveFunnel
          data={funnelData}
          theme={chartTheme}
          enableLabel={false}
          layers={["separators", "parts", "labels", "annotations", PyramidLabelsLayer]}
          interpolation="linear"
          spacing={5}
          shapeBlending={0}
          borderWidth={0}
          colors={(d) => d.color}
          labelColor={{ theme: "background" }}
          enableAfterSeparators={false}
        />
      </div>
    </Widget>
  );
};

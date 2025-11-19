import { useMotionConfig } from "@nivo/core";
import type { FunnelCustomLayerProps, FunnelDatum, FunnelPartWithHandlers } from "@nivo/funnel";
import { ResponsiveFunnel } from "@nivo/funnel";
import { Text } from "@nivo/text";
import { type PartialTheme, useTheme } from "@nivo/theming";
import { animated, useSpring } from "@react-spring/web";
import type { JSX } from "preact";
import { useMemo } from "preact/hooks";
import { Widget } from "@/components/Widget";
import { EmptyDataStub } from "../EmptyDataStub";

const chartTheme: PartialTheme = {
  background: "var(--bg-base-primary)", // Chart background
  axis: {
    ticks: {
      // axis ticks (values on the axis)
      text: {
        fill: "var(--on-text-secondary)",
      },
    },
    legend: {
      // legend text (axis title)
      text: {
        fill: "var(--on-text-primary)",
      },
    },
  },
  grid: {
    // grid lines
    line: {
      stroke: "var(--on-border-muted)",
    },
  },
  legends: {
    // Symbol legends text (e.g., below the chart)
    text: {
      fill: "var(--on-text-secondary)",
    },
  },
  tooltip: {
    container: {
      background: "var(--bg-base-modal)",
      color: "var(--on-text-primary)",
    },
  },
  text: {
    fill: "var(--on-text-primary)",
  },
};

type Props = {
  data: {
    layer: string;
    testCount: number;
    successRate: number;
    percentage: number;
  }[];
  title: string;
  translations: Record<string, string>;
  width?: JSX.CSSProperties["width"];
  height?: JSX.CSSProperties["height"];
};

type TPFunnelDatum = FunnelDatum & {
  color: string;
  successRate: number;
  layer: string;
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

  const lines = [];

  lines.push(`Layer: ${part.data.layer}`);

  if (part.data.value > 0) {
    lines.push(`Number of tests: ${part.data.value} (${part.data.percentage}%)`);
    lines.push(`Success rate: ${part.data.successRate}%`);
  } else {
    lines.push("No tests");
  }

  return (
    <animated.g transform={animatedProps.transform}>
      <Text
        key={part.data.id}
        style={{
          ...theme.labels.text,
          pointerEvents: "none",
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
  const { data, title, translations, height = 400, width = "100%" } = props;
  const emptyLabel = translations["no-results"];

  const funnelData: TPFunnelDatum[] = useMemo(
    () =>
      // Reverse the data to show the first layer at the bottom
      [...data].reverse().map((item) => ({
        id: item.layer,
        value: item.testCount,
        label: item.layer,
        successRate: item.successRate,
        percentage: item.percentage,
        layer: item.layer,
        color: item.testCount > 0 ? "var(--bg-support-aldebaran)" : "var(--bg-support-rau)",
      })),
    [data],
  );

  if (!data || data.length === 0) {
    return <EmptyDataStub label={emptyLabel} width={width} height={height} ariaLabel={emptyLabel} />;
  }

  return (
    <Widget title={title}>
      <div role="img" tabIndex={0} style={{ width, height }}>
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

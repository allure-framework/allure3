import type { PieCustomLayerProps, PieTooltipProps } from "@nivo/pie";
import { Pie } from "@nivo/pie";
import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { Widget } from "@/components/Widget";
import { ChartTooltip } from "../ChartTooltip";
import { LegendItem } from "../LegendItem";
import { WidthProvider } from "../WidthProvider";
import { CHART_MOTION_CONFIG, SHOULD_ANIMATE } from "../config";
import { CenteredMetric } from "./parts";
import type { ChartDatum, Props } from "./types";
import { toChartData } from "./utils";

const noop = (key: string) => key;

const EMPTY_ARC: ChartDatum = {
  id: "__EMPTY_ARC_DO_NOT_COUNT_IT_USED_FOR_VISUALS__",
  // We need to set value to 1 to make sure that the arc is visible
  value: 1,
  color: "var(--bg-control-secondary)",
  label: "",
};

export const CurrentStatusChartWidget: FunctionalComponent<Props> = (props) => {
  const { title, data, centerMetric, i18n = noop } = props;
  const chartData = useMemo(() => toChartData(data, i18n), [data, i18n]);
  const totalCount = data.total;

  const isEmpty = totalCount === 0;

  return (
    <Widget title={title ?? ""}>
      <WidthProvider>
        {(width) => (
          <Pie
            width={width}
            height={width / 2}
            data={isEmpty ? [EMPTY_ARC] : chartData}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            colors={{ datum: "data.color" }} // Use colors from value
            innerRadius={0.75}
            padAngle={1}
            cornerRadius={4}
            activeOuterRadiusOffset={4}
            borderWidth={0}
            borderColor={{ theme: "background" }}
            enableArcLabels={false}
            enableArcLinkLabels={false}
            isInteractive={!isEmpty}
            layers={[
              "arcs",
              (layerProps: PieCustomLayerProps<ChartDatum>) => (
                <CenteredMetric
                  layerProps={layerProps}
                  i18n={i18n}
                  metricType={centerMetric.type}
                  metric={centerMetric.type === "percent" ? centerMetric.by : undefined}
                  isEmpty={isEmpty}
                  total={totalCount}
                />
              ),
            ]}
            animate={SHOULD_ANIMATE}
            motionConfig={CHART_MOTION_CONFIG}
            tooltip={PieTooltip}
          />
        )}
      </WidthProvider>
    </Widget>
  );
};

const PieTooltip: FunctionalComponent<PieTooltipProps<ChartDatum>> = (props) => {
  const { datum } = props;

  const legend = useMemo(
    () => ({
      id: datum.id.toString(),
      color: datum.color,
      label: datum.label,
      value: datum.value,
    }),
    [datum],
  );

  return (
    <ChartTooltip>
      <LegendItem mode="menu" legend={legend} />
    </ChartTooltip>
  );
};

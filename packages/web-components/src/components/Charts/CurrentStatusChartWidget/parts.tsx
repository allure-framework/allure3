import type { PieCustomLayerProps } from "@nivo/pie";
import { useMemo } from "preact/hooks";
import styles from "./styles.scss";
import type { ChartDatum, I18nProp } from "./types";
import { formatDescriptionToFitWidth, formatPercentageToFitWidth, formatTotalToFitWidth, getPercentOf } from "./utils";

export const CenteredMetric = ({
  metric,
  metricType,
  layerProps,
  isEmpty,
  i18n,
  total,
}: {
  metric: string;
  metricType: "total" | "percent";
  layerProps: PieCustomLayerProps<ChartDatum>;
  isEmpty: boolean;
  i18n: I18nProp;
  total: number;
}) => {
  if (metricType === "total" || isEmpty) {
    return <TotalMetric layer={layerProps} i18n={i18n} total={total} />;
  }

  if (metricType === "percent") {
    return <PercentsMetric layer={layerProps} metric={metric} i18n={i18n} total={total} />;
  }

  return null;
};

const TotalMetric = ({
  layer,
  i18n,
  total,
}: {
  layer: PieCustomLayerProps<ChartDatum>;
  i18n: I18nProp;
  total: number;
}) => {
  const { radius, centerX, centerY } = layer;

  return <CenteredText radius={radius} centerX={centerX} centerY={centerY} title={total} description={i18n("total")} />;
};

const PercentsMetric = ({
  layer,
  metric,
  i18n,
  total,
}: {
  layer: PieCustomLayerProps<ChartDatum>;
  metric: string;
  i18n: I18nProp;
  total: number;
}) => {
  const { dataWithArc, radius, centerX, centerY } = layer;

  const metricData = dataWithArc.find((item) => item.data.id === metric);
  const percentage = getPercentOf(metricData?.data.value, total);

  return (
    <CenteredText
      radius={radius}
      centerX={centerX}
      centerY={centerY}
      title={i18n("percentage", { percentage })}
      description={i18n("of", {
        total,
      })}
    />
  );
};

const CenteredText = ({
  radius,
  centerX,
  centerY,
  title,
  description,
}: {
  radius: number;
  centerX: number;
  centerY: number;
  title: string | number;
  description: string | number;
}) => {
  const text = title.toString();
  const isPercentage = text.includes("%");

  const titleFontSize = Math.round(Math.min(radius / 1.8, 36));
  const descriptionFontSize = Math.round(Math.min(radius / 3.3, 16));
  const margin = Math.min(radius / 2.5, descriptionFontSize * 2);

  const titleText = useMemo(() => {
    if (isPercentage) {
      return formatPercentageToFitWidth({
        width: radius,
        text,
        symbolWidth: titleFontSize / 3, // Approximate width of a character with a percentage
      });
    }

    return formatTotalToFitWidth({
      width: radius,
      text,
      symbolWidth: titleFontSize / 3, // Approximate width of a character
    });
  }, [isPercentage, radius, text, titleFontSize]);

  const descriptionText = useMemo(() => {
    return formatDescriptionToFitWidth({
      width: radius,
      text: description.toString(),
      symbolWidth: descriptionFontSize / 3,
    });
  }, [description, descriptionFontSize, radius]);

  // Numeric values below are manually adjusted for better display.
  return (
    <>
      <text
        x={centerX}
        y={centerY - margin / 3}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: titleFontSize,
        }}
        className={styles.centeredMetricTitle}
      >
        {titleText}
      </text>
      <text
        x={centerX}
        y={centerY + margin / 1.5}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontSize: descriptionFontSize,
        }}
        className={styles.centeredMetricDescription}
      >
        {descriptionText}
      </text>
    </>
  );
};

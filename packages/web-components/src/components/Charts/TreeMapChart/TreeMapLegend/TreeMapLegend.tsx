import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import styles from "./styles.scss";
import type { TreeMapLegendProps } from "./types.js";
import { Text } from "@/components/Typography";

export const TreeMapLegend: FunctionalComponent<TreeMapLegendProps> = ({
  minValue,
  maxValue,
  colorFunction,
  formatValue = (value: number) => value.toFixed(2),
}) => {
  const gradientColors = useMemo(() => {
    const startColor = colorFunction(minValue);
    const endColor = colorFunction(maxValue);

    return {
      start: startColor,
      end: endColor,
    };
  }, [minValue, maxValue, colorFunction]);

  const formattedMinValue = useMemo(() => formatValue(minValue), [minValue, formatValue]);
  const formattedMaxValue = useMemo(() => formatValue(maxValue), [maxValue, formatValue]);

  return (
    <div className={styles.treeMapLegend}>
      <Text size="s" type="ui" className={styles.treeMapLegend__label}>{formattedMaxValue}</Text>
        <div
          className={styles.treeMapLegend__gradient}
          style={{
            "--gradient-start": gradientColors.start,
            "--gradient-end": gradientColors.end,
          }}
        />
      <Text size="s" type="ui" className={styles.treeMapLegend__label}>{formattedMinValue}</Text>
    </div>
  );
};

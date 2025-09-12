import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import styles from "./styles.scss";
import type { TreeMapLegendProps } from "./types.js";

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
      <div
        className={styles.treeMapLegend__gradient}
        style={{
          "--gradient-start": gradientColors.start,
          "--gradient-end": gradientColors.end,
        }}
      />
      <div className={styles.treeMapLegend__labels}>
        <span className={styles.treeMapLegend__label}>{formattedMaxValue}</span>
        <span className={styles.treeMapLegend__label}>{formattedMinValue}</span>
      </div>
    </div>
  );
};

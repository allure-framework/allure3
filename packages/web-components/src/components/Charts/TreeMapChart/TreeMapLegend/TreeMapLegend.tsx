import type { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import styles from "./styles.scss";
import type { TreeMapLegendProps } from "./types.js";
import { Text } from "@/components/Typography";

export const TreeMapLegend: FunctionalComponent<TreeMapLegendProps> = ({
  minValue,
  maxValue,
  colorFn,
  formatValue = (value: number) => value.toFixed(2),
  domain,
}) => {
  // Auto-calculate minValue and maxValue from domain if not provided
  const effectiveMinValue = useMemo(() => {
    if (domain && domain.length > 0) {
      return Math.min(...domain);
    }
    return minValue ?? 0;
  }, [domain, minValue]);

  const effectiveMaxValue = useMemo(() => {
    if (domain && domain.length > 0) {
      return Math.max(...domain);
    }
    return maxValue ?? 1;
  }, [domain, maxValue]);

  const gradientStops = useMemo(() => {
    // Use domain to determine gradient points, or fallback to simple gradient
    if (domain && domain.length > 0) {
      // Sort domain values to ensure correct gradient order
      const sortedDomain = [...domain].sort((a, b) => a - b);

      // Calculate percentage positions for each domain point
      const valueRange = effectiveMaxValue - effectiveMinValue;
      const stops = sortedDomain.map(domainValue => {
        const percentage = ((domainValue - effectiveMinValue) / valueRange) * 100;
        const color = colorFn(domainValue, domain);
        return `${color} ${percentage.toFixed(1)}%`;
      });

      return stops.join(", ");
    }

    // Fallback to simple gradient between min and max
    const startColor = colorFn(effectiveMinValue);
    const endColor = colorFn(effectiveMaxValue);

    return `${startColor} 0%, ${endColor} 100%`;
  }, [effectiveMinValue, effectiveMaxValue, colorFn, domain]);

  const formattedMinValue = useMemo(() => formatValue(effectiveMinValue), [effectiveMinValue, formatValue]);
  const formattedMaxValue = useMemo(() => formatValue(effectiveMaxValue), [effectiveMaxValue, formatValue]);

  return (
    <div className={styles.treeMapLegend}>
      <Text size="s" type="ui" className={styles.treeMapLegend__label}>{formattedMaxValue}</Text>
        <div
          className={styles.treeMapLegend__gradient}
          style={{
            "--gradient-stops": gradientStops,
          }}
        />
      <Text size="s" type="ui" className={styles.treeMapLegend__label}>{formattedMinValue}</Text>
    </div>
  );
};

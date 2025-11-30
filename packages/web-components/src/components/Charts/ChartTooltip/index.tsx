import type { FunctionalComponent } from "preact";
import { Text } from "@/components/Typography";
import { LegendIndicator } from "../LegendIndicator";
import styles from "./styles.scss";

export const ChartTooltip: FunctionalComponent<{
  label?: string;
  labelColor?: string;
}> = (props) => {
  const { children, labelColor, label } = props;

  return (
    <div data-testid="chart-tooltip" className={styles.tooltip} data-tooltip-type="chart">
      <div className={styles.container}>
        {!!label && (
          <Text className={styles.label} type="ui" size="s" bold tag="div">
            {labelColor && <LegendIndicator color={labelColor} />}
            <Text tag="div" bold>
              {label}
            </Text>
          </Text>
        )}
        {children}
      </div>
    </div>
  );
};

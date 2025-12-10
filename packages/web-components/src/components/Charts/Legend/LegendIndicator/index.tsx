import type { FunctionalComponent } from "preact";
import styles from "./styles.scss";

export const LegendIndicator: FunctionalComponent<{ color: string; border?: string }> = (props) => {
  const { color, border } = props;
  return (
    <div className={styles.legendIndicatorContainer}>
      <div className={styles.legendIndicatorContainerBase} data-has-color={!!color || undefined}>
        <i
          aria-hidden
          className={styles.legendIndicator}
          style={{ backgroundColor: color, borderColor: border ?? undefined }}
        />
      </div>
    </div>
  );
};

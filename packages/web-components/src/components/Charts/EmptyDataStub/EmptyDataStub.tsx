import type { FunctionalComponent } from "preact";
import type { CSSProperties } from "preact/compat";
import styles from "./styles.scss";

export interface EmptyDataStubProps {
  label: string;
  width: CSSProperties["width"];
  height: CSSProperties["height"];
  ariaLabel?: string;
}

export const EmptyDataStub: FunctionalComponent<EmptyDataStubProps> = ({ label, width, height, ariaLabel = label }) => {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={styles["empty-data-stub"]}
      style={{
        width,
        height,
      }}
    >
      {label}
    </div>
  );
};

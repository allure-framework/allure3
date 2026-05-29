import type { TestStatus } from "@allurereport/core-api";
import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";

import styles from "./styles.scss";

interface TestStatusIconProps {
  status?: TestStatus;
  className?: string;
  classNameIcon?: string;
}

const marks: Record<TestStatus, FunctionalComponent> = {
  failed: () => (
    <>
      <path className={styles["tree-item-icon-stroke"]} d="M5.6 5.6 10.4 10.4" />
      <path className={styles["tree-item-icon-stroke"]} d="M10.4 5.6 5.6 10.4" />
    </>
  ),
  broken: () => (
    <>
      <path className={styles["tree-item-icon-stroke"]} d="M8 4.6v4.2" />
      <circle className={styles["tree-item-icon-fill"]} cx="8" cy="11.4" r="1" />
    </>
  ),
  passed: () => <path className={styles["tree-item-icon-stroke"]} d="m4.8 8.2 2.2 2.2 4.4-4.8" />,
  skipped: () => <path className={styles["tree-item-icon-stroke"]} d="M5 8h6" />,
  unknown: () => (
    <>
      <path
        className={styles["tree-item-icon-stroke"]}
        d="M6.4 6.2A1.7 1.7 0 0 1 8 5.1c1 0 1.8.7 1.8 1.7 0 1.4-1.8 1.3-1.8 2.8"
      />
      <circle className={styles["tree-item-icon-fill"]} cx="8" cy="11.5" r="0.9" />
    </>
  ),
};

export const TreeItemIcon: FunctionalComponent<TestStatusIconProps> = ({
  status = "unknown",
  className,
  classNameIcon,
}) => {
  const statusClass = styles[`status-${status}`];
  const Mark = marks[status];

  return (
    <div data-testid={`tree-leaf-status-${status}`} className={clsx(styles["tree-item-icon"], statusClass, className)}>
      <svg
        className={clsx(styles["tree-item-icon-svg"], classNameIcon)}
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <circle className={styles["tree-item-icon-bg"]} cx="8" cy="8" r="7.5" />
        <Mark />
      </svg>
    </div>
  );
};

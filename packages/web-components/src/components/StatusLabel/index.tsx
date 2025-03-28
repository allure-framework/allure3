import type { TestStatus } from "@allurereport/core-api";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import { TreeItemIcon } from "../Tree";
import { Text } from "../Typography";
import styles from "./styles.scss";

export type StatusLabelProps = {
  status: TestStatus;
  className?: string;
};

export const StatusLabel: FunctionalComponent<StatusLabelProps> = ({ status, children, className, ...rest }) => {
  return (
    <div {...rest} className={clsx(styles["status-label"], styles[`status-${status}`], className)}>
      <TreeItemIcon
        status={status}
        className={styles["status-label-icon"]}
        classNameIcon={styles["status-label-icon"]}
      />
      <Text type={"ui"} size={"s"} className={styles["status-label-text"]}>
        {children}
      </Text>
    </div>
  );
};

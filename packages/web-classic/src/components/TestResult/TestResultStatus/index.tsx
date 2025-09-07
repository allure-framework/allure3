import type { TestStatus } from "@allurereport/core-api";
import { capitalize } from "@allurereport/core-api";
import { Text } from "@allurereport/web-components";
import clsx from "clsx";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

export const TestResultStatus = ({ status }: { status: TestStatus }) => {
  const { t } = useI18n("statuses");
  return (
    <div
      data-testid={`test-result-status-${status}`}
      className={clsx(styles["test-result-status"], styles[`status-${status}`])}
    >
      <TreeItemIcon
        status={status}
        className={styles["test-result-status-icon"]}
        classNameIcon={styles["test-result-status-icon"]}
      />
      <Text type={"ui"} size={"s"} bold className={styles["test-result-status-text"]}>
        {capitalize(t(status) ?? status)}
      </Text>
    </div>
  );
};

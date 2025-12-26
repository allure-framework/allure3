import { Text } from "@allurereport/web-components";
import { useComputed } from "@preact/signals";
import { type ComponentChildren } from "preact";
import { useCallback } from "preact/hooks";
import { setTreeStatus, treeStatus } from "@/stores/treeFilters";
import type { AwesomeStatus } from "../../../types.js";
import * as styles from "./styles.scss";

export const ReportTabsList = (props: { children: ComponentChildren }) => {
  return <div className={styles.tabsList}>{props.children}</div>;
};

export const ReportTab = (props: { id: AwesomeStatus; children: ComponentChildren }) => {
  const { id, children, ...rest } = props;
  const isCurrentTab = useComputed(() => treeStatus.value === id);

  const handleCurrentTabClick = useCallback(() => {
    setTreeStatus("total");
  }, []);

  const handleTabClick = useCallback(() => {
    setTreeStatus(id);
  }, [id]);

  return (
    <button
      {...rest}
      className={styles.tab}
      onClick={isCurrentTab.value ? handleCurrentTabClick : handleTabClick}
      aria-current={isCurrentTab.value || undefined}
    >
      <Text type="paragraph" size="m" bold>
        {children}
      </Text>
    </button>
  );
};

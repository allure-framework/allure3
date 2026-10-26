import { type TestStatus, type TestStatusTransition, capitalize } from "@allurereport/core-api";
import { Text, TreeItemInfo } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionComponent } from "preact";

import TreeItemIcon from "@/components/Tree/TreeItemIcon";
import { useI18n } from "@/stores/locale";
import { navigateTo, route } from "@/stores/router";
import { getTestResultHash } from "@/utils/testResultNavigation";

import * as styles from "./styles.scss";

interface TreeItemProps {
  name: string;
  status: TestStatus;
  duration?: number;
  id: string;
  groupOrder: number;
  parentNodeId?: string;
  isMarked?: boolean;
  flaky?: boolean;
  retriesCount?: number;
  transition?: TestStatusTransition;
}

export const TreeItem: FunctionComponent<TreeItemProps> = ({
  name,
  groupOrder,
  status,
  duration,
  id,
  parentNodeId,
  isMarked,
  flaky,
  retriesCount,
  transition,
  ...rest
}) => {
  const { tabName, params } = route.value;
  const { t } = useI18n("tree");
  const { t: transitionsT } = useI18n("transitions");
  // the opened test result tab (history, retries, etc.) is kept, like with the previous/next buttons
  const navigateToTR = () =>
    navigateTo(
      `#${getTestResultHash({ tabName, params: { ...params, id: parentNodeId || "root", testResultId: id } }, id)}`,
    );
  // Allure 2 leaf marks: flaky icon, retries count and status transition (e.g. new test)
  const tooltips = {
    flaky: t("flaky"),
    retries: t("retries", { count: retriesCount ?? 0 }),
    transition: transition ? capitalize(transitionsT(transition)) : undefined,
  };

  return (
    <div {...rest} className={clsx(styles["tree-item"], isMarked && styles["tree-item-marked"])} onClick={navigateToTR}>
      <TreeItemIcon status={status} />
      <span data-testid="tree-leaf-order" className={styles.order}>
        {groupOrder}
      </span>
      <Text data-testid="tree-leaf-title" className={styles["item-title"]}>
        {name}
      </Text>
      <div data-testid="tree-leaf-info" className={styles["item-info"]}>
        <TreeItemInfo
          duration={duration}
          flaky={flaky}
          retriesCount={retriesCount}
          transition={transition}
          tooltips={tooltips}
          hideUnknownDuration
        />
      </div>
    </div>
  );
};

export default TreeItem;

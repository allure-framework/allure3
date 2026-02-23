import type {
  CategoryNode,
  CategoryNodeProps,
  Statistic,
  TestStatus,
  TestStatusTransition,
} from "@allurereport/core-api";
import { capitalize } from "@allurereport/core-api";
import { SvgIcon, Text, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import type { ComponentChildren } from "preact";
import type { FC } from "preact/compat";
import { GroupTreeItem } from "@/components/Categories/GroupTreeItem";
import { TrStatus } from "@/components/TestResult/TrStatus";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

type LabelTreeItemProps = CategoryNodeProps & {
  node: CategoryNode;
  isOpened: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  depth: number;
  subtreeToggle?: ComponentChildren;
  reportStatistic?: Statistic;
};

export const LabelTreeItem: FC<LabelTreeItemProps> = ({
  node,
  nodeId,
  store,
  isOpened,
  onToggle,
  children,
  depth,
  subtreeToggle,
  reportStatistic,
}) => {
  const { t: tTransitions } = useI18n("transitions");
  const transitionIcons: Partial<Record<TestStatusTransition, string>> = {
    new: allureIcons.lineAlertsNew,
    fixed: allureIcons.lineAlertsFixed,
    regressed: allureIcons.lineAlertsRegressed,
    malfunctioned: allureIcons.lineAlertsMalfunctioned,
  };
  const value = node.value === "<Empty>" ? `No ${node.key ?? "label"}` : (node.value ?? "");
  const isStatusGroup = node.key === "status";
  const isTransitionGroup = node.key === "transition";
  const statusLabelValue = node.value === "<Empty>" ? "unknown" : (node.value ?? "unknown");
  const statusValue = node.key === "status" ? (node.value ?? "") : "";
  const transitionValue = node.key === "transition" ? (node.value ?? "") : "";
  const statusIcon = statusValue && statusValue !== "<Empty>" ? (statusValue as TestStatus) : undefined;
  const transitionIcon = transitionIcons[transitionValue as TestStatusTransition];
  const transitionLabel = transitionValue ? (tTransitions(transitionValue) ?? transitionValue) : transitionValue;
  return (
    <GroupTreeItem
      node={node}
      nodeId={nodeId}
      store={store}
      isOpened={isOpened}
      onToggle={onToggle}
      depth={depth}
      subtreeToggle={subtreeToggle}
      reportStatistic={reportStatistic}
      className={clsx(
        styles["tree-item-label"],
        isStatusGroup && styles["tree-item-label-status"],
        isTransitionGroup && styles["tree-item-label-transition"],
      )}
      title={
        isStatusGroup ? (
          <div className={styles["tree-item-label-status-title"]}>
            <TrStatus status={statusLabelValue as TestStatus} />
          </div>
        ) : isTransitionGroup ? (
          <div className={styles["tree-item-label-transition-title"]}>
            {transitionIcon && <SvgIcon id={transitionIcon} className={styles["tree-item-label-transition-icon"]} />}
            <Text size="m" className={styles["tree-item-label-transition-text"]}>
              {capitalize(transitionLabel ?? "")}
            </Text>
          </div>
        ) : (
          <div className={styles["tree-item-label-row"]}>
            <Text type={"ui"} size="m" className={styles["tree-item-label-key"]}>
              {node.key}
            </Text>
            <div className={styles["tree-item-label-values"]}>
              <div className={styles["tree-item-label-bubble"]}>
                {statusIcon ? (
                  <TreeItemIcon status={statusIcon} className={styles["tree-item-label-icon"]} />
                ) : transitionIcon ? (
                  <SvgIcon id={transitionIcon} className={styles["tree-item-label-transition-icon"]} />
                ) : null}
                <Text size="m" bold className={styles["tree-item-label-value-text"]}>
                  {value}
                </Text>
              </div>
            </div>
          </div>
        )
      }
    >
      {children}
    </GroupTreeItem>
  );
};
